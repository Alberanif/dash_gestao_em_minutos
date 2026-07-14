import type { GlobalMetrics } from "@/types/indicadores";
import type { ExpandedFilter, Period } from "../filter-expansion";
import type { SupabaseLike } from "./types";

const COLUMNS = "spend, impressions, link_clicks, leads_all, page_views, checkout";

export const ZEROED_META: GlobalMetrics = {
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

export interface MetaQuery {
  period: Period;
  filter: ExpandedFilter;
}

interface CampaignRow {
  spend: number | null;
  impressions: number | null;
  link_clicks: number | null;
  leads_all: number | null;
  page_views: number | null;
  checkout: number | null;
}

/**
 * Investimento e tráfego Meta Ads no escopo do filtro. Note que as datas vão
 * cruas: a tabela diária guarda `date` já em BRT, ao contrário de
 * `purchase_date` da Hotmart, que é UTC. Converter aqui deslocaria o período.
 */
export async function fetchMetaMetrics(
  { period, filter }: MetaQuery,
  supabase: SupabaseLike
): Promise<GlobalMetrics> {
  if (!filter.sources.meta) return { ...ZEROED_META };

  const query = baseQuery(period, supabase).or(
    filter.metaTerms.map((t) => `campaign_name.ilike.%${t}%`).join(",")
  );

  return aggregate(await run(query));
}

/**
 * Caminho legado sem escopo de campanha, preservado para que o route handler
 * continue respondendo idêntico quando chamado sem `meta_terms[]`. Nenhuma tool
 * do agente usa este caminho — é aqui que moram os dados globais.
 */
export async function fetchMetaMetricsUnscoped(
  { period }: MetaQuery,
  supabase: SupabaseLike
): Promise<GlobalMetrics> {
  return aggregate(await run(baseQuery(period, supabase)));
}

interface AwaitableQuery {
  or(expr: string): AwaitableQuery;
  then: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>["then"];
}

function baseQuery(period: Period, supabase: SupabaseLike): AwaitableQuery {
  return supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select(COLUMNS)
    .gte("date", period.startDate)
    .lte("date", period.endDate);
}

async function run(query: AwaitableQuery): Promise<CampaignRow[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignRow[];
}

function aggregate(rows: CampaignRow[]): GlobalMetrics {
  const sum = (pick: (row: CampaignRow) => number | null) =>
    rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

  const meta_spend = sum((r) => r.spend);
  const meta_impressions = sum((r) => r.impressions);
  const meta_link_clicks = sum((r) => r.link_clicks);
  const meta_leads = sum((r) => r.leads_all);
  const meta_page_views = sum((r) => r.page_views);
  const meta_checkout = sum((r) => r.checkout);

  return {
    meta_spend,
    meta_cpm: meta_impressions > 0 ? (meta_spend / meta_impressions) * 1000 : 0,
    meta_ctr: meta_impressions > 0 ? (meta_link_clicks / meta_impressions) * 100 : 0,
    meta_leads,
    meta_checkout,
    meta_impressions,
    meta_link_clicks,
    meta_page_views,
    meta_connect_rate: meta_link_clicks > 0 ? (meta_page_views / meta_link_clicks) * 100 : null,
    meta_lp_conversion: meta_page_views > 0 ? (meta_leads / meta_page_views) * 100 : null,
    meta_cpl_traffic: meta_leads > 0 ? meta_spend / meta_leads : null,
  };
}
