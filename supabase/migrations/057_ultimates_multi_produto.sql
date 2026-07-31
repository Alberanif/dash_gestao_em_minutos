-- Dash Ultimates: um ciclo passa a acompanhar N produtos Hotmart.
-- (Spec docs/superpowers/specs/2026-07-30-ultimates-multi-produto-design.md.)
--
-- PROBLEMA: dash_gestao_ultimates_cycles.product_id é uma coluna escalar, então
-- um público vendido sob mais de um product_id (plano anual + mensal, produto
-- migrado) exige um ciclo por produto. Somar os ciclos na mão SUPERESTIMA: quem
-- renovou nos dois aparece como renovado nos dois.
--
-- SOLUÇÃO: tabela de junção. Todas as vendas dos produtos do ciclo formam um
-- único universo; roster e KPIs continuam agrupando por comprador, então cada
-- pessoa conta uma vez só, com total_value somado entre os produtos.
--
-- ORDEM DESTE ARQUIVO IMPORTA: as RPCs precisam parar de referenciar
-- cycles.product_id ANTES do drop da coluna, senão o ALTER falha.
--
-- ORDEM ENTRE MIGRATIONS TAMBÉM IMPORTA: os corpos de roster/daily/hourly aqui
-- são os das 055 (leads excluídos, vínculos excluídos, from_manual_link) e 056
-- (buyer_name/buyer_phone do novo comprador) com a adaptação multi-produto
-- aplicada por cima — nada além dela. Aplicar esta migration ANTES daquelas
-- falha alto, não em silêncio: o roster bate em 42P13 (não dá para trocar o tipo
-- de retorno de uma função existente) e daily/hourly nem chegam a ser criadas,
-- porque o corpo referencia dash_gestao_ultimates_excluded_buyers, que a 055
-- ainda não teria criado. Fila: 052 → 053 → 054 → 055 → 056 → 057.
--
-- ARMADILHA CENTRAL: as versões anteriores usavam `cross join cyc`, seguro
-- porque cyc tinha exatamente uma linha. Com N produtos um cross join
-- MULTIPLICARIA CADA VENDA POR N — sem erro, sem exceção, só KPI e curva
-- inflados. Nenhuma das quatro funções pode manter cross join; todas passam a
-- filtrar com `in (select prods.product_id from prods)`.
--
-- Referências de coluna dentro das funções são sempre qualificadas: RETURNS
-- TABLE põe os nomes de saída em escopo, e `product_id` solto em
-- dash_gestao_ultimates_offer_options viraria erro de ambiguidade.

-- UP

-- ── 1. Tabela de junção ─────────────────────────────────────────────────────
create table dash_gestao_ultimates_cycle_products (
  cycle_id   uuid        not null references dash_gestao_ultimates_cycles(id) on delete cascade,
  product_id text        not null references dash_gestao_hotmart_products(product_id),
  created_at timestamptz not null default now(),
  primary key (cycle_id, product_id)
);

