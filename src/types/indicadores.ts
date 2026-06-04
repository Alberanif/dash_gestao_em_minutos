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
}

export interface FilterRecord {
  id: string;
  account_id: string;
  name: string;
  hotmart_products: Array<{ product_id: string; product_name: string }>;
  meta_ads_terms: string[];
  created_at: string;
  updated_at: string;
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
