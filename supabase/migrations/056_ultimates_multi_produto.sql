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
