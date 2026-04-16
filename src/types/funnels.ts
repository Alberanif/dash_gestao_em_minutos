export interface DestraveConfig {
  product_ids: string[];
  ad_account_ids: string[];
  campaign_ids: string[];
  inactive_ads?: boolean;
}

export interface Funnel {
  id: string;
  name: string;
  type: "destrave";
  start_date: string;
  end_date: string;
  goal_sales: number;
  config: DestraveConfig;
  created_at: string;
  updated_at: string;
}

export interface FunnelMetrics {
  total_sales: number;
  total_spend: number;
  cac: number;
  pace_diario: number;
}

export interface HotmartProduct {
  product_id: string;
  product_name: string;
}

export interface CampaignOption {
  campaign_id: string;
  campaign_name: string;
  account_id: string;
}
