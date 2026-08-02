-- Dash Ultimates: fuso horário do recorte e registro por venda.
-- (Spec docs/SPEC_2026-08-02_ultimates_fuso_registro_por_venda.md.)
--
-- PROBLEMA 1 — FUSO. roster e daily comparavam `s.approved_date::date`. O cast
-- de timestamptz para date usa o TimeZone da sessão, que no PostgREST é UTC:
-- pedir 01–02/08 devolvia, na prática, 01/08 21:00 BRT → 02/08 20:59 BRT. Duas
-- compras de 31/07 à noite apareciam dentro da janela de 01/08. hourly JÁ
-- estava certa (migration 054) — o resultado é que o gráfico por dia e o por
-- hora do mesmo ciclo discordavam entre si.
--
-- A causa é duplicação: roster, daily e hourly repetiam o MESMO bloco de ~47
-- linhas de CTEs. Alguém corrigiu o fuso numa cópia e não nas outras. Por isso
-- a correção aqui não é trocar a expressão em três lugares: é criar UM lugar.
-- dash_gestao_ultimates_cycle_sales passa a ser a única função do módulo que
-- escreve fuso horário. Quem consome nunca mais escreve expressão de data.
--
-- PROBLEMA 2 — GRANULARIDADE. No modo Apenas Compras o objeto do ciclo é a
-- COMPRA, não a pessoa, mas o roster agrega por comprador: quem comprou duas
-- vezes ocupava uma linha só e a segunda compra sumia do KPI, da tabela e do
-- CSV. dash_gestao_ultimates_purchases devolve uma linha por venda NO SHAPE
-- EXATO DA ROSTER — é isso que deixa derivePurchaseKpis, RosterTable e
-- buildRosterCsv sem uma linha de alteração.
--
-- ORDEM DE APLICAÇÃO: exige 061 e 062 aplicadas. Fila deste ambiente:
-- 061 → 062 → 063 → 064.

-- UP

