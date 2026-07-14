import type {
  ConversionSourceRow,
  GlobalHotmartMetrics,
  GlobalLeadsMetrics,
  GlobalMetrics,
} from "@/types/indicadores";
import { calcCPA, calcConversionRate, calcROAS } from "@/lib/utils/cross-metrics";
import type { ConfiguredSources, ExpandedFilter, Period } from "../filter-expansion";
import { fetchConversionSources } from "./conversion-sources";
import { fetchHotmartMetrics } from "./hotmart";
import { fetchLeadsMetrics } from "./leads";
import { fetchMetaMetrics } from "./meta";
import type { SupabaseLike } from "./types";

/**
 * Derivados cruzados entre fontes. `null` é sempre "indisponível", nunca zero:
 * é essa distinção que impede o agente de ler ausência de investimento como
 * desempenho ruim, ou de reportar `Infinity` como se fosse um número.
 */
export interface DerivedMetrics {
  roas: number | null;
  cpa: number | null;
  conversionRate: number | null;
}

export interface PeriodSummary {
  period: Period;
  sources: ConfiguredSources;
  meta: GlobalMetrics;
  hotmart: GlobalHotmartMetrics;
  leads: GlobalLeadsMetrics;
  conversionSources: ConversionSourceRow[];
  derived: DerivedMetrics;
}

export interface PeriodSummaryQuery {
  period: Period;
  filter: ExpandedFilter;
}

/**
 * Visão completa do período no escopo do filtro, numa única composição. O agente
 * lê tudo de uma vez para não raciocinar sobre dado parcial.
 */
export async function fetchPeriodSummary(
  { period, filter }: PeriodSummaryQuery,
  supabase: SupabaseLike
): Promise<PeriodSummary> {
  const query = { period, filter };

  const [meta, hotmart, leads, conversionSources] = await Promise.all([
    fetchMetaMetrics(query, supabase),
    fetchHotmartMetrics(query, supabase),
    fetchLeadsMetrics(query, supabase),
    fetchConversionSources(query, supabase),
  ]);

  // Os derivados saem do mesmo módulo que a tela usa. Reimplementá-los aqui — ou
  // deixar o modelo dividir os números — reintroduziria o `Infinity` e o zero
  // enganoso que as guardas de `null` do `cross-metrics` já eliminam.
  const derived: DerivedMetrics = {
    roas: calcROAS({ metaSpend: meta.meta_spend, hotmartTotalRevenue: hotmart.total_revenue }),
    cpa: calcCPA({ metaSpend: meta.meta_spend, hotmartTotalSales: hotmart.total_sales }),
    conversionRate: calcConversionRate({
      metaLeads: meta.meta_leads,
      hotmartTotalSales: hotmart.total_sales,
    }),
  };

  return {
    period,
    sources: filter.sources,
    meta,
    hotmart,
    leads,
    conversionSources,
    derived,
  };
}
