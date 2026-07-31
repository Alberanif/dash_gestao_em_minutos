-- Dash Ultimates: excluir leads da contabilidade do ciclo.
-- (PRD docs/PRD_2026-07-30_ultimates_editar_roster.md.)
--
-- PROBLEMA: a base importada por CSV carrega emails de teste, internos e
-- duplicados. Eles nunca renovam, entram no denominador do % de renovação
-- (`base` em kpi-aggregation.ts) e afundam exatamente o número que o dashboard
-- existe para responder. A única saída até aqui era editar a planilha e
-- refazer o upload inteiro.
--
-- SOLUÇÃO: uma lista de emails por ciclo. A classificação continua sendo
-- DERIVADA EM LEITURA — nada é apagado, nem a linha de
-- dash_gestao_ultimates_buyers, nem venda alguma. "Excluir" é um filtro dentro
-- das RPCs, o que torna a operação integralmente reversível: remover a linha
-- devolve o lead inteiro (com vendas e vínculos) na leitura seguinte, sem
-- refresh nem reprocessamento.
--
-- DOIS LADOS (decisão 3 do PRD): o email sai da base E suas vendas saem do
-- universo de vendas. Sem a segunda metade, tirar alguém da base faria a
-- compra dele reaparecer como "novo comprador" e o % da meta subiria por dois
-- lados ao mesmo tempo.
--
-- PRECEDÊNCIA SOBRE O VÍNCULO MANUAL (regra 4.3 do PRD, mesma adotada para
-- ofertas excluídas na 052): uma venda vinculada manualmente a um lead
-- excluído também sai. Sem isso ela escaparia do filtro por email, continuaria
-- atribuída pela CTE `links` e apareceria como renovação em daily/hourly —
-- enquanto sumiria do roster, cujo join com a base não a encontraria. Tabela e
-- gráfico divergiriam.
--
-- ESTA MIGRATION TOCA AS TRÊS RPCs DE LEITURA. A 054 já avisava: "Toda mudança
-- futura no filtro de vendas precisa ser aplicada nas duas funções" — agora
-- são três (roster, daily, hourly).

-- UP

create table dash_gestao_ultimates_excluded_buyers (
  id          uuid        not null default gen_random_uuid() primary key,
  cycle_id    uuid        not null references dash_gestao_ultimates_cycles(id) on delete cascade,
  -- SEMPRE normalizado (lower(btrim(...))) na escrita — mesma expressão do
  -- join das RPCs. NÃO é FK para dash_gestao_ultimates_buyers de propósito: a
  -- chave precisa (a) alcançar o lado das vendas, onde só existe buyer_email,
  -- e (b) sobreviver ao delete+reinsert de
  -- dash_gestao_ultimates_replace_buyers, que troca o id de quem sai da
  -- planilha e volta depois. Chaveada por buyer_id, a exclusão seria perdida
  -- em silêncio no upload seguinte.
  email       text        not null,
  note        text,
  excluded_by uuid        not null,
  created_at  timestamptz not null default now(),
  constraint uq_ultimates_excluded_buyers unique (cycle_id, email)
);

create index idx_ultimates_excluded_buyers_cycle_id
  on dash_gestao_ultimates_excluded_buyers (cycle_id);

alter table dash_gestao_ultimates_excluded_buyers enable row level security;

-- Sem policy de select para authenticated: a tabela contém emails de pessoas
-- reais e toda leitura do app passa pelo service_role nas rotas
-- /api/ultimates (com gate de papel), no mesmo idioma de
-- dash_gestao_ultimates_buyers e _manual_links (migration 049).

-- ── 1. Roster: filtro de leads excluídos + from_manual_link ─────────────────
-- DIFERENTE das 052/054, aqui o RETURNS TABLE MUDA (coluna from_manual_link),
-- e CREATE OR REPLACE não altera a assinatura de retorno. Por isso o DROP —
-- que derruba os grants e obriga a reaplicá-los abaixo, exatamente como a 051
-- precisou fazer.
drop function if exists public.dash_gestao_ultimates_roster(uuid);

