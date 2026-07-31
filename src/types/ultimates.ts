// Dash Ultimates: monitoramento de ciclo de renovação (PRD: issue #114).
// Espelham as colunas de supabase/migrations/049_dash_gestao_ultimates.sql.

export type UltimatesCycleStatus = "ativo" | "encerrado";

export interface UltimatesCycleRecord {
  id: string;
  name: string;
  account_id: string;
  product_id: string;
  goal_percent: number | null;
  status: UltimatesCycleStatus;
  // Quando false, vendas de emails fora da base deixam de ser "novo comprador"
  // e passam a renovação sem vínculo (migration 053). A reclassificação roda no
  // cliente — ver src/lib/ultimates/new-purchases-mode.ts.
  counts_new_buyers: boolean;
  // Quando true, o ciclo não tem base de renovação: toda venda aprovada do
  // produto é materializada como buyer e o dashboard fala "Compras" em vez de
  // "Renovações" (migration 059, PRD "Apenas Compras"). Definida na criação e
  // IMUTÁVEL depois — trocar o modelo no meio corromperia a contabilidade do
  // ciclo. A ramificação de nomenclatura/KPIs roda no cliente
  // (src/lib/ultimates/purchases-mode.ts).
  purchases_only: boolean;
  refresh_started_at: string | null;
  last_refresh_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UltimatesBuyerRecord {
  id: string;
  cycle_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  extra: Record<string, unknown>;
  created_at: string;
}

export interface UltimatesManualLinkRecord {
  id: string;
  cycle_id: string;
  buyer_id: string;
  transaction_code: string;
  linked_by: string;
  created_at: string;
}

// Oferta Hotmart cujas compras não contam para a contabilidade do ciclo
// (migration 052). A exclusão é por ciclo e não altera nenhuma venda — é um
// filtro aplicado em leitura dentro das RPCs.
export interface UltimatesExcludedOfferRecord {
  id: string;
  cycle_id: string;
  offer_code: string;
  note: string | null;
  excluded_by: string;
  created_at: string;
}

// Lead da base cuja contabilidade foi excluída do ciclo (migration 055). A
// chave é o EMAIL NORMALIZADO, não o buyer_id: é por email que o lado das
// vendas é filtrado (dash_gestao_hotmart_sales só tem buyer_email) e é o que
// faz a exclusão sobreviver ao delete+reinsert de
// dash_gestao_ultimates_replace_buyers, que troca o id de quem sai e volta ao
// CSV.
export interface UltimatesExcludedBuyerRecord {
  id: string;
  cycle_id: string;
  email: string;
  note: string | null;
  excluded_by: string;
  created_at: string;
}

// Categorias de classificação do cruzamento base-de-compradores x vendas
// Hotmart, usadas pelo restante da feature (RPCs, API, UI).
//
// As RPCs só emitem as cinco primeiras. As duas últimas são produzidas no
// cliente por applyNewPurchasesModeToRoster quando o ciclo tem
// counts_new_buyers = false. Os dois pares de linhas com buyer_id = null
// (novo_* e renovacao_sem_vinculo*) NUNCA coexistem: são dois por modo.
export type UltimatesCategory =
  | "renovado"
  | "nao_renovado"
  | "renovacao_reembolsada"
  | "novo_comprador"
  | "novo_reembolsado"
  | "renovacao_sem_vinculo"
  | "renovacao_sem_vinculo_reembolsada";

// Retornos das RPCs de leitura (migration 050). Consumidos pelas próximas
// tasks (APIs) — os nomes espelham as colunas de RETURNS TABLE das funções.

// Uma linha por comprador da base (buyer_id preenchido) OU por novo comprador
// (buyer_id null), vinda de dash_gestao_ultimates_roster.
export interface UltimatesRosterRow {
  buyer_id: string | null;
  // PROCEDÊNCIA DIFERENTE POR TIPO DE LINHA (migration 056, PRD #146):
  // - linha da base (buyer_id preenchido): vem do CSV importado, editável pelo
  //   gestor e sobrescrita pelo próximo upload;
  // - novo comprador (buyer_id null): vem da Hotmart, agregado do primeiro
  //   valor não-nulo entre as vendas daquele email.
  // Não há coalesce entre os dois — de propósito, para a coluna não ter duas
  // origens silenciosas na mesma célula.
  //
  // `phone` do novo comprador só existe para compras recebidas via webhook: a
  // API sales/history não devolve telefone, então esse campo é parcial por
  // natureza e não tem backfill.
  name: string | null;
  email: string;
  phone: string | null;
  extra: Record<string, unknown>;
  category: UltimatesCategory;
  // Menor approved_date entre as vendas aprovadas da pessoa; null se nenhuma.
  renewed_at: string | null;
  // Soma do price das vendas aprovadas; null se nenhuma. PostgREST pode
  // serializar numeric como number ou string — normalize ao consumir.
  total_value: number | null;
  // transaction_code da primeira venda aprovada; null se nenhuma.
  transaction_code: string | null;
  // A renovação exposta em transaction_code veio de vínculo manual? Decide se
  // "Desfazer vínculo" tem o que desfazer (migration 055).
  //
  // OPCIONAL de propósito: a RPC anterior à 055 não devolve o campo, e a fila
  // de migrations deste ambiente anda dias atrás do código. `undefined` = "não
  // sei", e quem consome deve cair no comportamento anterior (oferecer o
  // desfazer em toda renovação, tratando o 404 do DELETE) em vez de esconder
  // uma ação que funciona. Só `false` afirma que não há vínculo.
  from_manual_link?: boolean;
}

// Vendas aprovadas do produto do ciclo por dia (não acumuladas — o acúmulo é
// feito no cliente), vinda de dash_gestao_ultimates_daily. As duas contagens
// saem da mesma agregação (migration 051), então todo dia com venda aparece
// aqui uma única vez, ainda que uma das séries seja 0 nele.
export interface UltimatesDailyRow {
  day: string; // date ISO (YYYY-MM-DD)
  // Vendas de compradores da base (renovações).
  renewals: number;
  // Vendas de emails fora da base e sem vínculo manual.
  new_buyers: number;
}

// Mesma agregação de UltimatesDailyRow, com bucket de hora (migration 054).
// `hour` é "YYYY-MM-DDTHH" em America/Sao_Paulo — texto, não data: a RPC já
// converteu o fuso, e construir um Date a partir daqui reinterpretaria a
// string no fuso de quem renderiza. Só horas COM venda vêm da RPC; o
// preenchimento das vazias é de buildHourlyCumulativeSeries.
export interface UltimatesHourlyRow {
  hour: string;
  renewals: number;
  new_buyers: number;
}

// Uma linha por oferta do produto do ciclo, vinda de
// dash_gestao_ultimates_offer_options (migration 052). Alimenta o seletor do
// modal "Ofertas excluídas": sales_count conta vendas em qualquer status e
// serve para o gestor reconhecer a oferta, não para contabilidade.
export interface UltimatesOfferOption {
  offer_code: string;
  offer_name: string;
  sales_count: number;
  is_excluded: boolean;
}

// Contadores devolvidos por dash_gestao_ultimates_replace_buyers.
export interface UltimatesReplaceResult {
  removed: number;
  updated: number;
  inserted: number;
}
