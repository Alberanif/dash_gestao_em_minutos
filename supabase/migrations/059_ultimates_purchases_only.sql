-- Dash Ultimates: modo "Apenas Compras" por ciclo.
--
-- Existe um caso de uso distinto do ciclo de renovação: o gestor só quer
-- acompanhar TODAS as compras de um produto num período, sem ter uma base de
-- renovação para cruzar. Nesse modo não há "renovado/não renovado/novo
-- comprador" — toda venda aprovada é uma "Compra", materializada como buyer do
-- ciclo (ver a RPC aditiva de sincronização, migration seguinte), e o
-- dashboard troca a nomenclatura de "Renovação" para "Compras".
--
-- Esta coluna deixa o gestor declarar esse modo na CRIAÇÃO do ciclo. É
-- IMUTÁVEL depois: o PATCH de ciclo nunca a aplica, porque trocar o modelo no
-- meio da operação corromperia a contabilidade. A ramificação de
-- nomenclatura/KPIs acontece no cliente (src/lib/ultimates/purchases-mode.ts)
-- sobre o que as RPCs devolvem — as RPCs de leitura não mudam por causa dela.
--
-- Default false preserva exatamente o comportamento de todos os ciclos que já
-- existem: eles seguem como ciclos de renovação. Not null porque a ausência de
-- valor não tem significado próprio — todo ciclo ou é "apenas compras" ou não é.

-- UP
alter table dash_gestao_ultimates_cycles
  add column purchases_only boolean not null default false;

-- DOWN
-- alter table dash_gestao_ultimates_cycles drop column if exists purchases_only;