create function public.dash_gestao_ultimates_roster(p_cycle_id uuid)
returns table (
  buyer_id         uuid,
  name             text,
  email            text,
  phone            text,
  extra            jsonb,
  category         text,
  renewed_at       timestamptz,
  total_value      numeric,
  transaction_code text,
  -- A renovação exposta em transaction_code veio de vínculo manual? É o que
  -- decide se "Desfazer vínculo" tem o que desfazer — antes disto a UI
  -- oferecia o botão em toda renovação e só descobria no 404 do DELETE.
  -- Sempre false nas linhas de novo comprador.
  from_manual_link boolean
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
  excluded_buyers as (
    select eb.email
    from public.dash_gestao_ultimates_excluded_buyers eb
    where eb.cycle_id = p_cycle_id
  ),
  -- Transações vinculadas manualmente a um lead excluído. Lê a TABELA de
  -- buyers, não a CTE abaixo: o lead que interessa aqui é justamente o que já
  -- foi filtrado dela.
  excluded_links as (
    select ml.transaction_code
    from public.dash_gestao_ultimates_manual_links ml
    join public.dash_gestao_ultimates_buyers b on b.id = ml.buyer_id
    where ml.cycle_id = p_cycle_id
      and exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(b.email))
      )
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
      and not exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(b.email))
      )
  ),
  links as (
    select ml.transaction_code, ml.buyer_id
    from public.dash_gestao_ultimates_manual_links ml
    where ml.cycle_id = p_cycle_id
  ),
  -- Vendas do produto do ciclo, com o buyer_id da base atribuído (vínculo
  -- manual tem precedência sobre o casamento por email). Vendas de oferta
  -- excluída ou de lead excluído não chegam até aqui — logo não são atribuídas
  -- a ninguém, não classificam ninguém e não entram em nenhuma agregação.
  attributed as (
    select
      s.transaction_code,
      lower(btrim(s.buyer_email)) as norm_email,
      s.status,
      s.approved_date,
      s.price,
      coalesce(l.buyer_id, be.id) as matched_buyer_id,
      l.buyer_id is not null      as via_link
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
      and not exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(s.buyer_email))
      )
      and not exists (
        select 1 from excluded_links el where el.transaction_code = s.transaction_code
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
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as transaction_code,
      -- MESMA ordenação do transaction_code acima, de propósito: os dois
      -- precisam se referir à mesma venda, senão o botão "Desfazer vínculo"
      -- apareceria apontando para uma transação que não veio de vínculo.
      (array_agg(a.via_link order by a.approved_date asc nulls last)
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as from_manual_link
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
      agg.transaction_code,
      coalesce(agg.from_manual_link, false) as from_manual_link
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
      nsa.transaction_code,
      -- Por definição: se tivesse vínculo, teria matched_buyer_id.
      false        as from_manual_link
    from new_sales_agg nsa
    where nsa.has_approved or nsa.has_refund
  )
  select buyer_id, name, email, phone, extra, category, renewed_at, total_value,
         transaction_code, from_manual_link
  from base_roster
  union all
  select buyer_id, name, email, phone, extra, category, renewed_at, total_value,
         transaction_code, from_manual_link
  from new_roster;
$$;

-- ── 2. Daily: mesmo filtro de leads excluídos ───────────────────────────────
-- RETURNS TABLE inalterado, então CREATE OR REPLACE basta e os grants da
-- 051/052 sobrevivem.
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
  excluded_buyers as (
    select eb.email
    from public.dash_gestao_ultimates_excluded_buyers eb
    where eb.cycle_id = p_cycle_id
  ),
  excluded_links as (
    select ml.transaction_code
    from public.dash_gestao_ultimates_manual_links ml
    join public.dash_gestao_ultimates_buyers b on b.id = ml.buyer_id
    where ml.cycle_id = p_cycle_id
      and exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(b.email))
      )
  ),
  buyers as (
    select b.id, lower(btrim(b.email)) as norm_email
    from public.dash_gestao_ultimates_buyers b
    where b.cycle_id = p_cycle_id
      and not exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(b.email))
      )
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
      and not exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(s.buyer_email))
      )
      and not exists (
        select 1 from excluded_links el where el.transaction_code = s.transaction_code
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

-- ── 3. Hourly: espelho exato da daily acima, só o bucket muda ───────────────
create or replace function public.dash_gestao_ultimates_hourly(p_cycle_id uuid)
returns table (
  hour       text,
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
  excluded_buyers as (
    select eb.email
    from public.dash_gestao_ultimates_excluded_buyers eb
    where eb.cycle_id = p_cycle_id
  ),
  excluded_links as (
    select ml.transaction_code
    from public.dash_gestao_ultimates_manual_links ml
    join public.dash_gestao_ultimates_buyers b on b.id = ml.buyer_id
    where ml.cycle_id = p_cycle_id
      and exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(b.email))
      )
  ),
  buyers as (
    select b.id, lower(btrim(b.email)) as norm_email
    from public.dash_gestao_ultimates_buyers b
    where b.cycle_id = p_cycle_id
      and not exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(b.email))
      )
  ),
  links as (
    select ml.transaction_code, ml.buyer_id
    from public.dash_gestao_ultimates_manual_links ml
    where ml.cycle_id = p_cycle_id
  ),
  approved_sales as (
    select
      to_char(
        date_trunc('hour', s.approved_date at time zone 'America/Sao_Paulo'),
        'YYYY-MM-DD"T"HH24'
      )                                              as hour,
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
      and not exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(s.buyer_email))
      )
      and not exists (
        select 1 from excluded_links el where el.transaction_code = s.transaction_code
      )
      and (
        coalesce(l.buyer_id, be.id) is not null
        or nullif(btrim(lower(s.buyer_email)), '') is not null
      )
  )
  select
    hour,
    (count(*) filter (where is_base))     as renewals,
    (count(*) filter (where not is_base)) as new_buyers
  from approved_sales
  group by hour
  order by hour;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- daily e hourly preservam os grants anteriores (CREATE OR REPLACE não os
-- derruba). O roster foi DROPADO acima, então os dele PRECISAM ser reaplicados
-- — sem isto a rota /api/ultimates/cycles/[id]/roster passa a falhar com
-- "permission denied for function".
revoke execute on function public.dash_gestao_ultimates_roster(uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_roster(uuid) to service_role;

-- DOWN
-- Reaplicar dash_gestao_ultimates_roster da migration 052 (sem
-- from_manual_link e sem os CTEs excluded_buyers/excluded_links), incluindo o
-- revoke/grant, e dash_gestao_ultimates_daily da 052 e
-- dash_gestao_ultimates_hourly da 054, nesta ordem, e só então:
-- drop table if exists dash_gestao_ultimates_excluded_buyers;
