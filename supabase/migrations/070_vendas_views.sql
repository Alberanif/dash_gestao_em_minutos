-- Migration 070: Visualizações do Relatório de Vendas (PRD #185, fatia 1/4, issue #187)
--
-- Uma Visualização acompanha a QUANTIDADE de vendas de UM produto Hotmart e de
-- uma allowlist de ofertas. Substitui, no produto, o modelo de ciclo de
-- renovação — mas esta migration é ADITIVA: nenhuma tabela ou RPC antiga
-- (vendas_cycles, cycle_products, cycle_offers, buyers, manual_links,
-- excluded_buyers, cycle_sales, daily, hourly, roster...) é alterada ou
-- apagada. O código antigo segue funcionando entre aplicar esta migration e
-- fazer deploy do código novo (PRD, seção 10: aplicar a migration PRIMEIRO).
--
-- IDEMPOTENTE: rodar duas vezes não duplica nada nem falha.
--
-- ── REGRAS DE CONTAGEM ──────────────────────────────────────────────────────
--   * Só conta venda do produto da visualização com offer_code NA allowlist.
--     offer_code nulo nunca conta; oferta fora da allowlist nunca conta.
--   * Principal ("vendas")        = status APPROVED + COMPLETE.
--   * Reembolsadas ("refunded")   = status REFUNDED + CHARGEBACK.
--   * Data = data de APROVAÇÃO em America/Sao_Paulo. Reembolso não move a
--     venda de dia.
--   * O FUSO É ESCRITO EM UM ÚNICO LUGAR: dash_gestao_vendas_view_sales. As
--     demais RPCs consomem approved_day / approved_hour dela e nunca escrevem
--     `at time zone` nem `::date` (testado em
--     src/lib/vendas/__tests__/vendas-views-migration.test.ts).
--
-- ── ASSINATURAS (contrato consumido pelas fatias 2 e 3; ver src/types/vendas.ts)
--   dash_gestao_vendas_view_sales (p_view_id uuid, p_start date default null, p_end date default null)
--     returns table (transaction_code text, offer_code text, status text,
--                    approved_date timestamptz, approved_day date, approved_hour text)
--   dash_gestao_vendas_view_kpis  (p_view_id uuid, p_start date default null, p_end date default null)
--     returns table (sales bigint, refunded bigint)                    -- 1 linha
--   dash_gestao_vendas_view_daily (p_view_id uuid, p_start date default null, p_end date default null)
--     returns table (day date, sales bigint)
--   dash_gestao_vendas_view_hourly(p_view_id uuid, p_start date default null, p_end date default null)
--     returns table (hour text, sales bigint)                          -- 'YYYY-MM-DDTHH'
--   dash_gestao_vendas_view_offers(p_view_id uuid, p_start date default null, p_end date default null)
--     returns table (offer_code text, offer_name text, sales bigint, refunded bigint)
--   Todas: language sql, stable, security definer, set search_path = public,
--   execute só para service_role (a API chama com a service key, como as RPCs
--   das migrations 050/051/064). Visualização inexistente => 0 linhas
--   (view_kpis devolve 1 linha com zeros).

-- ── 1. Validação da allowlist ───────────────────────────────────────────────
-- CHECK não aceita subquery; a regra "sem duplicados" vive numa função pura.
create or replace function public.dash_gestao_vendas_offer_codes_valid(p_codes text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_codes is not null
     and cardinality(p_codes) >= 1
     and not exists (
       select 1 from unnest(p_codes) c where c is null or btrim(c) = ''
     )
     and cardinality(p_codes) = (select count(distinct c) from unnest(p_codes) c);
$$;

-- ── 2. Tabela ───────────────────────────────────────────────────────────────
create table if not exists public.dash_gestao_vendas_views (
  id                      uuid        primary key default gen_random_uuid(),
  name                    text        not null,
  account_id              uuid        not null references public.dash_gestao_accounts(id) on delete cascade,
  product_id              text        not null references public.dash_gestao_hotmart_products(product_id),
  offer_codes             text[]      not null,
  folder_id               uuid        null references public.dash_gestao_vendas_folders(id) on delete set null,
  view_start_date         date        null,
  view_end_date           date        null,
  refresh_started_at      timestamptz null,
  last_refresh_at         timestamptz null,
  backfill_status         text        not null default 'pending',
  backfill_from           date        null,
  -- Origem da migração dos ciclos ativos. SEM FK de propósito: o ciclo antigo
  -- será dropado no follow-up e a visualização não pode depender dele.
  migrated_from_cycle_id  uuid        null,
  created_by              uuid        null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint chk_vendas_views_offer_codes
    check (public.dash_gestao_vendas_offer_codes_valid(offer_codes)),
  constraint chk_vendas_views_backfill_status
    check (backfill_status in ('pending', 'running', 'done', 'partial', 'failed')),
  constraint chk_vendas_views_range
    check (
      (view_start_date is null) = (view_end_date is null)
      and (view_start_date is null or view_end_date >= view_start_date)
    ),
  -- (ciclo, produto) e não só ciclo: um ciclo com N produtos gera N
  -- visualizações com o mesmo migrated_from_cycle_id.
  constraint uq_vendas_views_migrated unique (migrated_from_cycle_id, product_id)
);

create index if not exists idx_vendas_views_account_created
  on public.dash_gestao_vendas_views (account_id, created_at desc);
create index if not exists idx_vendas_views_folder_id
  on public.dash_gestao_vendas_views (folder_id);

-- ── 3. product_id imutável (decisão 13 do PRD) ──────────────────────────────
create or replace function public.dash_gestao_vendas_views_guard()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.product_id is distinct from old.product_id then
    raise exception 'product_id de uma visualização não pode ser alterado'
      using errcode = 'UV001';
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists trg_vendas_views_guard on public.dash_gestao_vendas_views;
create trigger trg_vendas_views_guard
  before update on public.dash_gestao_vendas_views
  for each row execute function public.dash_gestao_vendas_views_guard();

-- ── 4. RLS (espelha dash_gestao_vendas_cycles) ──────────────────────────────
-- Leitura via sessão do usuário; escrita via service_role (ignora RLS).
alter table public.dash_gestao_vendas_views enable row level security;

drop policy if exists "Authenticated users can read vendas views"
  on public.dash_gestao_vendas_views;
create policy "Authenticated users can read vendas views"
  on public.dash_gestao_vendas_views
  for select
  to authenticated
  using (true);

-- ── 5. RPC base: view_sales (ÚNICO lugar com o fuso) ────────────────────────
create or replace function public.dash_gestao_vendas_view_sales(
  p_view_id uuid,
  p_start   date default null,
  p_end     date default null
)
returns table (
  transaction_code text,
  offer_code       text,
  status           text,
  approved_date    timestamptz,
  approved_day     date,
  approved_hour    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.transaction_code,
    s.offer_code,
    s.status,
    s.approved_date,
    (s.approved_date at time zone 'America/Sao_Paulo')::date as approved_day,
    to_char(
      date_trunc('hour', s.approved_date at time zone 'America/Sao_Paulo'),
      'YYYY-MM-DD"T"HH24'
    ) as approved_hour
  from public.dash_gestao_vendas_views v
  join public.dash_gestao_hotmart_sales s
    on s.product_id = v.product_id
   and s.offer_code = any (v.offer_codes)
  where v.id = p_view_id
    and s.approved_date is not null
    and s.status in ('APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK')
    and (p_start is null
         or (s.approved_date at time zone 'America/Sao_Paulo')::date >= p_start)
    and (p_end is null
         or (s.approved_date at time zone 'America/Sao_Paulo')::date <= p_end);
$$;

-- ── 6. KPIs, dia, hora, ofertas: só consomem view_sales ─────────────────────
create or replace function public.dash_gestao_vendas_view_kpis(
  p_view_id uuid,
  p_start   date default null,
  p_end     date default null
)
returns table (
  sales    bigint,
  refunded bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where vs.status in ('APPROVED', 'COMPLETE'))    as sales,
    count(*) filter (where vs.status in ('REFUNDED', 'CHARGEBACK'))  as refunded
  from public.dash_gestao_vendas_view_sales(p_view_id, p_start, p_end) vs;
$$;

create or replace function public.dash_gestao_vendas_view_daily(
  p_view_id uuid,
  p_start   date default null,
  p_end     date default null
)
returns table (
  day   date,
  sales bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    vs.approved_day as day,
    count(*)        as sales
  from public.dash_gestao_vendas_view_sales(p_view_id, p_start, p_end) vs
  where vs.status in ('APPROVED', 'COMPLETE')
  group by vs.approved_day
  order by vs.approved_day;
$$;

create or replace function public.dash_gestao_vendas_view_hourly(
  p_view_id uuid,
  p_start   date default null,
  p_end     date default null
)
returns table (
  hour  text,
  sales bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    vs.approved_hour as hour,
    count(*)         as sales
  from public.dash_gestao_vendas_view_sales(p_view_id, p_start, p_end) vs
  where vs.status in ('APPROVED', 'COMPLETE')
  group by vs.approved_hour
  order by vs.approved_hour;
$$;

-- Uma linha por oferta da allowlist, inclusive com 0 vendas (left join).
create or replace function public.dash_gestao_vendas_view_offers(
  p_view_id uuid,
  p_start   date default null,
  p_end     date default null
)
returns table (
  offer_code text,
  offer_name text,
  sales      bigint,
  refunded   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.code                                                              as offer_code,
    o.offer_name                                                        as offer_name,
    count(vs.transaction_code) filter (where vs.status in ('APPROVED', 'COMPLETE'))   as sales,
    count(vs.transaction_code) filter (where vs.status in ('REFUNDED', 'CHARGEBACK')) as refunded
  from public.dash_gestao_vendas_views v
  cross join lateral unnest(v.offer_codes) as a(code)
  left join public.dash_gestao_hotmart_offers o
    on o.offer_code = a.code
  left join public.dash_gestao_vendas_view_sales(p_view_id, p_start, p_end) vs
    on vs.offer_code = a.code
  where v.id = p_view_id
  group by a.code, o.offer_name
  order by sales desc, a.code;
$$;

-- ── 7. Grants (mesma política das RPCs do módulo: só service_role) ──────────
revoke execute on function public.dash_gestao_vendas_view_sales(uuid, date, date)  from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_view_sales(uuid, date, date)  to service_role;
revoke execute on function public.dash_gestao_vendas_view_kpis(uuid, date, date)   from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_view_kpis(uuid, date, date)   to service_role;
revoke execute on function public.dash_gestao_vendas_view_daily(uuid, date, date)  from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_view_daily(uuid, date, date)  to service_role;
revoke execute on function public.dash_gestao_vendas_view_hourly(uuid, date, date) from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_view_hourly(uuid, date, date) to service_role;
revoke execute on function public.dash_gestao_vendas_view_offers(uuid, date, date) from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_view_offers(uuid, date, date) to service_role;

-- ── 8. Migração dos ciclos ATIVOS (PRD, seção 7) ────────────────────────────
-- Ciclo com N produtos => N visualizações. Só ofertas `included = true`.
-- Ignora rejected_offer_codes, include_offerless e meta. Ciclo/produto sem
-- nenhuma oferta permitida NÃO migra (o INNER JOIN com a agregação o exclui).
-- Idempotente: uq_vendas_views_migrated + ON CONFLICT DO NOTHING.
-- Começam com backfill_status = 'pending' (default).
insert into public.dash_gestao_vendas_views
  (name, account_id, product_id, offer_codes, folder_id,
   view_start_date, view_end_date, created_by, created_at, migrated_from_cycle_id)
select
  case when pc.n_products = 1 then c.name
       else c.name || ' — ' || p.product_name end,
  c.account_id,
  allow.product_id,
  allow.codes,
  c.folder_id,
  c.view_start_date,
  c.view_end_date,
  c.created_by,
  c.created_at,
  c.id
from public.dash_gestao_vendas_cycles c
join (
  select co.cycle_id, co.product_id, array_agg(co.offer_code order by co.offer_code) as codes
  from public.dash_gestao_vendas_cycle_offers co
  where co.included is true
  group by co.cycle_id, co.product_id
) allow on allow.cycle_id = c.id
join public.dash_gestao_vendas_cycle_products cp
  on cp.cycle_id = c.id and cp.product_id = allow.product_id
join (
  select cycle_id, count(*) as n_products
  from public.dash_gestao_vendas_cycle_products
  group by cycle_id
) pc on pc.cycle_id = c.id
join public.dash_gestao_hotmart_products p on p.product_id = allow.product_id
where c.status = 'ativo'
on conflict (migrated_from_cycle_id, product_id) do nothing;

-- Relatório: quantos ficaram de fora (alimenta o aviso do RF-9).
do $report$
declare
  v_active_cycles    int;
  v_migrated_cycles  int;
  v_active_pairs     int;
  v_migrated_pairs   int;
begin
  select count(*) into v_active_cycles
  from public.dash_gestao_vendas_cycles where status = 'ativo';

  select count(distinct v.migrated_from_cycle_id) into v_migrated_cycles
  from public.dash_gestao_vendas_views v
  join public.dash_gestao_vendas_cycles c on c.id = v.migrated_from_cycle_id
  where c.status = 'ativo';

  select count(*) into v_active_pairs
  from public.dash_gestao_vendas_cycle_products cp
  join public.dash_gestao_vendas_cycles c on c.id = cp.cycle_id
  where c.status = 'ativo';

  select count(*) into v_migrated_pairs
  from public.dash_gestao_vendas_views v
  join public.dash_gestao_vendas_cycles c on c.id = v.migrated_from_cycle_id
  where c.status = 'ativo';

  raise notice 'vendas_views: % de % ciclos ativos com visualização (% sem allowlist, fora); % de % pares ciclo/produto migrados (% fora)',
    v_migrated_cycles, v_active_cycles, v_active_cycles - v_migrated_cycles,
    v_migrated_pairs, v_active_pairs, v_active_pairs - v_migrated_pairs;
end
$report$;

-- ── ROLLBACK (manual) ───────────────────────────────────────────────────────
-- drop function if exists public.dash_gestao_vendas_view_offers(uuid, date, date);
-- drop function if exists public.dash_gestao_vendas_view_hourly(uuid, date, date);
-- drop function if exists public.dash_gestao_vendas_view_daily(uuid, date, date);
-- drop function if exists public.dash_gestao_vendas_view_kpis(uuid, date, date);
-- drop function if exists public.dash_gestao_vendas_view_sales(uuid, date, date);
-- drop table if exists public.dash_gestao_vendas_views;
-- drop function if exists public.dash_gestao_vendas_views_guard();
-- drop function if exists public.dash_gestao_vendas_offer_codes_valid(text[]);
