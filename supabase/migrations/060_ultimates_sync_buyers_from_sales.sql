-- Dash Ultimates: motor de materialização do modo "Apenas Compras" (migration
-- 059, PRD). O ciclo purchases_only não tem base de renovação — toda compra do
-- produto precisa aparecer no roster. Em vez de um caminho de leitura novo,
-- MATERIALIZAMOS cada email de venda contável como buyer do ciclo: aí a RPC de
-- roster, os KPIs e as ações Editar/Excluir já existentes funcionam sem
-- reescrita (as linhas passam a ter buyer_id e caem como
-- renovado/renovacao_reembolsada, que a UI reetiqueta para Compra).
--
-- ADITIVA POR CONTRATO: INSERT ... ON CONFLICT (cycle_id, email) DO NOTHING.
-- Email já existente (linha sincronizada antes OU corrigida à mão pelo gestor)
-- NÃO tem nome/telefone sobrescrito — a correção manual sobrevive a todo
-- refresh. NÃO reaproveitar dash_gestao_ultimates_replace_buyers: o delete+
-- reinsert dela apagaria edições e vínculos a cada sincronização.
--
-- UNIVERSO (idêntico ao que o roster mostra, para não materializar quem não
-- apareceria):
--   - vendas do product_id do ciclo;
--   - de oferta NÃO excluída (mesma precedência do roster, migration 052);
--   - com email não-vazio (normalizado como no resto da feature:
--     lower(btrim(...)), o mesmo idioma do índice da 049 e do replace_buyers);
--   - só emails que têm ao menos uma venda CONTÁVEL (aprovada OU estornada) —
--     o HAVING descarta emails só com vendas transitórias, que o roster também
--     não mostra. Estornos entram: é assim que "Compras reembolsadas" existe.
--
-- Nome/telefone seguem a mesma regra do roster para novo comprador (migration
-- 056): primeiro valor não-nulo entre as vendas do email, ordenado por
-- approved_date e desempatado por transaction_code para ser determinístico.
-- Como o INSERT é ON CONFLICT DO NOTHING, esses valores só valem na PRIMEIRA
-- materialização daquele email; depois a linha é do gestor.
--
-- Excluídos por email (migration 055) NÃO são filtrados aqui de propósito: a
-- exclusão de uma compra é justamente adicionar o email a excluded_buyers, e o
-- roster já esconde essas linhas na leitura. Reinserir a linha (ON CONFLICT DO
-- NOTHING) é inócuo e mantém a exclusão reversível.

-- UP
create or replace function public.dash_gestao_ultimates_sync_buyers_from_sales(
  p_cycle_id uuid
)
returns integer
language sql
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
  sales as (
    select
      lower(btrim(s.buyer_email))      as norm_email,
      nullif(btrim(s.buyer_name), '')  as buyer_name,
      nullif(btrim(s.buyer_phone), '') as buyer_phone,
      s.status,
      s.approved_date,
      s.transaction_code
    from public.dash_gestao_hotmart_sales s
    cross join cyc
    where s.product_id = cyc.product_id
      and not exists (
        select 1 from excluded ex where ex.offer_code = s.offer_code
      )
      and nullif(btrim(lower(s.buyer_email)), '') is not null
  ),
  agg as (
    select
      norm_email as email,
      (array_agg(buyer_name order by approved_date asc nulls last, transaction_code)
         filter (where buyer_name is not null))[1]  as name,
      (array_agg(buyer_phone order by approved_date asc nulls last, transaction_code)
         filter (where buyer_phone is not null))[1] as phone
    from sales
    group by norm_email
    having bool_or(
      status in ('APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')
    )
  ),
  inserted as (
    insert into public.dash_gestao_ultimates_buyers (cycle_id, email, name, phone)
    select p_cycle_id, a.email, a.name, a.phone
    from agg a
    on conflict (cycle_id, email) do nothing
    returning 1
  )
  select count(*)::int from inserted;
$$;

-- Escrita via service_role (como replace_buyers): a rota de refresh chama com o
-- service client. authenticated não pode executar (materializa dados pessoais).
revoke execute on function public.dash_gestao_ultimates_sync_buyers_from_sales(uuid)
  from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_sync_buyers_from_sales(uuid)
  to service_role;

-- DOWN
-- drop function if exists public.dash_gestao_ultimates_sync_buyers_from_sales(uuid);
