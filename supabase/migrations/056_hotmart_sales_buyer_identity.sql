-- Dash Ultimates: nome e telefone dos novos compradores.
-- (PRD docs/PRD_2026-07-31_ultimates_nome_novos_compradores.md, issue #146.)
--
-- PROBLEMA: a linha de "novo comprador" do roster é derivada das vendas
-- Hotmart, e dash_gestao_hotmart_sales só guarda buyer_email. A API
-- sales/history DEVOLVE o nome do comprador (HotmartSaleItem.buyer.name), mas
-- mapHotmartSaleItem sempre o descartou — a migration 050 já registrava isso
-- como limitação conhecida. Sem coluna onde ler, a RPC emite literalmente
-- `null::text as name` para essas linhas, e o gestor vê uma lista de emails
-- sem conseguir reconhecer ninguém — justamente quando precisa decidir se
-- aquilo é gente nova ou alguém da base que comprou com outro email.
--
-- SOLUÇÃO: duas colunas nullable em dash_gestao_hotmart_sales, alimentadas
-- pelos coletores, e o roster passa a lê-las nas linhas com buyer_id null.
-- Nenhuma classificação é armazenada: a categoria continua derivada em leitura,
-- e estas colunas são identidade, não contabilidade.
--
-- ASSIMETRIA DAS DUAS COLUNAS (regra 4.1 do PRD) — é da Hotmart, não escolha
-- nossa:
--   buyer_name  ← API sales/history E webhook  (cron diário, cron semanal,
--                 "Atualizar agora" e webhook escrevem)
--   buyer_phone ← SOMENTE o webhook (data.buyer.checkout_phone). A API de
--                 vendas não devolve telefone, então NÃO HÁ BACKFILL POSSÍVEL:
--                 a coluna só se preenche para compras recebidas em tempo real
--                 depois do deploy, e ficará visivelmente irregular.
--
-- ⚠️ POR QUE mapHotmartSaleItem NÃO PODE GRAVAR buyer_phone: o upsert do
-- PostgREST (onConflict: transaction_code) só atualiza as colunas PRESENTES no
-- payload. Como o cron semanal reescreve 60 dias de vendas passando por aquela
-- função, incluir a chave lá — mesmo como null — apagaria todos os telefones
-- gravados pelo webhook, em silêncio, uma vez por semana. A proteção é uma
-- AUSÊNCIA de linha, guardada por teste em
-- src/lib/services/__tests__/hotmart-map-sale.test.ts.
--
-- ORDEM DE APLICAÇÃO: esta migration exige a 055 já aplicada. O corpo do roster
-- abaixo é o dela (com excluded_buyers/excluded_links e from_manual_link) e
-- referencia dash_gestao_ultimates_excluded_buyers; o Postgres valida o corpo
-- na criação, então aplicar fora de ordem falha. Fila deste ambiente:
-- 052 → 055 → 056.

-- UP

-- ── 1. Colunas de identidade ────────────────────────────────────────────────
-- Sem índice: nenhum filtro, join ou ordenação usa estes campos — eles só são
-- projetados. Sem default: ausência de dado é null, não string vazia.
alter table dash_gestao_hotmart_sales
  add column buyer_name  text,
  add column buyer_phone text;

-- ── 2. Roster: novo comprador deixa de ser anônimo ──────────────────────────
-- RETURNS TABLE INALTERADO (name e phone já estavam na assinatura, sempre
-- devolvidos como null nestas linhas). Por isso CREATE OR REPLACE basta e os
-- GRANTS SOBREVIVEM — nada de DROP aqui, ao contrário do que a 051 e a 055
-- precisaram fazer. Não reaplique grants.
--
-- Diferenças em relação à 055, e só elas: (a) attributed carrega os dois campos
-- novos, (b) new_sales_agg os agrega, (c) new_roster os projeta no lugar dos
-- literais null. base_roster fica intacta: linha da base continua com o nome do
-- CSV, sem coalesce com a Hotmart (regra 4.6 do PRD) — a base tem edição
-- própria e o CSV é a fonte da verdade dela.
--
-- dash_gestao_ultimates_daily e _hourly NÃO são tocadas: contam vendas, não
-- expõem identidade.
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

-- Sem bloco de grants: CREATE OR REPLACE preserva os da 055.

-- DOWN
-- Reaplicar dash_gestao_ultimates_roster da migration 055 (com
-- `null::text as name` e `null::text as phone` em new_roster e sem os dois
-- campos em attributed/new_sales_agg) — também via CREATE OR REPLACE, sem
-- mexer em grants — e só então:
-- alter table dash_gestao_hotmart_sales
--   drop column if exists buyer_name,
--   drop column if exists buyer_phone;
