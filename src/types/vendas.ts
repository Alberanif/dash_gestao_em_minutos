// Relatório de Vendas (PRD #185): pastas e visualizações. O modelo antigo foi
// removido na fatia 4/4 (#190); as tabelas/RPCs antigas só caem na #186.

export interface VendasFolderRecord {
  id: string;
  account_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// ── Visualizações (PRD #185) ────────────────────────────────────────────────
// Espelham a tabela dash_gestao_vendas_views e os retornos das RPCs
// dash_gestao_vendas_view_* (supabase/migrations/070_vendas_views.sql).
// Contagens `bigint` chegam como number via PostgREST.

export type VendasViewBackfillStatus =
  | "pending"
  | "running"
  | "done"
  | "partial"
  | "failed";

/** Linha de dash_gestao_vendas_view_products (migration 072). */
export interface VendasViewProduct {
  product_id: string;
  /** Allowlist do produto: >= 1 oferta, sem duplicados. */
  offer_codes: string[];
}

/** Linha de dash_gestao_vendas_views (+ `products`, da tabela filha). */
export interface VendasViewRecord {
  id: string;
  name: string;
  account_id: string;
  /**
   * @deprecated Legado (migration 072 relaxou para NULL; o drop é a última
   * fatia do PRD #213). Leia `products`.
   */
  product_id: string;
  /** @deprecated Legado, ver `product_id`. Leia `products`. */
  offer_codes: string[];
  /** Produtos da visualização, cada um com a sua allowlist (>= 1 produto). */
  products: VendasViewProduct[];
  folder_id: string | null;
  view_start_date: string | null;
  view_end_date: string | null;
  refresh_started_at: string | null;
  last_refresh_at: string | null;
  backfill_status: VendasViewBackfillStatus;
  backfill_from: string | null;
  migrated_from_cycle_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** dash_gestao_vendas_view_kpis(p_view_id, p_start, p_end): sempre 1 linha. */
export interface VendasViewKpis {
  /** APPROVED + COMPLETE. */
  sales: number;
  /** REFUNDED + CHARGEBACK. */
  refunded: number;
}

/** dash_gestao_vendas_view_daily(p_view_id, p_start, p_end). */
export interface VendasViewDailyRow {
  /** 'YYYY-MM-DD' em America/Sao_Paulo. */
  day: string;
  sales: number;
}

/** dash_gestao_vendas_view_hourly(p_view_id, p_start, p_end). */
export interface VendasViewHourlyRow {
  /** 'YYYY-MM-DDTHH' em America/Sao_Paulo. */
  hour: string;
  sales: number;
}

/**
 * dash_gestao_vendas_view_offers(p_view_id, p_start, p_end): uma linha por
 * (produto, oferta) da allowlist, inclusive com 0 vendas.
 */
export interface VendasViewOfferRow {
  product_id: string;
  product_name: string;
  offer_code: string;
  /** null para código manual que não existe em hotmart_offers. */
  offer_name: string | null;
  sales: number;
  refunded: number;
}
