-- Dash Ultimates: série diária de novos compradores no card "Evolução".
--
-- A versão de 050 devolvia só (day, renewals) e filtrava as vendas para as
-- que pertencem a compradores da base. O card 2 passa a alternar entre duas
-- séries acumuladas — renovações e novos compradores — e as duas precisam
-- sair da MESMA agregação, para que compartilhem o eixo de dias e nunca
-- discordem entre si.
--
-- Novos compradores = exatamente o complemento do filtro anterior: venda
-- aprovada cujo email não está na base do ciclo e que não tem vínculo manual
-- (mesma regra que a categoria novo_comprador de dash_gestao_ultimates_roster).
-- Vendas sem email utilizável e sem vínculo ficam de fora das duas séries,
-- como já acontece no roster — assim nenhum dia entra no eixo com 0 e 0.
--
-- Só as aprovadas (APPROVED/COMPLETE) entram, como na 050: reembolso não vira
-- ponto na curva. O KPI "Novos Compradores" do card 1 soma também os
-- reembolsados, então o topo da curva pode ficar abaixo dele — é esperado.
--
-- DROP + CREATE (e não CREATE OR REPLACE) porque o RETURNS TABLE muda: o
-- Postgres não permite trocar o tipo de retorno de uma função existente. Os
-- grants morrem junto com a função e são reaplicados no fim do arquivo.

drop function if exists public.dash_gestao_ultimates_daily(uuid);

create function public.dash_gestao_ultimates_daily(p_cycle_id uuid)
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
  -- Uma linha por venda aprovada do produto do ciclo, classificada em base
  -- (renovação) ou não-base (novo comprador). O vínculo manual tem
  -- precedência sobre o casamento por email, igual ao roster.
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

-- Mesma política da 050: leitura só pelo service_role (a API chama com a
-- service key; authenticated liberaria dados de compradores via PostgREST).
revoke execute on function public.dash_gestao_ultimates_daily(uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_daily(uuid) to service_role;

-- DOWN
-- Rollback = reaplicar a definição de dash_gestao_ultimates_daily(uuid) da
-- migration 050 (drop function if exists ... antes, pelo mesmo motivo do topo).
