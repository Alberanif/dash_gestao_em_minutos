-- Dash Ultimates: RPCs de classificação (roster e daily) e substituição
-- atômica da base de compradores. (PRD issue #114, seções 4.2, 6.2, 3.5.)
--
-- A CLASSIFICAÇÃO É SEMPRE DERIVADA EM LEITURA — nunca armazenada. As duas
-- funções de leitura cruzam a base de compradores do ciclo
-- (dash_gestao_ultimates_buyers) com as vendas Hotmart do produto do ciclo
-- (dash_gestao_hotmart_sales), aplicando precedência de vínculo manual
-- (dash_gestao_ultimates_manual_links).
--
-- Universo de vendas: dash_gestao_hotmart_sales com product_id = produto do
-- ciclo. O join por email usa o índice
-- idx_hotmart_sales_product_buyer_email (product_id, lower(buyer_email))
-- criado na migration 049.
--
-- Colunas de dash_gestao_hotmart_sales usadas (todas verificadas contra o
-- mapeamento em src/lib/services/hotmart.ts:100-126 e migrations 038/046):
--   product_id text, status text, price numeric (preço da oferta já líquido
--   de encargos — base - total - fixed, ver hotmart.ts:113), approved_date
--   timestamptz, buyer_email text, transaction_code text.
--   NÃO existe coluna buyer_name na tabela (o coletor grava apenas
--   buyer_email; item.buyer.name da API NÃO é persistido) — por isso o
--   `name` dos novos compradores é sempre null.
--
-- Atribuição de uma venda a um comprador da base (usada em roster e daily):
--   1. vínculo manual tem PRECEDÊNCIA: se transaction_code está em
--      manual_links do ciclo, a venda conta para aquele buyer_id — mesmo que
--      o email da venda não esteja na base — e NUNCA aparece como novo
--      comprador;
--   2. senão, casa por lower(btrim(buyer_email)) = email normalizado do buyer.
--   matched_buyer_id = coalesce(link.buyer_id, buyer_por_email.id).
--
-- Status:
--   APPROVED / COMPLETE                                => renovação (aprovada)
--   REFUNDED / CHARGEBACK / CANCELLED / EXPIRED        => estorno
--   WAITING_PAYMENT / BILLET_PRINTED / demais          => transitório
--     (NÃO marcam nada — nem renovação nem estorno)
--
-- ── Dry-run dos critérios de aceite (issue #114) ────────────────────────────
--  A) Venda APPROVED de email na base ⇒ has_approved=true ⇒ 'renovado', com
--     renewed_at = min(approved_date aprovado) e total_value = sum(price
--     aprovado). Se depois o status virar REFUNDED (sem outra aprovada):
--     has_approved=false, has_refund=true ⇒ 'renovacao_reembolsada' na leitura
--     seguinte. Nova compra APPROVED ⇒ has_approved volta a true ⇒ 'renovado'.
--  B) Buyer da base sem nenhuma venda do produto (ou só transitórias):
--     has_approved=false, has_refund=false ⇒ 'nao_renovado'.
--  C) Venda com email fora da base e sem vínculo: matched_buyer_id null ⇒
--     candidato a novo comprador, agrupado por email normalizado. Aprovada ⇒
--     'novo_comprador'; só estorno ⇒ 'novo_reembolsado'; só transitória ⇒
--     não aparece no roster (filtro has_approved or has_refund).
--  D) Venda com vínculo manual: matched_buyer_id = link.buyer_id (não null) ⇒
--     conta para o buyer vinculado (entra em base_sales_agg) e é excluída dos
--     candidatos a novos (matched_buyer_id is null é falso). Some dos novos.
--  E) daily: conta só vendas APPROVED/COMPLETE atribuídas a um buyer da base
--     (matched_buyer_id not null), com approved_date not null, por dia. O
--     acúmulo ("renovações acumuladas", seção 3.5) é feito no cliente.
--  F) replace: DELETE dos emails removidos (cascade descarta seus
--     manual_links), UPDATE dos mantidos (preserva o id ⇒ preserva vínculos),
--     INSERT dos novos — numa única statement (transação única).

-- UP

-- ── 1. Roster: uma linha por comprador da base + uma por novo comprador ──────
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
  -- manual tem precedência sobre o casamento por email).
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
    -- Emails só com vendas transitórias não têm nada a mostrar.
    where nsa.has_approved or nsa.has_refund
  )
  select buyer_id, name, email, phone, extra, category, renewed_at, total_value, transaction_code
  from base_roster
  union all
  select buyer_id, name, email, phone, extra, category, renewed_at, total_value, transaction_code
  from new_roster;
$$;

