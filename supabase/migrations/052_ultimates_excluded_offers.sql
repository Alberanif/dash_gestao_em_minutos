-- Dash Ultimates: excluir ofertas da contabilidade do ciclo.
-- (PRD docs/PRD_2026-07-30_ultimates_excluir_ofertas.md.)
--
-- PROBLEMA: o ciclo conta TODA venda de dash_gestao_hotmart_sales com o
-- product_id do ciclo. Compras de teste/internas (cortesia, cupom 100%, equipe)
-- entram no mesmo produto sob uma oferta própria e inflam KPIs, roster e curva.
--
-- SOLUÇÃO: uma lista de offer_codes por ciclo. A classificação continua sendo
-- DERIVADA EM LEITURA — nada é apagado nem alterado em dash_gestao_hotmart_sales.
-- "Excluir" é um filtro no universo de vendas dentro das RPCs, o que torna a
-- operação integralmente reversível: remover a linha devolve as vendas à
-- contabilidade na leitura seguinte, sem refresh nem reprocessamento.
--
-- PRECEDÊNCIA (decisão 4 do PRD): o filtro entra ANTES dos joins de
-- manual_links e buyers, então a exclusão vence o vínculo manual. Um vínculo
-- apontando para venda de oferta excluída sobrevive na tabela, sem efeito, e
-- volta a valer se a oferta sair da lista.

-- UP

create table dash_gestao_ultimates_excluded_offers (
  id          uuid        not null default gen_random_uuid() primary key,
  cycle_id    uuid        not null references dash_gestao_ultimates_cycles(id) on delete cascade,
  -- FK segura: upsertPlaceholderOffers (src/lib/services/hotmart.ts) grava as
  -- ofertas ANTES do upsert das vendas — a FK de dash_gestao_hotmart_sales.
  -- offer_code já exige isso. Toda oferta com venda coletada existe aqui.
  offer_code  text        not null references dash_gestao_hotmart_offers(offer_code),
  note        text,
  excluded_by uuid        not null,
  created_at  timestamptz not null default now(),
  constraint uq_ultimates_excluded_offers unique (cycle_id, offer_code)
);

create index idx_ultimates_excluded_offers_cycle_id
  on dash_gestao_ultimates_excluded_offers (cycle_id);

alter table dash_gestao_ultimates_excluded_offers enable row level security;

-- Sem policy de select para authenticated: toda leitura do app passa pelo
-- service_role nas rotas /api/ultimates (com gate de papel), no mesmo idioma de
-- dash_gestao_ultimates_buyers e _manual_links (migration 049). A lista revela
-- quais ofertas de uma conta existem e quantas vendas têm — não é dado para
-- ficar exposto via PostgREST a qualquer usuário autenticado.

