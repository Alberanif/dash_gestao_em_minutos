-- Dash Ultimates: série HORÁRIA do card "Evolução".
--
-- Espelho exato de dash_gestao_ultimates_daily na sua versão vigente (a da
-- migration 052, com o filtro de ofertas excluídas — NÃO a da 051). Só o
-- bucket muda: hora em vez de dia. Toda mudança futura no filtro de vendas
-- precisa ser aplicada nas duas funções.
--
-- FUSO: o bucket é convertido para America/Sao_Paulo, diferente da daily, que
-- agrega em UTC. É deliberado — a pergunta que o gráfico por hora responde é
-- "que horas eram no relógio de quem comprou", e 21h em Brasília cairia em
-- "00h do dia seguinte" se agregássemos em UTC. Consequência aceita: perto da
-- meia-noite as duas visões atribuem a mesma venda a buckets de fronteira
-- diferente. O total final é idêntico.
--
-- TIPO text, não timestamp: o bucket já é hora de parede em Brasília. Se
-- saísse como timestamp, o PostgREST o serializaria como "2026-07-30T14:00:00"
-- e o `new Date()` do navegador o reinterpretaria no fuso local, deslocando
-- tudo de novo. Como texto ele atravessa a stack sem que nenhuma camada tenha
-- a chance de "corrigi-lo" — mesmo motivo de fmtDateShort não usar Date.
-- Ordenação lexicográfica de YYYY-MM-DDTHH é ordenação cronológica.
--
-- A função devolve APENAS horas com venda. O preenchimento das horas vazias é
-- feito no cliente (buildHourlyCumulativeSeries): expandir aqui inflaria o
-- payload de algumas dezenas de linhas para todas as horas do intervalo, todas
-- carregando 0 e 0.

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
      -- Ou pertence à base, ou tem email para virar novo comprador.
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

-- Mesma política das demais RPCs do módulo (050/051/052): leitura só pelo
-- service_role — a API chama com a service key, e liberar authenticated
-- exporia dados de compradores via PostgREST direto.
revoke execute on function public.dash_gestao_ultimates_hourly(uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_hourly(uuid) to service_role;

-- Sem índice novo: o predicado é o mesmo da daily (product_id + status +
-- approved_date not null), já coberto por idx_hotmart_sales_product_buyer_email
-- e pelos índices de 034.

-- DOWN
-- drop function if exists public.dash_gestao_ultimates_hourly(uuid);
