// Relatório de Vendas: monitoramento de ciclo de renovação (PRD: issue #169).
// Espelham as colunas de supabase/migrations/066_rename_ultimates_to_vendas.sql.

export type VendasCycleStatus = "ativo" | "encerrado";

export interface VendasCycleProductRef {
  product_id: string;
  product_name: string | null;
  offer_codes: string[];
  rejected_offer_codes: string[];
  include_offerless: boolean | null;
}

export interface VendasCycleProductSelection {
  product_id: string;
  offer_codes: string[];
  rejected_offer_codes: string[];
  include_offerless: boolean | null;
}

export interface VendasCycleRecord {
  id: string;
  name: string;
  account_id: string;
  goal_percent: number | null;
  status: VendasCycleStatus;
  counts_new_buyers: boolean;
  purchases_only: boolean;
  folder_id?: string | null;
  view_start_date?: string | null;
  view_end_date?: string | null;
  refresh_started_at: string | null;
  last_refresh_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendasFolderRecord {
  id: string;
  account_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface VendasBuyerRecord {
  id: string;
  cycle_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  extra: Record<string, unknown>;
  created_at: string;
}

export interface VendasManualLinkRecord {
  id: string;
  cycle_id: string;
  buyer_id: string;
  transaction_code: string;
  linked_by: string;
  created_at: string;
}

export interface VendasExcludedBuyerRecord {
  id: string;
  cycle_id: string;
  email: string;
  note: string | null;
  excluded_by: string;
  created_at: string;
}

export type VendasCategory =
  | "renovado"
  | "nao_renovado"
  | "renovacao_reembolsada"
  | "novo_comprador"
  | "novo_reembolsado"
  | "renovacao_sem_vinculo"
  | "renovacao_sem_vinculo_reembolsada";

export interface VendasRosterRow {
  buyer_id: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  extra: Record<string, unknown>;
  category: VendasCategory;
  renewed_at: string | null;
  total_value: number | null;
  transaction_code: string | null;
  from_manual_link?: boolean;
}

export interface VendasDailyRow {
  day: string;
  renewals: number;
  new_buyers: number;
}

export interface VendasHourlyRow {
  hour: string;
  renewals: number;
  new_buyers: number;
}

export interface SetProductsResult {
  products_added: number;
  products_removed: number;
  buyers_removed: number;
  buyers_materialized: number;
  offers_added: number;
  offers_removed: number;
}

export interface VendasOfferOption {
  offer_code: string;
  offer_name: string;
  product_id: string;
  product_name: string;
  sales_count: number;
}

export interface VendasOfferlessOption {
  product_id: string;
  sales_count: number;
}

export interface VendasReplaceResult {
  removed: number;
  updated: number;
  inserted: number;
}

// Aliases para retrocompatibilidade retroativa
export type UltimatesCycleStatus = VendasCycleStatus;
export type UltimatesCycleProductRef = VendasCycleProductRef;
export type UltimatesCycleProductSelection = VendasCycleProductSelection;
export type UltimatesCycleRecord = VendasCycleRecord;
export type UltimatesBuyerRecord = VendasBuyerRecord;
export type UltimatesManualLinkRecord = VendasManualLinkRecord;
export type UltimatesExcludedBuyerRecord = VendasExcludedBuyerRecord;
export type UltimatesCategory = VendasCategory;
export type UltimatesRosterRow = VendasRosterRow;
export type UltimatesDailyRow = VendasDailyRow;
export type UltimatesHourlyRow = VendasHourlyRow;
export type UltimatesOfferOption = VendasOfferOption;
export type UltimatesOfferlessOption = VendasOfferlessOption;
export type UltimatesReplaceResult = VendasReplaceResult;
