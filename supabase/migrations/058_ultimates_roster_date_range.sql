-- Dash Ultimates: recorte do roster por intervalo de datas.
-- (Spec docs/SPEC_2026-07-31_ultimates_filtro_datas.md.)
--
-- PROBLEMA: o dashboard ganhou um filtro De/Até, e o roster é a única das três
-- fontes que NÃO pode ser recortada no cliente. Ele expõe `renewed_at`, mas
-- isso é min(approved_date) filter (where status in ('APPROVED','COMPLETE')) —
-- um agregado, com dois furos fatais para o recorte:
--   (a) quem comprou em 05/07 e de novo em 15/07 tem renewed_at = 05/07 e
--       sumiria de um intervalo 10–20/07 no qual comprou de verdade;
--   (b) linha 'renovacao_reembolsada' não tem venda aprovada por definição,
--       então renewed_at é NULL e ela cairia fora de QUALQUER intervalo — o
--       tile "Renovação reembolsada" mostraria 0 sempre.
-- Aqui embaixo as vendas ainda estão desagregadas, e o recorte é exato.
--
-- SOLUÇÃO: dois parâmetros opcionais e UM filtro, no CTE `attributed` — por
-- onde toda venda passa antes de qualquer agregação. Restringir ali propaga o
-- recorte de graça para base_sales_agg e new_sales_agg, e as categorias caem
-- sozinhas no lugar certo: quem não tem venda na janela vira 'nao_renovado',
-- quem só tem reembolso na janela vira 'renovacao_reembolsada'.
--
-- ::date, e não um range de timestamptz, porque é EXATAMENTE a expressão que
-- dash_gestao_ultimates_daily usa para montar o bucket `day` (migration 051).
-- Os dois recortes concordam por construção, não por coincidência — e é isso
-- que faz o número do tile bater com o topo da curva do gráfico.
--
-- DROP + CREATE (e não CREATE OR REPLACE) porque a LISTA DE ARGUMENTOS muda: o
-- Postgres trata (uuid) e (uuid, date, date) como funções distintas, e um
-- CREATE OR REPLACE deixaria as duas vivas — aí `rpc(..., { p_cycle_id })`
-- ficaria ambíguo e falharia com "function is not unique". Os grants morrem
-- com o DROP e são reaplicados no fim, como a 051 e a 055 já precisaram fazer.
--
-- COMPATIBILIDADE: os defaults null preservam o chamador de um argumento, então
-- GET /roster sem query string continua idêntico e nenhum código existente
-- quebra ao aplicar esta migration.
--
-- ORDEM DE APLICAÇÃO: exige a 056 aplicada — o corpo abaixo é o dela, verbatim,
-- com as duas condições novas em `attributed` como única diferença.
-- Fila deste ambiente: 052 → 055 → 056 → 058.

-- UP

drop function if exists public.dash_gestao_ultimates_roster(uuid);

create function public.dash_gestao_ultimates_roster(
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
  attributed as (
    select
      s.transaction_code,
      lower(btrim(s.buyer_email)) as norm_email,
      -- (a) Identidade vinda da Hotmart. A gravação é crua (só trim no
      -- coletor); a normalização acontece aqui, na leitura, no mesmo idioma de
      -- buyer_email. O nullif protege contra linhas gravadas com string vazia
      -- por versões anteriores do coletor ou por payload de webhook com campo
      -- em branco.
      nullif(btrim(s.buyer_name), '')  as buyer_name,
      nullif(btrim(s.buyer_phone), '') as buyer_phone,
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
      and not exists (
        select 1 from excluded ex where ex.offer_code = s.offer_code
      )
      and not exists (
        select 1 from excluded_buyers eb where eb.email = lower(btrim(s.buyer_email))
      )
      and not exists (
        select 1 from excluded_links el where el.transaction_code = s.transaction_code
      )
      -- Recorte por intervalo. Null em qualquer ponta = sem limite naquele
      -- lado, entao (null, null) reproduz o roster do ciclo inteiro linha por
      -- linha. Venda com approved_date null nunca entra num intervalo — vale
      -- para reembolso sem data de aprovacao, risco 1 do spec.
      and (p_start is null or s.approved_date::date >= p_start)
      and (p_end   is null or s.approved_date::date <= p_end)
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
      -- (b) Primeiro valor NÃO-NULO entre TODAS as vendas deste email.
      --
      -- SEM filter de status, de propósito, e esta é a diferença que importa:
      -- todos os campos acima são filtrados por vendas aprovadas, mas a
      -- categoria 'novo_reembolsado' NÃO TEM venda aprovada por definição.
      -- Filtrar aqui deixaria justamente essas linhas anônimas para sempre.
      --
      -- MESMA ordenação do transaction_code (aprovada mais antiga primeiro),
      -- desempatada por transaction_code para ser determinística quando
      -- approved_date é null nas duas — sem o desempate, o nome exibido podia
      -- mudar entre dois refreshes sem nada ter mudado na Hotmart.
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
      -- (c) Antes: null::text as name / null::text as phone.
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

-- Grants reaplicados: o DROP acima os levou junto. Mesma política das demais
-- RPCs do módulo — só o service_role lê (a API chama com a service key;
-- liberar authenticated exporia dados de compradores via PostgREST).
revoke execute on function public.dash_gestao_ultimates_roster(uuid, date, date) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_roster(uuid, date, date) to service_role;

-- DOWN
-- drop function if exists public.dash_gestao_ultimates_roster(uuid, date, date);
-- e reaplicar a definição de um argumento da migration 056, seguida de:
--   revoke execute on function public.dash_gestao_ultimates_roster(uuid) from public, anon, authenticated;
--   grant  execute on function public.dash_gestao_ultimates_roster(uuid) to service_role;
