export interface IndicadoresProject {
  id: string;
  name: string;
  hotmart_product_id: string;
  campaign_terms: string[];
  organic_lead_events: string[];
  created_at: string;
  updated_at: string;
}

export interface IndicadoresWeeklyData {
  id: string;
  project_id: string;
  week_start: string;
  week_end: string;
  meta_connect_rate: number | null;
  meta_lp_conversion: number | null;
  meta_cpl_traffic: number | null;
  google_spend: number | null;
  google_cpm: number | null;
  google_leads: number | null;
  google_connect_rate: number | null;
  google_cpl_traffic: number | null;
  google_lp_conversion: number | null;
  created_at: string;
  updated_at: string;
}

export interface IndicadoresMetrics {
  meta_spend: number;
  meta_cpm: number;
  meta_ctr: number;
  meta_leads: number;
  meta_connect_rate: number | null;
  meta_lp_conversion: number | null;
  meta_cpl_traffic: number | null;
  google_spend: number | null;
  google_cpm: number | null;
  google_leads: number | null;
  google_connect_rate: number | null;
  google_cpl_traffic: number | null;
  google_lp_conversion: number | null;
  organic_leads: number | null;
  unknown_leads: number | null;
}

export interface ComparativoPeriod {
  startDate: string;
  endDate: string;
  metrics: IndicadoresMetrics | null;
  loading: boolean;
  error: boolean;
}
