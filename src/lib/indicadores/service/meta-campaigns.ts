import type { MetaCampaignRow, MetaCampaignsResponse } from "@/types/indicadores";
import { aggregate, paginate, ZEROED_META, type CampaignRow, type MetaQuery } from "./meta";
import type { SupabaseLike } from "./types";

const COLUMNS =
  "campaign_id, campaign_name, date, spend, impressions, link_clicks, leads_all, page_views, checkout";

export const MAX_SEARCH_LENGTH = 100;

/** Termo da busca: sem espaços nas pontas e limitado a MAX_SEARCH_LENGTH. Vazio = sem filtro. */
export function normalizeSearch(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, MAX_SEARCH_LENGTH).trim();
}

/** Escapa os curingas do LIKE para que o termo seja buscado como texto literal. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface CampaignDailyRow extends CampaignRow {
  campaign_id: string;
  campaign_name: string;
  date: string;
}

/**
 * Campanhas Meta Ads no escopo do filtro, somadas por `campaign_id`. Datas
 * cruas (a tabela diária já está em BRT). O Total cobre todas as linhas
 * casadas, inclusive as de campanhas ocultas por gasto zero, para bater com
 * `fetchMetaMetrics`. Com `search`, só entram as campanhas cujo nome contém o
 * termo (ILIKE literal, em AND com o filtro de campanhas), e linhas, Total e
 * ocultas passam a refletir apenas esse subconjunto.
 */
export async function fetchMetaCampaigns(
  { period, filter }: MetaQuery,
  supabase: SupabaseLike,
  search?: string
): Promise<MetaCampaignsResponse> {
  if (!filter.sources.meta) {
    return { campaigns: [], hidden_zero_spend: 0, total: { ...ZEROED_META } };
  }

  const term = normalizeSearch(search);

  const rows = (await paginate(() => {
    const query = supabase
      .from("dash_gestao_meta_ads_campaigns_daily")
      .select(COLUMNS)
      .gte("date", period.startDate)
      .lte("date", period.endDate)
      .or(filter.metaTerms.map((t) => `campaign_name.ilike.%${t}%`).join(","));
    return term ? query.ilike("campaign_name", `%${escapeLike(term)}%`) : query;
  })) as CampaignDailyRow[];

  const groups = new Map<string, CampaignDailyRow[]>();
  for (const row of rows) {
    const group = groups.get(row.campaign_id);
    if (group) group.push(row);
    else groups.set(row.campaign_id, [row]);
  }

  const all: MetaCampaignRow[] = [];
  for (const [campaign_id, group] of groups) {
    const latest = group.reduce((a, b) => (b.date > a.date ? b : a));
    all.push({ campaign_id, campaign_name: latest.campaign_name, ...aggregate(group) });
  }

  const campaigns = all
    .filter((c) => c.meta_spend > 0)
    .sort((a, b) => b.meta_spend - a.meta_spend);

  return {
    campaigns,
    hidden_zero_spend: all.length - campaigns.length,
    total: aggregate(rows),
  };
}
