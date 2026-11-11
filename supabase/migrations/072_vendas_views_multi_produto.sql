-- Migration 072: Visualizações com vários produtos (PRD #213, fatia 1/6, issue #214)
--
-- Uma Visualização passa a contabilizar N produtos Hotmart, cada um com a sua
-- allowlist de ofertas. O modelo (decisão 4 do PRD) é uma tabela filha
-- dash_gestao_vendas_view_products (view_id, product_id, offer_codes[]).
--
-- ADITIVA e IDEMPOTENTE: rodar duas vezes não duplica nem falha. As colunas
-- antigas product_id / offer_codes de dash_gestao_vendas_views NÃO são
-- apagadas, só relaxadas para NULL (o drop é a última fatia do PRD). Código
-- antigo que ainda grave nelas continua funcionando, mas SÓ a tabela filha é
-- lida pelas RPCs: aplicar esta migration ANTES do deploy do código novo e,
-- se alguma visualização for criada pelo código antigo entre as duas coisas,
-- rodar a migration de novo (o passo 3 copia só visualizações sem linha filha).
--
-- ── ASSINATURAS ─────────────────────────────────────────────────────────────
--   view_sales  (p_view_id uuid, p_start date default null, p_end date default null)
--     returns table (transaction_code text, offer_code text, status text,
--                    approved_date timestamptz, approved_day date,
--                    approved_hour text, product_id text)       -- product_id NOVO (no fim)
--   view_kpis / view_daily / view_hourly: assinatura INALTERADA.
--   view_offers (p_view_id uuid, p_start date default null, p_end date default null)
--     returns table (product_id text, product_name text,
--                    offer_code text, offer_name text,
--                    sales bigint, refunded bigint)             -- product_* NOVOS (no início)
--     Uma linha por (produto, oferta) da allowlist, inclusive com 0 vendas.
--
-- O FUSO CONTINUA ESCRITO EM UM ÚNICO LUGAR: dash_gestao_vendas_view_sales.

-- ── 1. Tabela filha ─────────────────────────────────────────────────────────
create table if not exists public.dash_gestao_vendas_view_products (
  id          uuid        primary key default gen_random_uuid(),
  view_id     uuid        not null references public.dash_gestao_vendas_views(id) on delete cascade,
  product_id  text        not null references public.dash_gestao_hotmart_products(product_id),
  offer_codes text[]      not null,
  created_at  timestamptz not null default now(),

  constraint uq_vendas_view_products unique (view_id, product_id),
  constraint chk_vendas_view_products_offer_codes
    check (public.dash_gestao_vendas_offer_codes_valid(offer_codes))
);

create index if not exists idx_vendas_view_products_product_id
  on public.dash_gestao_vendas_view_products (product_id);

-- RLS de leitura como a 070; escrita via service_role (ignora RLS).
alter table public.dash_gestao_vendas_view_products enable row level security;

drop policy if exists "Authenticated users can read vendas view products"
  on public.dash_gestao_vendas_view_products;
create policy "Authenticated users can read vendas view products"
  on public.dash_gestao_vendas_view_products
  for select
  to authenticated
  using (true);

-- ── 2. Colunas antigas viram opcionais ──────────────────────────────────────
alter table public.dash_gestao_vendas_views alter column product_id  drop not null;
alter table public.dash_gestao_vendas_views alter column offer_codes drop not null;

-- O check da 070 reprova NULL (a função devolve false); recria aceitando NULL.
alter table public.dash_gestao_vendas_views drop constraint if exists chk_vendas_views_offer_codes;
alter table public.dash_gestao_vendas_views
  add constraint chk_vendas_views_offer_codes
  check (offer_codes is null or public.dash_gestao_vendas_offer_codes_valid(offer_codes));

-- ── 3. Cópia das visualizações existentes (1 linha filha cada) ──────────────
-- NOT EXISTS: visualização que já tem linha filha não é copiada de novo; sem
-- isso, rodar a migration outra vez ressuscitaria um produto removido na edição.
insert into public.dash_gestao_vendas_view_products (view_id, product_id, offer_codes)
select v.id, v.product_id, v.offer_codes
from public.dash_gestao_vendas_views v
where v.product_id is not null
  and v.offer_codes is not null
  and not exists (
    select 1 from public.dash_gestao_vendas_view_products vp where vp.view_id = v.id
  )
on conflict (view_id, product_id) do nothing;

-- ── 4. Imutabilidade do product_id cai; vira "mínimo de 1 produto" ──────────
create or replace function public.dash_gestao_vendas_views_guard()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

-- Constraint trigger DEFERRED: dentro de uma transação dá para trocar a lista
-- inteira (apaga e insere); no commit a visualização precisa ter >= 1 produto.
-- Apagar a própria visualização (cascade) passa: ela não existe mais no commit.
create or replace function public.dash_gestao_vendas_view_products_min_one()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if exists (select 1 from public.dash_gestao_vendas_views where id = old.view_id)
     and not exists (
       select 1 from public.dash_gestao_vendas_view_products where view_id = old.view_id
     ) then
    raise exception 'uma visualização precisa ter ao menos 1 produto'
      using errcode = 'UV002';
  end if;
  return null;
end;
$fn$;

drop trigger if exists trg_vendas_view_products_min_one on public.dash_gestao_vendas_view_products;
create constraint trigger trg_vendas_view_products_min_one
  after delete or update of view_id on public.dash_gestao_vendas_view_products
  deferrable initially deferred
  for each row execute function public.dash_gestao_vendas_view_products_min_one();

-- ── 5. RPC base: view_sales (ÚNICO lugar com o fuso) ────────────────────────
-- O retorno ganha product_id, então a função é recriada (create or replace não
-- muda o tipo de retorno). As RPCs consumidoras abaixo são recriadas no mesmo
-- arquivo.
drop function if exists public.dash_gestao_vendas_view_sales(uuid, date, date);
create function public.dash_gestao_vendas_view_sales(
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
  approved_hour    text,
  product_id       text
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
    ) as approved_hour,
    s.product_id
  from public.dash_gestao_vendas_view_products vp
  join public.dash_gestao_hotmart_sales s
    on s.product_id = vp.product_id
   and s.offer_code = any (vp.offer_codes)
  where vp.view_id = p_view_id
    and s.approved_date is not null
    and s.status in ('APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK')
    and (p_start is null
         or (s.approved_date at time zone 'America/Sao_Paulo')::date >= p_start)
    and (p_end is null
         or (s.approved_date at time zone 'America/Sao_Paulo')::date <= p_end);
$$;

-- ── 6. KPIs, dia, hora: assinatura inalterada, só consomem view_sales ───────
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

-- ── 7. view_offers: uma linha por (produto, oferta), inclusive com 0 vendas ─
drop function if exists public.dash_gestao_vendas_view_offers(uuid, date, date);
create function public.dash_gestao_vendas_view_offers(
  p_view_id uuid,
  p_start   date default null,
  p_end     date default null
)
returns table (
  product_id   text,
  product_name text,
  offer_code   text,
  offer_name   text,
  sales        bigint,
  refunded     bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    vp.product_id                                                       as product_id,
    p.product_name                                                      as product_name,
    a.code                                                              as offer_code,
    o.offer_name                                                        as offer_name,
    count(vs.transaction_code) filter (where vs.status in ('APPROVED', 'COMPLETE'))   as sales,
    count(vs.transaction_code) filter (where vs.status in ('REFUNDED', 'CHARGEBACK')) as refunded
  from public.dash_gestao_vendas_view_products vp
  join public.dash_gestao_hotmart_products p
    on p.product_id = vp.product_id
  cross join lateral unnest(vp.offer_codes) as a(code)
  left join public.dash_gestao_hotmart_offers o
    on o.offer_code = a.code
   and o.product_id = vp.product_id
  left join public.dash_gestao_vendas_view_sales(p_view_id, p_start, p_end) vs
    on vs.product_id = vp.product_id
   and vs.offer_code = a.code
  where vp.view_id = p_view_id
  group by vp.product_id, p.product_name, a.code, o.offer_name
  order by sales desc, vp.product_id, a.code;
$$;

-- ── 8. Grants (mesma política do módulo: só service_role) ───────────────────
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

-- ── ROLLBACK (manual) ───────────────────────────────────────────────────────
-- Recriar view_sales/view_offers como na 070 (junção por dash_gestao_vendas_views),
-- recolocar o trigger de imutabilidade e então:
-- drop trigger if exists trg_vendas_view_products_min_one on public.dash_gestao_vendas_view_products;
-- drop function if exists public.dash_gestao_vendas_view_products_min_one();
-- drop table if exists public.dash_gestao_vendas_view_products;
