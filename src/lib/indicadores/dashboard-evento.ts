import type {
  ConversionSourceRow,
  DailyPoint,
  FilterRecord,
  GlobalHotmartMetrics,
  GlobalLeadsMetrics,
  GlobalMetrics,
} from "@/types/indicadores";
import { calcConversionRate, calcCPA, calcROAS } from "@/lib/utils/cross-metrics";
import { calcConversionRates, calcFunnelStages, type ConversionRate, type FunnelStage } from "@/lib/utils/funnel-metrics";
import { expandFilter, toSearchParams, type ExpandedFilter, type Period } from "./filter-expansion";

/**
 * Dashboard do evento (V2): o que o `fetchAll` do V1 decide — quais fontes
 * consultar, com quais parâmetros, e o que mostrar quando a fonte não está
 * configurada — num lugar só, usado pela página de servidor (primeira carga)
 * e pelo cliente (troca de filtro). Este arquivo é puro: o cliente o importa, então
 * nada de banco aqui (o lado do servidor está em dashboard-evento-servidor.ts). A tela do V1 continua com a cópia dela.
 */

export type FonteId = "meta" | "hotmart" | "leads" | "daily" | "sources";

export const ZERADO_META: GlobalMetrics = {
  meta_spend: 0,
  meta_cpm: 0,
  meta_ctr: 0,
  meta_leads: 0,
  meta_checkout: 0,
  meta_impressions: 0,
  meta_link_clicks: 0,
  meta_page_views: 0,
  meta_connect_rate: null,
  meta_lp_conversion: null,
  meta_cpl_traffic: null,
};

export const ZERADO_HOTMART: GlobalHotmartMetrics = {
  products: [],
  total_sales: 0,
  total_sales_brl: 0,
  total_sales_foreign: 0,
  total_revenue: 0,
};

export const ZERADO_LEADS: GlobalLeadsMetrics = { total: 0, by_event: [], by_source: [] };

export interface DadosDasFontes {
  meta: GlobalMetrics;
  hotmart: GlobalHotmartMetrics;
  leads: GlobalLeadsMetrics;
  daily: DailyPoint[];
  sources: ConversionSourceRow[];
}

export const ZERADOS: { [K in FonteId]?: DadosDasFontes[K] } = {
  meta: ZERADO_META,
  hotmart: ZERADO_HOTMART,
  leads: ZERADO_LEADS,
  sources: [],
};

/** A fonte foi lida do banco; `chave` identifica a consulta que a gerou (usada para animar a troca). */
export interface Fonte<T> {
  data: T;
  chave: string;
}

export interface Consulta {
  expanded: ExpandedFilter;
  /** Query string de meta, hotmart, daily e conversion-sources (com o `?`). */
  params: string;
  /** Leads só filtra por evento: termo de Meta, produto e oferta são ruído para ele. */
  leadsParams: string;
  /** Muda quando período, evento ou oferta mudam. */
  chave: string;
}

export function montarConsulta(filter: FilterRecord, period: Period, offerCode: string | null = null): Consulta {
  const expanded = expandFilter(filter, offerCode);
  const params = `?${toSearchParams(expanded, period)}`;
  const leadsParams = `?${toSearchParams({ ...expanded, metaTerms: [], productIds: [], offerCode: null }, period)}`;
  return { expanded, params, leadsParams, chave: `${filter.id}|${period.startDate}|${period.endDate}|${offerCode ?? ""}` };
}

/** Fontes que o filtro configura; as outras nunca vão à rede e valem zero. */
export function fonteConfigurada(expanded: ExpandedFilter, fonte: FonteId): boolean {
  if (fonte === "daily") return true;
  if (fonte === "meta") return expanded.sources.meta;
  if (fonte === "leads") return expanded.sources.leads;
  return expanded.sources.hotmart; // hotmart e sources
}

/** Rota que serve cada fonte (a mesma que o V1 chama). */
export const ROTA_DA_FONTE: Record<FonteId, string> = {
  meta: "/api/indicadores/metrics",
  hotmart: "/api/indicadores/hotmart",
  leads: "/api/indicadores/leads",
  daily: "/api/indicadores/daily",
  sources: "/api/indicadores/conversion-sources",
};

export function paramsDaFonte(consulta: Consulta, fonte: FonteId): string {
  return fonte === "leads" ? consulta.leadsParams : consulta.params;
}

export interface ResultadoDerivado {
  roas: number | null;
  cpa: number | null;
  convRate: number | null;
  funil: { etapas: FunnelStage[]; taxas: ConversionRate[] } | null;
}

/**
 * ROAS, CPA, conversão e funil, com as mesmas guardas do V1: fonte não configurada
 * entra como `null` (aparece "—"), nunca como o zero do placeholder.
 */
export function derivarResultado(
  expanded: ExpandedFilter,
  meta: GlobalMetrics | null,
  hotmart: GlobalHotmartMetrics | null,
  leads: GlobalLeadsMetrics | null,
): ResultadoDerivado {
  const temMeta = expanded.sources.meta;
  const temHotmart = expanded.sources.hotmart;
  const roas = calcROAS({
    metaSpend: temMeta ? (meta?.meta_spend ?? null) : null,
    hotmartTotalRevenue: temHotmart ? (hotmart?.total_revenue ?? null) : null,
  });
  const cpa = calcCPA({
    metaSpend: temMeta ? (meta?.meta_spend ?? null) : null,
    hotmartTotalSales: temHotmart ? (hotmart?.total_sales ?? null) : null,
  });
  const convRate = calcConversionRate({
    metaLeads: temMeta ? (meta?.meta_leads ?? null) : null,
    hotmartTotalSales: temHotmart ? (hotmart?.total_sales ?? null) : null,
  });
  const etapas = calcFunnelStages(temMeta ? meta : null, temHotmart ? hotmart : null, leads?.total ?? 0);
  return { roas, cpa, convRate, funil: etapas ? { etapas, taxas: calcConversionRates(etapas) } : null };
}
