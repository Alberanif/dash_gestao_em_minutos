export const CONVITE_GROUP_OPTIONS = [
  { value: "funil_destrave", label: "Funil Destrave" },
  { value: "funil_ads_comercial", label: "Funil ADS Comercial" },
  { value: "ultimate", label: "Ultimate" },
  { value: "fcc", label: "FCC" },
  { value: "mcc", label: "MCC" },
  { value: "social_seller", label: "Social Seller" },
] as const;

export type ConviteGroup = (typeof CONVITE_GROUP_OPTIONS)[number]["value"];

export interface ConviteProjectOption {
  id: string;
  grupo: ConviteGroup;
  nome_projeto: string;
}

export interface ConviteFunilDestraveMetrics {
  id: string;
  projeto: string;
  comparecimento: number;
  conv_produto_principal: number;
  conv_downsell: number;
  conv_upsell: number;
  cac_geral: number;
  created_at: string;
  updated_at: string;
}

export interface ConviteAdsComercialConfig {
  id: string;
  convite_project_id: string;
  hotmart_account_id: string | null;
  hotmart_product_ids: string[];
  meta_ads_account_ids: string[];
  campaign_terms: string[];
  organic_lead_events: string[];
  created_at: string;
  updated_at: string;
}

export interface ConviteAdsComercialMetrics {
  total_sales: number;
  total_revenue: number;
  total_leads: number;
  meta_leads: number;
  organic_leads: number;
  meta_spend: number;
  sales_conversion_rate: number;
  cac: number;
}

export interface ConviteUltimateMetrics {
  latest_month_year: string | null;
  latest_numero_absoluto: number;
  latest_perc_renovacao: number | null;
  latest_perc_conv_pitch: number | null;
  monthly_history: Array<{
    id: string;
    month_year: string;
    numero_absoluto: number;
  }>;
  percentuais_history: Array<{
    id: string;
    projeto: string;
    perc_renovacao: number;
    perc_conv_pitch: number;
  }>;
}

export interface ConviteMccMetrics {
  latest_perc_ultimate: number | null;
  latest_perc_pc_ao_vivo: number | null;
  history: Array<{
    id: string;
    perc_ultimate: number;
    perc_pc_ao_vivo: number;
    created_at: string;
  }>;
}

export interface ConviteFccMetrics {
  latest_perc_assessment: number | null;
  latest_perc_mcc: number | null;
  latest_perc_pc_ao_vivo: number | null;
  history: Array<{
    id: string;
    perc_assessment: number;
    perc_mcc: number;
    perc_pc_ao_vivo: number;
    created_at: string;
  }>;
}

export interface ConviteProject {
  id: string;
  grupo: ConviteGroup;
  nome_projeto: string;
  data_inicio: string;
  data_fim: string;
  metrics: ConviteFunilDestraveMetrics | ConviteAdsComercialMetrics | ConviteUltimateMetrics | ConviteFccMetrics | ConviteMccMetrics | null;
  ads_comercial_config: ConviteAdsComercialConfig | null;
}
