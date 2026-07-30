-- Dash Ultimates: switch "Novas Compras" por ciclo.
--
-- Existem eventos em que, por definição, não há novos compradores — toda venda
-- é renovação, e parte dos clientes renova com um email diferente do cadastrado
-- na base. Nesses ciclos o cruzamento por email não acha vínculo e classifica a
-- venda como novo comprador, o que infla "Novos Compradores" e deixa o comprador
-- real parado em "Não renovados".
--
-- Esta coluna deixa o gestor declarar que o ciclo não admite novas compras. A
-- reclassificação em si acontece no cliente (src/lib/ultimates/new-purchases-mode.ts)
-- sobre o que as RPCs devolvem — NENHUMA RPC muda aqui. As RPCs continuam
-- respondendo o fato ("bateu email ou não"); o TypeScript aplica a política de
-- nomenclatura do ciclo.
--
-- Default true preserva exatamente o comportamento atual de todos os ciclos que
-- já existem. Not null porque a ausência de valor não tem significado próprio:
-- todo ciclo ou admite novas compras ou não admite.

-- UP
alter table dash_gestao_ultimates_cycles
  add column counts_new_buyers boolean not null default true;

-- DOWN
-- alter table dash_gestao_ultimates_cycles drop column if exists counts_new_buyers;
