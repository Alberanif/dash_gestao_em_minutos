export interface GlobalMetrics {
  meta_spend: number;
  meta_cpm: number;
  meta_ctr: number;
  meta_leads: number;
  meta_checkout: number;
  meta_impressions: number;
  meta_link_clicks: number;
  meta_page_views: number;
  meta_connect_rate: number | null;
  meta_lp_conversion: number | null;
  meta_cpl_traffic: number | null;
}

export interface HotmartProductMetrics {
  product_id: string;
  product_name: string;
  sales_count: number;
  revenue: number;
  is_foreign_currency?: boolean;
}

export interface GlobalHotmartMetrics {
  products: HotmartProductMetrics[];
  total_sales: number;
  total_sales_brl: number;
  total_sales_foreign: number;
  total_revenue: number;
}

export interface GlobalLeadsMetrics {
  total: number;
  by_event: Array<{ evento: string; count: number }>;
  by_source: Array<{ source: string; count: number }>;
}

/**
 * Quebra semanal (quinta→quarta) da visualização Planilha. Cada entrada em
 * `weeks` repete os campos do agregado, calculados só com os dados daquela
 * semana — razões derivadas dos brutos da própria semana, nunca média de médias.
 */
export interface WeekWindow {
  index: number;
  startDate: string;
  endDate: string;
}

export type GlobalMetricsWeek = WeekWindow & GlobalMetrics;

export interface GlobalMetricsWithWeeks extends GlobalMetrics {
  weeks: GlobalMetricsWeek[];
}

export type HotmartTotalsWeek = WeekWindow &
  Omit<GlobalHotmartMetrics, "products">;

export interface GlobalHotmartMetricsWithWeeks extends GlobalHotmartMetrics {
  weeks: HotmartTotalsWeek[];
}

export type LeadsWeek = WeekWindow & {
  total: number;
  by_source: Array<{ source: string; count: number }>;
};

export interface GlobalLeadsMetricsWithWeeks extends GlobalLeadsMetrics {
  weeks: LeadsWeek[];
}

export type ConversionSourcesWeek = WeekWindow & {
  sources: ConversionSourceRow[];
};

export interface ConversionSourcesWithWeeks {
  sources: ConversionSourceRow[];
  weeks: ConversionSourcesWeek[];
}

export const FILTER_STATUSES = ["ativo", "finalizado", "cancelado"] as const;
export type FilterStatus = (typeof FILTER_STATUSES)[number];

export interface FilterRecord {
  id: string;
  account_id: string;
  name: string;
  hotmart_products: Array<{ product_id: string; product_name: string }>;
  meta_ads_terms: string[];
  captacao_leads_eventos: string[];
  status: FilterStatus;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversionSourceRow {
  source: string;
  count: number;
}

export interface DailyPoint {
  date: string;
  meta_spend: number;
  meta_leads: number;
  meta_cpl_traffic: number | null;
  meta_checkout: number;
  hotmart_sales: number;
  lead_captacoes: number;
}