-- ── 1. Fonte única: vendas atribuídas do ciclo ──────────────────────────────
-- NÃO filtra status de propósito: a roster precisa de todos os status para
-- categorizar, e daily/hourly filtram aprovados por conta própria. O filtro
-- fica em quem consome, exatamente como antes.
--
-- Venda com approved_date null continua fora de QUALQUER janela: approved_day
-- vira null, a comparação vira null, a linha cai. É o "risco 1" da 058,
-- mantido de propósito — corrigi-lo aqui seria mudar comportamento de
-- contrabando, numa migration que já muda dois.
--
-- CUIDADO: RETURNS TABLE põe os nomes de saída em escopo. Toda referência de
-- coluna aqui dentro é qualificada (s., cp., eo., ...) porque um `status` ou
-- um `product_id` solto vira erro de ambiguidade — a armadilha documentada na
-- migration 061.
create or replace function public.dash_gestao_ultimates_cycle_sales(
  p_cycle_id uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  transaction_code text,
  product_id       text,
  offer_code       text,
  status           text,
  currency         text,
  price            numeric,
  approved_date    timestamptz,
  approved_day     date,
  approved_hour    text,
  norm_email       text,
  buyer_name       text,
  buyer_phone      text,
  matched_buyer_id uuid,
  via_link         boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with prods as (
    select cp.product_id as pid
    from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
  ),
  excluded_offers as (
    select eo.offer_code as code
    from public.dash_gestao_ultimates_excluded_offers eo
    where eo.cycle_id = p_cycle_id
  ),
  excluded_emails as (
    select eb.email as email
    from public.dash_gestao_ultimates_excluded_buyers eb
    where eb.cycle_id = p_cycle_id
  ),
  excluded_links as (
    select ml.transaction_code as tx
    from public.dash_gestao_ultimates_manual_links ml
    join public.dash_gestao_ultimates_buyers b on b.id = ml.buyer_id
    where ml.cycle_id = p_cycle_id
      and exists (
        select 1 from excluded_emails ee where ee.email = lower(btrim(b.email))
      )
  ),
  cycle_buyers as (
    select b.id as bid, lower(btrim(b.email)) as bemail
    from public.dash_gestao_ultimates_buyers b
    where b.cycle_id = p_cycle_id
      and not exists (
        select 1 from excluded_emails ee where ee.email = lower(btrim(b.email))
      )
  ),
  links as (
    select ml.transaction_code as tx, ml.buyer_id as bid
    from public.dash_gestao_ultimates_manual_links ml
    where ml.cycle_id = p_cycle_id
  )
  select
    s.transaction_code,
    s.product_id,
    s.offer_code,
    s.status,
    s.currency,
    s.price,
    s.approved_date,
    (s.approved_date at time zone 'America/Sao_Paulo')::date as approved_day,
    to_char(
      date_trunc('hour', s.approved_date at time zone 'America/Sao_Paulo'),
      'YYYY-MM-DD"T"HH24'
    ) as approved_hour,
    lower(btrim(s.buyer_email))      as norm_email,
    nullif(btrim(s.buyer_name), '')  as buyer_name,
    nullif(btrim(s.buyer_phone), '') as buyer_phone,
    coalesce(l.bid, cb.bid)          as matched_buyer_id,
    l.bid is not null                as via_link
  from public.dash_gestao_hotmart_sales s
  left join links l        on l.tx = s.transaction_code
  left join cycle_buyers cb on cb.bemail = lower(btrim(s.buyer_email))
  where s.product_id in (select prods.pid from prods)
    and not exists (
      select 1 from excluded_offers eo where eo.code = s.offer_code
    )
    and not exists (
      select 1 from excluded_emails ee where ee.email = lower(btrim(s.buyer_email))
    )
    and not exists (
      select 1 from excluded_links el where el.tx = s.transaction_code
    )
    and (p_start is null
         or (s.approved_date at time zone 'America/Sao_Paulo')::date >= p_start)
    and (p_end is null
         or (s.approved_date at time zone 'America/Sao_Paulo')::date <= p_end);
$$;

-- ── 2. Uma linha por VENDA, no shape da roster ──────────────────────────────
-- O retorno é IDÊNTICO ao de dash_gestao_ultimates_roster, e isso não é
-- coincidência: é o que permite a rota, o RosterTable, o derivePurchaseKpis e
-- o buildRosterCsv continuarem sem alteração. Só a granularidade muda.
--
-- total_value só existe para venda aprovada. Preserva a semântica do tile
-- "Valor total": antes um comprador só com estorno tinha total_value nulo e
-- contribuía zero; agora a linha estornada faz o mesmo.
--
-- matched_buyer_id nulo é tolerado — venda coletada depois do último
-- sync_buyers_from_sales. A linha aparece, só sem as ações de linha. Esconder
-- uma venda real seria pior, e o refresh seguinte materializa o comprador.
create or replace function public.dash_gestao_ultimates_purchases(
  p_cycle_id uuid,
  p_start    date default null,
  p_end      date default null
)
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
  from_manual_link boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cs.matched_buyer_id                        as buyer_id,
    coalesce(b.name, cs.buyer_name)            as name,
    coalesce(b.email, cs.norm_email)           as email,
    coalesce(b.phone, cs.buyer_phone)          as phone,
    coalesce(b.extra, '{}'::jsonb)             as extra,
    case
      when cs.status in ('APPROVED', 'COMPLETE') then 'renovado'
      else 'renovacao_reembolsada'
    end                                        as category,
    cs.approved_date                           as renewed_at,
    case
      when cs.status in ('APPROVED', 'COMPLETE') then cs.price
      else null
    end                                        as total_value,
    cs.transaction_code                        as transaction_code,
    cs.via_link                                as from_manual_link
  from public.dash_gestao_ultimates_cycle_sales(p_cycle_id, p_start, p_end) cs
  left join public.dash_gestao_ultimates_buyers b on b.id = cs.matched_buyer_id
  where cs.status in (
    'APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED'
  );
$$;

-- ── 3. Roster: mesma agregação por comprador, filtragem vinda da fonte única ─
-- CREATE OR REPLACE basta: assinatura e RETURNS TABLE idênticos, então os
-- grants sobrevivem. A CTE `attributed` deixa de reconstruir os filtros e
-- passa a ser um SELECT sobre cycle_sales — é aí, e só aí, que esta função
-- muda. Toda a agregação abaixo é a da 061, verbatim.
create or replace function public.dash_gestao_ultimates_roster(
  p_cycle_id uuid,
  p_start    date default null,
  p_end      date default null
)
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
  from_manual_link boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with buyers as (
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
        select 1
        from public.dash_gestao_ultimates_excluded_buyers eb
        where eb.cycle_id = p_cycle_id
          and eb.email = lower(btrim(b.email))
      )
  ),
  attributed as (
    select
      cs.transaction_code,
      cs.norm_email,
      cs.buyer_name,
      cs.buyer_phone,
      cs.status,
      cs.approved_date,
      cs.price,
      cs.matched_buyer_id,
      cs.via_link
    from public.dash_gestao_ultimates_cycle_sales(p_cycle_id, p_start, p_end) cs
  ),
  base_sales_agg as (
    select
      a.matched_buyer_id as buyer_id,
      bool_or(a.status in ('APPROVED', 'COMPLETE'))                     as has_approved,
      bool_or(a.status in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')) as has_refund,
      min(a.approved_date) filter (where a.status in ('APPROVED', 'COMPLETE')) as renewed_at,
      sum(a.price)         filter (where a.status in ('APPROVED', 'COMPLETE')) as total_value,
      (array_agg(a.transaction_code order by a.approved_date asc nulls last)
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as transaction_code,
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
  new_sales_agg as (
    select
      a.norm_email as email,
      bool_or(a.status in ('APPROVED', 'COMPLETE'))                     as has_approved,
      bool_or(a.status in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')) as has_refund,
      min(a.approved_date) filter (where a.status in ('APPROVED', 'COMPLETE')) as renewed_at,
      sum(a.price)         filter (where a.status in ('APPROVED', 'COMPLETE')) as total_value,
      (array_agg(a.transaction_code order by a.approved_date asc nulls last)
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as transaction_code,
      -- SEM filter de status de propósito: a categoria 'novo_reembolsado' não
      -- tem venda aprovada por definição, e filtrar aqui deixaria justamente
      -- essas linhas anônimas para sempre. Desempate por transaction_code para
      -- o nome exibido não mudar entre dois refreshes sem nada ter mudado.
      (array_agg(a.buyer_name order by a.approved_date asc nulls last, a.transaction_code)
         filter (where a.buyer_name is not null))[1]                    as name,
      (array_agg(a.buyer_phone order by a.approved_date asc nulls last, a.transaction_code)
         filter (where a.buyer_phone is not null))[1]                   as phone
    from attributed a
    where a.matched_buyer_id is null
      and a.norm_email is not null
      and a.norm_email <> ''
    group by a.norm_email
  ),
  new_roster as (
    select
      null::uuid   as buyer_id,
      nsa.name     as name,
      nsa.email    as email,
      nsa.phone    as phone,
      '{}'::jsonb  as extra,
      case
        when nsa.has_approved then 'novo_comprador'
        else 'novo_reembolsado'
      end          as category,
      nsa.renewed_at,
      nsa.total_value,
      nsa.transaction_code,
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

-- ── 4. Daily e Hourly: buckets vindos prontos da fonte única ────────────────
-- Nenhuma das duas volta a escrever expressão de data. daily passa a agrupar
-- por approved_day e hourly por approved_hour — ambos já em BRT. É esta troca
-- que faz o gráfico por dia parar de discordar do por hora.
--
-- Chamam cycle_sales SEM janela: continuam devolvendo o ciclo inteiro, e o
-- recorte do gráfico segue no cliente (keyInRange).
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
  select
    cs.approved_day                                        as day,
    count(*) filter (where cs.matched_buyer_id is not null) as renewals,
    count(*) filter (where cs.matched_buyer_id is null)     as new_buyers
  from public.dash_gestao_ultimates_cycle_sales(p_cycle_id) cs
  where cs.status in ('APPROVED', 'COMPLETE')
    and cs.approved_date is not null
    -- Ou pertence à base, ou tem email para virar novo comprador.
    and (cs.matched_buyer_id is not null or nullif(cs.norm_email, '') is not null)
  group by cs.approved_day
  order by cs.approved_day;
$$;

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
  select
    cs.approved_hour                                       as hour,
    count(*) filter (where cs.matched_buyer_id is not null) as renewals,
    count(*) filter (where cs.matched_buyer_id is null)     as new_buyers
  from public.dash_gestao_ultimates_cycle_sales(p_cycle_id) cs
  where cs.status in ('APPROVED', 'COMPLETE')
    and cs.approved_date is not null
    and (cs.matched_buyer_id is not null or nullif(cs.norm_email, '') is not null)
  group by cs.approved_hour
  order by cs.approved_hour;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- roster, daily e hourly preservam os grants (CREATE OR REPLACE não os
-- derruba). cycle_sales e purchases são novas. Mesma política de todo o
-- módulo: só service_role — a API chama com a service key, e liberar
-- authenticated exporia compradores e vendas via PostgREST.
revoke execute on function public.dash_gestao_ultimates_cycle_sales(uuid, date, date) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_cycle_sales(uuid, date, date) to service_role;

revoke execute on function public.dash_gestao_ultimates_purchases(uuid, date, date) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_purchases(uuid, date, date) to service_role;

-- DOWN
-- 1. drop function if exists public.dash_gestao_ultimates_purchases(uuid, date, date);
-- 2. Reaplicar roster, daily e hourly da migration 061 (corpos originais).
-- 3. drop function if exists public.dash_gestao_ultimates_cycle_sales(uuid, date, date);
--    Nesta ordem: purchases e as três reescritas dependem de cycle_sales.
-- ATENÇÃO: o rollback RESTAURA O BUG DE FUSO. roster e daily voltam a recortar
-- em UTC e a divergir do hourly.