-- Sem índice extra em product_id: o único acesso das RPCs é por cycle_id, já
-- coberto pelo prefixo da PK. Busca reversa ("que ciclos acompanham o produto
-- X") não existe em lugar nenhum do código.

alter table dash_gestao_ultimates_cycle_products enable row level security;

-- Espelha a policy de dash_gestao_ultimates_cycles: esta informação vivia numa
-- coluna legível por authenticated até esta migration. Manter a leitura não é
-- regressão nem ganho de privacidade — é o mesmo dado, na mesma visibilidade.
-- A aplicação não depende dela (toda leitura passa pelo service client).
create policy "Authenticated users can read ultimates cycle products"
  on dash_gestao_ultimates_cycle_products
  for select
  to authenticated
  using (true);

-- ── 2. Backfill: todo ciclo existente vira um ciclo de um produto ───────────
insert into dash_gestao_ultimates_cycle_products (cycle_id, product_id)
  select id, product_id from dash_gestao_ultimates_cycles;

-- ── 3. Roster com universo multi-produto ────────────────────────────────────
-- Corpo copiado da 056 (que já traz os filtros de lead excluído da 055 e a
-- identidade do novo comprador), com a troca de cyc por prods como ÚNICA
-- diferença. RETURNS TABLE idêntico ao vigente — inclusive from_manual_link —,
-- então CREATE OR REPLACE basta e os grants sobrevivem. Não reaplique grants.
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
  -- Universo de produtos do ciclo. Entra como subconsulta no filtro, e não como
  -- cross join, porque com N linhas o cross join multiplicaria cada venda por N
  -- sem erro nenhum. Um comprador com venda em dois produtos gera duas linhas
  -- em `attributed` e uma só em base_sales_agg — o group by deduplica.
  with prods as (
    select cp.product_id
    from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
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
    left join links l on l.transaction_code = s.transaction_code
    left join buyers be on be.norm_email = lower(btrim(s.buyer_email))
    where s.product_id in (select prods.product_id from prods)
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

-- ── 4. Daily com universo multi-produto ─────────────────────────────────────
-- Corpo copiado da 055, com a troca de cyc por prods como única diferença.
-- RETURNS TABLE idêntico ao vigente, então CREATE OR REPLACE basta.
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
  with prods as (
    select cp.product_id
    from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
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
    left join links l on l.transaction_code = s.transaction_code
    left join buyers be on be.norm_email = lower(btrim(s.buyer_email))
    where s.product_id in (select prods.product_id from prods)
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

-- ── 5. Hourly com universo multi-produto ────────────────────────────────────
-- Espelho exato da daily acima; só o bucket muda (hora em America/Sao_Paulo,
-- ver migration 054). Toda mudança no filtro de vendas vale para as duas.
-- Corpo copiado da 055, com a troca de cyc por prods como única diferença.
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
  with prods as (
    select cp.product_id
    from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
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
    left join links l on l.transaction_code = s.transaction_code
    left join buyers be on be.norm_email = lower(btrim(s.buyer_email))
    where s.product_id in (select prods.product_id from prods)
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

-- ── 6. Opções de oferta, agora de todos os produtos do ciclo ────────────────
-- RETURNS TABLE MUDA (ganha product_id e product_name), então precisa de DROP
-- + CREATE — o Postgres não permite trocar o tipo de retorno via REPLACE. Os
-- grants morrem com a função e são reaplicados no fim do arquivo.
--
-- O produto dono da oferta passa a vir junto porque com N produtos na mesma
-- lista duas ofertas homônimas ("Oferta padrão") ficariam indistinguíveis no
-- seletor do modal.
drop function if exists public.dash_gestao_ultimates_offer_options(uuid);

create function public.dash_gestao_ultimates_offer_options(p_cycle_id uuid)
returns table (
  offer_code   text,
  offer_name   text,
  product_id   text,
  product_name text,
  sales_count  bigint,
  is_excluded  boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with prods as (
    select cp.product_id
    from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
  ),
  sales_agg as (
    select s.offer_code as code, count(*)::bigint as total
    from public.dash_gestao_hotmart_sales s
    where s.product_id in (select prods.product_id from prods)
      and s.offer_code is not null
    group by s.offer_code
  )
  select
    o.offer_code,
    o.offer_name,
    o.product_id,
    p.product_name,
    coalesce(sa.total, 0) as sales_count,
    exists (
      select 1
      from public.dash_gestao_ultimates_excluded_offers eo
      where eo.cycle_id = p_cycle_id
        and eo.offer_code = o.offer_code
    ) as is_excluded
  from public.dash_gestao_hotmart_offers o
  join public.dash_gestao_hotmart_products p on p.product_id = o.product_id
  left join sales_agg sa on sa.code = o.offer_code
  where o.product_id in (select prods.product_id from prods)
  order by coalesce(sa.total, 0) desc, p.product_name, o.offer_name;
$$;

-- ── 7. Remoção da coluna escalar ────────────────────────────────────────────
-- Fonte única de verdade passa a ser a junção. Manter product_id como "produto
-- principal" faria `select product_id from cycles` devolver uma resposta
-- sintaticamente válida e semanticamente errada — o primeiro produto de um
-- conjunto, apresentado como se fosse o ciclo inteiro.
--
-- O índice idx_ultimates_cycles_product_status cai junto com a coluna e NÃO é
-- recriado: nenhuma query filtra ciclos por produto.
alter table dash_gestao_ultimates_cycles drop column product_id;

-- ── 8. Criação atômica do ciclo ─────────────────────────────────────────────
-- Inserir o ciclo e inserir os produtos são duas statements. Se a segunda
-- falhasse, sobraria um ciclo com zero produtos — e o sintoma não seria um
-- erro, seria um dashboard que carrega normalmente com tudo zerado. Mesma
-- razão que motivou dash_gestao_ultimates_replace_buyers (migration 050).
--
-- A função também DERIVA o account_id dos produtos e recusa conjuntos que
-- cruzem contas: a regra "um ciclo, uma conta" vira garantia do banco, não
-- checagem que uma rota futura poderia esquecer. O refresh depende disso —
-- ele busca credenciais uma vez só, pelo account_id do ciclo.
create or replace function public.dash_gestao_ultimates_create_cycle(
  p_name         text,
  p_product_ids  text[],
  p_goal_percent numeric,
  p_created_by   uuid
)
returns public.dash_gestao_ultimates_cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids      text[];
  v_accounts uuid[];
  v_found    int;
  v_cycle    public.dash_gestao_ultimates_cycles;
begin
  -- Deduplica e descarta vazios antes de qualquer checagem: a PK composta
  -- rejeitaria duplicata, mas com um erro 23505 ilegível para o gestor.
  -- O btrim entra DENTRO do array_agg: sem ele um id com espaço de borda
  -- passaria pelo filtro e morreria depois na comparação exata do lookup,
  -- virando "Produto não encontrado" para um produto que existe.
  select array_agg(distinct btrim(x))
    into v_ids
  from unnest(coalesce(p_product_ids, '{}'::text[])) as x
  where btrim(x) <> '';

  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'Selecione ao menos um produto' using errcode = 'UL001';
  end if;

  select array_agg(distinct pr.account_id), count(*)
    into v_accounts, v_found
  from public.dash_gestao_hotmart_products pr
  where pr.product_id = any(v_ids);

  if coalesce(v_found, 0) <> array_length(v_ids, 1) then
    raise exception 'Produto não encontrado' using errcode = 'UL002';
  end if;

  if array_length(v_accounts, 1) <> 1 then
    raise exception 'Todos os produtos devem ser da mesma conta Hotmart' using errcode = 'UL003';
  end if;

  insert into public.dash_gestao_ultimates_cycles
    (name, account_id, goal_percent, status, created_by)
  values
    (btrim(p_name), v_accounts[1], p_goal_percent, 'ativo', p_created_by)
  returning * into v_cycle;

  insert into public.dash_gestao_ultimates_cycle_products (cycle_id, product_id)
  select v_cycle.id, x from unnest(v_ids) as x;

  return v_cycle;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- roster/daily/hourly preservam os grants (CREATE OR REPLACE não os derruba).
-- offer_options foi dropada, então precisa reaplicar. create_cycle é nova.
-- Mesma política de todo o módulo: só service_role — a API chama com a service
-- key, e liberar authenticated exporia compradores e vendas via PostgREST.
revoke execute on function public.dash_gestao_ultimates_offer_options(uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_offer_options(uuid) to service_role;

revoke execute on function public.dash_gestao_ultimates_create_cycle(text, text[], numeric, uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_create_cycle(text, text[], numeric, uuid) to service_role;

-- DOWN
-- ATENÇÃO: rollback COM PERDA. Ciclos multi-produto não têm representação na
-- coluna escalar; recriar product_id obriga a escolher um produto do conjunto e
-- os demais são descartados.
--
-- 1. alter table dash_gestao_ultimates_cycles add column product_id text;
-- 2. update dash_gestao_ultimates_cycles c set product_id = (
--      select cp.product_id from dash_gestao_ultimates_cycle_products cp
--      where cp.cycle_id = c.id order by cp.created_at, cp.product_id limit 1
--    );
-- 3. alter table dash_gestao_ultimates_cycles
--      alter column product_id set not null,
--      add constraint dash_gestao_ultimates_cycles_product_id_fkey
--        foreign key (product_id) references dash_gestao_hotmart_products(product_id);
-- 4. create index idx_ultimates_cycles_product_status
--      on dash_gestao_ultimates_cycles (product_id, status);
-- 5. drop function if exists public.dash_gestao_ultimates_create_cycle(text, text[], numeric, uuid);
-- 6. Reaplicar dash_gestao_ultimates_roster da migration 056 e _daily e _hourly
--    da 055 (as versões com cross join cyc) — NÃO as da 052/054, que não têm
--    from_manual_link, nem os filtros de lead/vínculo excluído, nem a identidade
--    do novo comprador; voltar para elas reverteria duas features em silêncio.
--    CREATE OR REPLACE basta nas três: a assinatura não mudou e os grants
--    sobrevivem.
-- 7. _offer_options exige DROP + CREATE, NÃO replace: esta migration mudou o
--    RETURNS TABLE dela (acrescentou product_id e product_name), e o Postgres não
--    troca tipo de retorno por replace. Nesta ordem:
--      drop function if exists public.dash_gestao_ultimates_offer_options(uuid);
--      <definição de _offer_options da migration 052>
--      revoke execute on function public.dash_gestao_ultimates_offer_options(uuid)
--        from public, anon, authenticated;
--      grant  execute on function public.dash_gestao_ultimates_offer_options(uuid)
--        to service_role;
--    O DROP destrói os grants: sem reaplicá-los a função volta sem permissão para
--    o service_role e toda leitura de oferta quebra com "permission denied".
-- 8. drop table if exists dash_gestao_ultimates_cycle_products;
