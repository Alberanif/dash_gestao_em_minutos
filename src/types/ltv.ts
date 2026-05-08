export interface LtvSolidesEntry {
  id: string;
  period_start: string;
  period_end: string;
  assinaturas_ativas: number;
  assinaturas_canceladas: number;
  novas_assinaturas: number;
  created_at: string;
  updated_at: string;
}

export interface LtvMetrics {
  assinaturas_ativas: number;
  assinaturas_canceladas: number;
  assinaturas_canceladas_delta: number;
  novas_assinaturas: number;
  novas_assinaturas_delta: number;
  total_assinaturas_ativas?: number;  // Total acumulado de assinaturas ativas
}
