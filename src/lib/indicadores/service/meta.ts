import type { GlobalMetrics, GlobalMetricsWithWeeks } from "@/types/indicadores";
import type { ExpandedFilter, Period } from "../filter-expansion";
import { partitionWeeks } from "../week-partition";
import type { SupabaseLike } from "./types";

const COLUMNS = "spend, impressions, link_clicks, leads_all, page_views, checkout";
const PAGE_SIZE = 1000;

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

interface DatedCampaignRow extends CampaignRow {
  date: string;
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

  const rows = await paginate(() =>
    baseQuery(period, supabase).or(
      filter.metaTerms.map((t) => `campaign_name.ilike.%${t}%`).join(",")
    )
  );

  return aggregate(rows);
}

/**
 * Variante da Planilha: além do agregado, devolve os mesmos campos por semana
 * quinta→quarta. Uma única consulta (com a coluna `date`) alimenta Total e
 * semanas — calcular as duas pontas dos mesmos brutos evita divergência de
 * arredondamento entre a coluna Total e a soma das colunas semanais.
 */
export async function fetchMetaMetricsWeekly(
  { period, filter }: MetaQuery,
  supabase: SupabaseLike
): Promise<GlobalMetricsWithWeeks> {
  const weeks = partitionWeeks(period.startDate, period.endDate);

  if (!filter.sources.meta) {
    return {
      ...ZEROED_META,
      weeks: weeks.map((week) => ({ ...week, ...ZEROED_META })),
    };
  }

  const rows = await paginate(() =>
    supabase
      .from("dash_gestao_meta_ads_campaigns_daily")
      .select(`date, ${COLUMNS}`)
      .gte("date", period.startDate)
      .lte("date", period.endDate)
      .or(filter.metaTerms.map((t) => `campaign_name.ilike.%${t}%`).join(","))
  ) as DatedCampaignRow[];

  return {
    ...aggregate(rows),
    weeks: weeks.map((week) => ({
      ...week,
      ...aggregate(rows.filter((r) => r.date >= week.startDate && r.date <= week.endDate)),
    })),
  };
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
  return aggregate(await paginate(() => baseQuery(period, supabase)));
}

interface AwaitableQuery {
  or(expr: string): AwaitableQuery;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

function baseQuery(period: Period, supabase: SupabaseLike): AwaitableQuery {
  return supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select(COLUMNS)
    .gte("date", period.startDate)
    .lte("date", period.endDate);
}

/**
 * O PostgREST trunca em 1000 linhas sem erro. Um período vitalício (tela
 * Eventos) passa disso fácil; sem paginar, o investimento sai subestimado.
 */
async function paginate(buildQuery: () => AwaitableQuery): Promise<CampaignRow[]> {
  const all: CampaignRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as CampaignRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
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
