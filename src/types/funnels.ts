export interface LancamentoPagoConfig {
  product_ids: string[];
  ad_account_ids: string[];
  campaign_ids: string[];
  inactive_ads?: boolean;
}

export interface LancamentoConfig {
  ad_account_ids: string[];
  campaign_ids: string[];
}

export type DestraveConfig = LancamentoPagoConfig;

export interface LancamentoPagoFunnel {
  id: string;
  name: string;
  type: "lancamento_pago";
  start_date: string;
  end_date: string;
  goal_sales: number;
  config: LancamentoPagoConfig;
  created_at: string;
  updated_at: string;
}

export interface LancamentoFunnel {
  id: string;
  name: string;
  type: "lancamento";
  start_date: string;
  end_date: string;
  goal_sales: number;
  config: LancamentoConfig;
  created_at: string;
  updated_at: string;
}

export type Funnel = LancamentoPagoFunnel | LancamentoFunnel;

export interface LancamentoPagoMetrics {
  type: "lancamento_pago";
  total_sales: number;
  total_sales_brl: number;
  total_sales_other_currencies: number;
  total_spend: number;
  cac: number;
  pace_diario: number;
  pace_ideal: number;
  sales_remaining: number;
}

export interface LancamentoMetrics {
  type: "lancamento";
  total_leads: number;
  total_spend: number;
  cpl: number;
  pace_diario_leads: number;
  pace_ideal_leads: number;
  leads_remaining: number;
}

export type FunnelMetrics = LancamentoPagoMetrics | LancamentoMetrics;

export interface HotmartProduct {
  product_id: string;
  product_name: string;
}

export interface CampaignOption {
  campaign_id: string;
  campaign_name: string;
  account_id: string;
}