-- ── 1. Roster com filtro de ofertas excluídas ───────────────────────────────
-- Assinatura e RETURNS TABLE inalterados em relação à migration 050, então
-- CREATE OR REPLACE basta e os grants sobrevivem (só o DROP os derrubaria —
-- foi o que obrigou a 051 a reaplicá-los). Única mudança: o CTE `excluded` e a
-- condição no WHERE de `attributed`.
create or replace function public.dash_gestao_ultimates_roster(p_cycle_id uuid)
returns table (
  buyer_id         uuid,
  name             text,
  email            text,
  phone            text,
  extra            jsonb,
  category         text,
  renewed_at       timestamptz,
  total_value      numeric,
  transaction_code text
)
language sql
stable
security definer
set search_path = public
as $$
  with cyc as (
    select c.product_id
    from public.dash_gestao_ultimates_cycles c
    where c.id = p_cycle_id
  ),
  excluded as (
    select eo.offer_code
    from public.dash_gestao_ultimates_excluded_offers eo
    where eo.cycle_id = p_cycle_id
  ),
  buyers as (
    select
      b.id,
      b.email,
      lower(btrim(b.email)) as norm_email,
      b.name,
      b.phone,
      b.extra
    from public.dash_gestao_ultimates_buyers b
    where b.cycle_id = p_cycle_id
  ),
  links as (
    select ml.transaction_code, ml.buyer_id
    from public.dash_gestao_ultimates_manual_links ml
    where ml.cycle_id = p_cycle_id
  ),
  -- Vendas do produto do ciclo, com o buyer_id da base atribuído (vínculo
  -- manual tem precedência sobre o casamento por email). Vendas de oferta
  -- excluída não chegam até aqui — logo não são atribuídas a ninguém, não
  -- classificam ninguém e não entram em nenhuma agregação.
  attributed as (
    select
      s.transaction_code,
      lower(btrim(s.buyer_email)) as norm_email,
      s.status,
      s.approved_date,
      s.price,
      coalesce(l.buyer_id, be.id) as matched_buyer_id
    from public.dash_gestao_hotmart_sales s
    cross join cyc
    left join links l on l.transaction_code = s.transaction_code
    left join buyers be on be.norm_email = lower(btrim(s.buyer_email))
    where s.product_id = cyc.product_id
      -- Venda sem offer_code nunca é excluída: não há oferta a que associá-la.
      -- NOT EXISTS (e não NOT IN) para não depender do comportamento de NULL
      -- da subconsulta.
      and not exists (
        select 1 from excluded ex where ex.offer_code = s.offer_code
      )
  ),
  -- Agregação das vendas atribuídas a compradores da base.
  base_sales_agg as (
    select
      a.matched_buyer_id as buyer_id,
      bool_or(a.status in ('APPROVED', 'COMPLETE'))                     as has_approved,
      bool_or(a.status in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')) as has_refund,
      min(a.approved_date) filter (where a.status in ('APPROVED', 'COMPLETE')) as renewed_at,
      sum(a.price)         filter (where a.status in ('APPROVED', 'COMPLETE')) as total_value,
      (array_agg(a.transaction_code order by a.approved_date asc nulls last)
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as transaction_code
    from attributed a
    where a.matched_buyer_id is not null
    group by a.matched_buyer_id
  ),
  base_roster as (
    select
      b.id       as buyer_id,
      b.name     as name,
      b.email    as email,
      b.phone    as phone,
      b.extra    as extra,
      case
        when coalesce(agg.has_approved, false) then 'renovado'
        when coalesce(agg.has_refund, false)   then 'renovacao_reembolsada'
        else 'nao_renovado'
      end        as category,
      agg.renewed_at,
      agg.total_value,
      agg.transaction_code
    from buyers b
    left join base_sales_agg agg on agg.buyer_id = b.id
  ),
  -- Novos compradores: vendas sem buyer atribuído (email fora da base e sem
  -- vínculo), agrupadas por email normalizado.
  new_sales_agg as (
    select
      a.norm_email as email,
      bool_or(a.status in ('APPROVED', 'COMPLETE'))                     as has_approved,
      bool_or(a.status in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')) as has_refund,
      min(a.approved_date) filter (where a.status in ('APPROVED', 'COMPLETE')) as renewed_at,
      sum(a.price)         filter (where a.status in ('APPROVED', 'COMPLETE')) as total_value,
      (array_agg(a.transaction_code order by a.approved_date asc nulls last)
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as transaction_code
    from attributed a
    where a.matched_buyer_id is null
      and a.norm_email is not null
      and a.norm_email <> ''
    group by a.norm_email
  ),
  new_roster as (
    select
      null::uuid   as buyer_id,
      null::text   as name,
      nsa.email    as email,
      null::text   as phone,
      '{}'::jsonb  as extra,
      case
        when nsa.has_approved then 'novo_comprador'
        else 'novo_reembolsado'
      end          as category,
      nsa.renewed_at,
      nsa.total_value,
      nsa.transaction_code
    from new_sales_agg nsa
    where nsa.has_approved or nsa.has_refund
  )
  select buyer_id, name, email, phone, extra, category, renewed_at, total_value, transaction_code
  from base_roster
  union all
  select buyer_id, name, email, phone, extra, category, renewed_at, total_value, transaction_code
  from new_roster;
$$;

-- ── 2. Daily com filtro de ofertas excluídas ────────────────────────────────
-- Mesma mudança pontual sobre a definição da migration 051 (RETURNS TABLE com
-- renewals e new_buyers): CTE `excluded` + condição em `approved_sales`. As
-- duas séries saem da MESMA agregação, então nenhuma delas pode divergir do
-- roster quanto ao que foi excluído.
create or replace function public.dash_gestao_ultimates_daily(p_cycle_id uuid)
returns table (
  day        date,
  renewals   bigint,
  new_buyers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with cyc as (
    select c.product_id
    from public.dash_gestao_ultimates_cycles c
    where c.id = p_cycle_id
  ),
  excluded as (
    select eo.offer_code
    from public.dash_gestao_ultimates_excluded_offers eo
    where eo.cycle_id = p_cycle_id
  ),
  buyers as (
    select b.id, lower(btrim(b.email)) as norm_email
    from public.dash_gestao_ultimates_buyers b
    where b.cycle_id = p_cycle_id
  ),
  links as (
    select ml.transaction_code, ml.buyer_id
    from public.dash_gestao_ultimates_manual_links ml
    where ml.cycle_id = p_cycle_id
  ),
  approved_sales as (
    select
      s.approved_date::date                          as day,
      coalesce(l.buyer_id, be.id) is not null        as is_base
    from public.dash_gestao_hotmart_sales s
    cross join cyc
    left join links l on l.transaction_code = s.transaction_code
    left join buyers be on be.norm_email = lower(btrim(s.buyer_email))
    where s.product_id = cyc.product_id
      and s.status in ('APPROVED', 'COMPLETE')
      and s.approved_date is not null
      and not exists (
        select 1 from excluded ex where ex.offer_code = s.offer_code
      )
      -- Ou pertence à base, ou tem email para virar novo comprador.
      and (
        coalesce(l.buyer_id, be.id) is not null
        or nullif(btrim(lower(s.buyer_email)), '') is not null
      )
  )
  select
    day,
    (count(*) filter (where is_base))     as renewals,
    (count(*) filter (where not is_base)) as new_buyers
  from approved_sales
  group by day
  order by day;
$$;

-- ── 3. Opções de oferta do ciclo (alimenta o seletor do modal) ──────────────
-- Existe como RPC porque o client Supabase não agrega (precisamos de count por
-- offer_code) e porque dash_gestao_hotmart_sales não tem policy de select para
-- authenticated — a rota chama com o service client, como as demais.
--
-- Lista TODAS as ofertas do produto, inclusive is_active = false: oferta de
-- teste costuma ser desativada depois, e ainda assim precisa poder ser
-- excluída. sales_count conta vendas em qualquer status (o número serve para
-- o gestor reconhecer a oferta, não para contabilidade).
create or replace function public.dash_gestao_ultimates_offer_options(p_cycle_id uuid)
returns table (
  offer_code  text,
  offer_name  text,
  sales_count bigint,
  is_excluded boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with cyc as (
    select c.product_id
    from public.dash_gestao_ultimates_cycles c
    where c.id = p_cycle_id
  ),
  sales_agg as (
    select s.offer_code as code, count(*)::bigint as total
    from public.dash_gestao_hotmart_sales s
    cross join cyc
    where s.product_id = cyc.product_id
      and s.offer_code is not null
    group by s.offer_code
  )
  select
    o.offer_code,
    o.offer_name,
    coalesce(sa.total, 0) as sales_count,
    exists (
      select 1
      from public.dash_gestao_ultimates_excluded_offers eo
      where eo.cycle_id = p_cycle_id
        and eo.offer_code = o.offer_code
    ) as is_excluded
  from public.dash_gestao_hotmart_offers o
  cross join cyc
  left join sales_agg sa on sa.code = o.offer_code
  where o.product_id = cyc.product_id
  order by coalesce(sa.total, 0) desc, o.offer_name;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- roster e daily preservam os grants da 050/051 (CREATE OR REPLACE não os
-- derruba). A função nova segue a mesma política: só service_role.
revoke execute on function public.dash_gestao_ultimates_offer_options(uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_offer_options(uuid) to service_role;

-- DOWN
-- drop function if exists public.dash_gestao_ultimates_offer_options(uuid);
-- Reaplicar dash_gestao_ultimates_roster da migration 050 e
-- dash_gestao_ultimates_daily da migration 051 (as definições sem o CTE
-- `excluded`), nesta ordem, e só então:
-- drop table if exists dash_gestao_ultimates_excluded_offers;
