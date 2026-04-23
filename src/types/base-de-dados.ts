export interface AtencaoRow {
  id: string;
  week_start: string;
  week_end: string;
  oportunidades: number;
  created_at: string;
  updated_at: string;
}

export interface EqaRow {
  id: string;
  week_start: string;
  week_end: string;
  seguidores_conectados: number;
  total_ctas: number;
  total_agendamentos: number;
  created_at: string;
  updated_at: string;
}

export interface FunilDestraveRow {
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

export interface UltimateRow {
  id: string;
  month_year: string;
  numero_absoluto: number;
  created_at: string;
  updated_at: string;
}

export interface UltimatePercentuaisRow {
  id: string;
  projeto: string;
  perc_renovacao: number;
  perc_conv_pitch: number;
  created_at: string;
  updated_at: string;
}

export interface FccRow {
  id: string;
  projeto: string;
  perc_assessment: number;
  perc_mcc: number;
  perc_pc_ao_vivo: number;
  created_at: string;
  updated_at: string;
}

export interface MccRow {
  id: string;
  projeto: string;
  perc_ultimate: number;
  perc_pc_ao_vivo: number;
  created_at: string;
  updated_at: string;
}

export interface SocialSellerRow {
  id: string;
  week_start: string;
  week_end: string;
  reunioes_realizadas: number;
  vendas_realizadas: number;
  created_at: string;
  updated_at: string;
}
