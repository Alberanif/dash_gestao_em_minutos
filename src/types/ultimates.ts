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

// Categorias de classificação do cruzamento base-de-compradores x vendas
// Hotmart, usadas pelo restante da feature (RPCs, API, UI).
export type UltimatesCategory =
  | "renovado"
  | "nao_renovado"
  | "renovacao_reembolsada"
  | "novo_comprador"
  | "novo_reembolsado";

// Retornos das RPCs de leitura (migration 050). Consumidos pelas próximas
// tasks (APIs) — os nomes espelham as colunas de RETURNS TABLE das funções.

// Uma linha por comprador da base (buyer_id preenchido) OU por novo comprador
// (buyer_id null), vinda de dash_gestao_ultimates_roster.
export interface UltimatesRosterRow {
  buyer_id: string | null;
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