-- ── 2. Daily: renovações aprovadas de compradores da base, por dia ──────────
create or replace function public.dash_gestao_ultimates_daily(p_cycle_id uuid)
returns table (
  day      date,
  renewals bigint
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
  approved_base_sales as (
    select s.approved_date::date as day
    from public.dash_gestao_hotmart_sales s
    cross join cyc
    left join links l on l.transaction_code = s.transaction_code
    left join buyers be on be.norm_email = lower(btrim(s.buyer_email))
    where s.product_id = cyc.product_id
      and s.status in ('APPROVED', 'COMPLETE')
      and s.approved_date is not null
      and coalesce(l.buyer_id, be.id) is not null
  )
  select day, count(*)::bigint as renewals
  from approved_base_sales
  group by day
  order by day;
$$;

-- ── 3. Substituição atômica da base preservando vínculos mantidos ───────────
-- Chamada pelo endpoint de upload via service_role. Uma única statement com
-- CTEs data-modifying = uma transação: nenhum leitor concorrente enxerga a
-- base vazia, e os três conjuntos de linhas (removidos / mantidos / novos) são
-- disjuntos por email, então não há conflito entre DELETE, UPDATE e INSERT.
create or replace function public.dash_gestao_ultimates_replace_buyers(
  p_cycle_id uuid,
  p_rows     jsonb
)
returns table (
  removed  int,
  updated  int,
  inserted int
)
language sql
as $$
  with parsed as (
    select
      lower(btrim(r.value->>'email'))                        as email,
      nullif(btrim(coalesce(r.value->>'name', '')), '')      as name,
      nullif(btrim(coalesce(r.value->>'phone', '')), '')     as phone,
      coalesce(r.value->'extra', '{}'::jsonb)                as extra,
      r.ordinality
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
      with ordinality as r(value, ordinality)
  ),
  -- Descarta emails vazios e deduplica por email normalizado (última linha
  -- vence).
  new_rows as (
    select distinct on (email) email, name, phone, extra
    from parsed
    where email is not null and email <> ''
    order by email, ordinality desc
  ),
  -- DELETE dos emails que saíram da base (cascade apaga seus manual_links).
  deleted as (
    delete from public.dash_gestao_ultimates_buyers b
    where b.cycle_id = p_cycle_id
      and not exists (
        select 1 from new_rows nr where nr.email = lower(btrim(b.email))
      )
    returning 1
  ),
  -- UPDATE dos emails mantidos: preserva o id do buyer ⇒ preserva os
  -- manual_links (que referenciam buyer_id). NÃO delete+reinsira estes.
  updated as (
    update public.dash_gestao_ultimates_buyers b
    set name = nr.name, phone = nr.phone, extra = nr.extra
    from new_rows nr
    where b.cycle_id = p_cycle_id
      and lower(btrim(b.email)) = nr.email
    returning 1
  ),
  -- INSERT dos emails novos (checagem contra o snapshot original da tabela).
  inserted as (
    insert into public.dash_gestao_ultimates_buyers (cycle_id, email, name, phone, extra)
    select p_cycle_id, nr.email, nr.name, nr.phone, nr.extra
    from new_rows nr
    where not exists (
      select 1 from public.dash_gestao_ultimates_buyers b
      where b.cycle_id = p_cycle_id
        and lower(btrim(b.email)) = nr.email
    )
    returning 1
  )
  select
    (select count(*)::int from deleted)  as removed,
    (select count(*)::int from updated)  as updated,
    (select count(*)::int from inserted) as inserted;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Leituras: estáveis, liberadas a authenticated. Rodam como SECURITY DEFINER
-- com search_path pinado (mesmo idioma de get_hotmart_metrics, migration 035):
-- dash_gestao_hotmart_sales foi criada fora do controle de migrations e não há
-- policy de SELECT para authenticated nela, então uma rota que chame estas RPCs
-- com o client de sessão do usuário veria zero linhas do join sob RLS
-- (todos virariam nao_renovado silenciosamente). O definer contorna isso; todos
-- os identificadores já são schema-qualified e o search_path fica pinado como
-- defesa extra.
grant execute on function public.dash_gestao_ultimates_roster(uuid) to authenticated, service_role;
grant execute on function public.dash_gestao_ultimates_daily(uuid)  to authenticated, service_role;

-- Escrita: apenas service_role (é operação de substituição da base).
revoke execute on function public.dash_gestao_ultimates_replace_buyers(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_replace_buyers(uuid, jsonb) to service_role;

-- DOWN
-- drop function if exists public.dash_gestao_ultimates_replace_buyers(uuid, jsonb);
-- drop function if exists public.dash_gestao_ultimates_daily(uuid);
-- drop function if exists public.dash_gestao_ultimates_roster(uuid);
