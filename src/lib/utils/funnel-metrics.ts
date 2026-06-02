import type { GlobalMetrics, GlobalHotmartMetrics } from "@/types/indicadores";

export interface FunnelStage {
  label: string;
  value: number;
}

export interface ConversionRate {
  label: string;
  pct: number | null;
}

const RATE_LABELS: string[] = ["CTR", "Taxa LP", "Conversão LP→Lead", "Taxa de Fechamento"];

/**
 * Builds the 5-stage funnel array from metrics and hotmartMetrics.
 * Returns null if either source is missing or if meta_impressions is undefined
 * (indicating the funnel data is not available).
 */
export function calcFunnelStages(
  metrics: GlobalMetrics | null,
  hotmartMetrics: GlobalHotmartMetrics | null
): FunnelStage[] | null {
  if (!metrics || !hotmartMetrics) return null;
  if (metrics.meta_impressions === undefined || metrics.meta_impressions === null) return null;

  return [
    { label: "Impressões", value: metrics.meta_impressions },
    { label: "Cliques no link", value: metrics.meta_link_clicks },
    { label: "Visualizações de LP", value: metrics.meta_page_views },
    { label: "Leads captados", value: metrics.meta_leads },
    { label: "Vendas aprovadas", value: hotmartMetrics.total_sales },
  ];
}

/**
 * Given a stages array, returns conversion rates between consecutive stages.
 * Returns null pct when the denominator (previous stage value) is 0 to avoid division by zero.
 */
export function calcConversionRates(stages: FunnelStage[]): ConversionRate[] {
  const rates: ConversionRate[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const denominator = stages[i].value;
    const numerator = stages[i + 1].value;
    const pct = denominator > 0 ? (numerator / denominator) * 100 : null;
    rates.push({ label: RATE_LABELS[i] ?? `Etapa ${i + 1}→${i + 2}`, pct });
  }
  return rates;
}
