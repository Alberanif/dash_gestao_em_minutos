import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  ConviteAdsComercialConfig,
  ConviteAdsComercialMetrics,
} from "@/types/convite";

const HOTMART_STATUS_APPROVED = ["COMPLETE", "APPROVED"];

type SupabaseClient = ReturnType<typeof createSupabaseServiceClient>;

interface ProjectPeriod {
  id: string;
  data_inicio: string;
  data_fim: string;
}

interface MetaAdsCampaignDailyRow {
  campaign_name: string;
  leads_all: number | null;
}

function toUtcRange(dateFrom: string, dateTo: string) {
  const normalizedFrom = toDateOnly(dateFrom);
  const normalizedTo = toDateOnly(dateTo);

  return {
    startUTC: new Date(`${normalizedFrom}T00:00:00-03:00`).toISOString(),
    endUTC: new Date(`${normalizedTo}T23:59:59-03:00`).toISOString(),
  };
}

function toDateOnly(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function normalizeArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return [...new Set(
    values
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
  )];
}

function sanitizeCampaignTerm(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/[(),%]/g, "")
    .trim();
}

function matchesCampaignTerms(campaignName: string, terms: string[]) {
  const normalizedCampaignName = sanitizeCampaignTerm(campaignName);
  return terms.some((term) => normalizedCampaignName.includes(term));
}

export function normalizeAdsComercialConfig(
  row: Partial<ConviteAdsComercialConfig> | null | undefined
): ConviteAdsComercialConfig | null {
  if (!row?.id || !row.convite_project_id) {
    return null;
  }

  return {
    id: row.id,
    convite_project_id: row.convite_project_id,
    hotmart_account_id: row.hotmart_account_id ?? null,
    hotmart_product_ids: normalizeArray(row.hotmart_product_ids),
    meta_ads_account_ids: normalizeArray(row.meta_ads_account_ids),
    campaign_terms: normalizeArray(row.campaign_terms),
    organic_lead_events: normalizeArray(row.organic_lead_events),
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

async function getOrganicLeadsCount(
  supabase: SupabaseClient,
  events: string[],
  dataInicio: string,
  dataFim: string
) {
  const baseQuery = (utmContent: string) =>
    supabase
      .from("dash_gestao_captacao_leads")
      .select("*", { count: "exact", head: true })
      .gte("data_cadastro", dataInicio)
      .lte("data_cadastro", `${dataFim}T23:59:59`)
      .eq("utm_content", utmContent)
      .in("evento", events);

  const [orgResult, unknownResult] = await Promise.all([
    baseQuery("ORG"),
    baseQuery(""),
  ]);

  if (orgResult.error) throw new Error(orgResult.error.message);
  if (unknownResult.error) throw new Error(unknownResult.error.message);

  return (orgResult.count ?? 0) + (unknownResult.count ?? 0);
}

export async function calculateAdsComercialMetrics(
  supabase: SupabaseClient,
  project: ProjectPeriod,
  config: ConviteAdsComercialConfig | null
): Promise<ConviteAdsComercialMetrics | null> {
  if (
    !config?.hotmart_account_id ||
    config.hotmart_product_ids.length === 0 ||
    config.meta_ads_account_ids.length === 0 ||
    config.campaign_terms.length === 0 ||
    config.organic_lead_events.length === 0
  ) {
    return null;
  }

  const { startUTC, endUTC } = toUtcRange(project.data_inicio, project.data_fim);
  const dataInicio = toDateOnly(project.data_inicio);
  const dataFim = toDateOnly(project.data_fim);
  const normalizedCampaignTerms = config.campaign_terms
    .map((term) => term.replace(/[(),%]/g, "").trim())
    .map(sanitizeCampaignTerm)
    .filter(Boolean);

  if (normalizedCampaignTerms.length === 0) {
    return null;
  }

  const [salesResult, metaResult, metaSpendResult, organicLeads] = await Promise.all([
    supabase
      .from("dash_gestao_hotmart_sales")
      .select("price, currency")
      .eq("account_id", config.hotmart_account_id)
      .in("product_id", config.hotmart_product_ids)
      .in("status", HOTMART_STATUS_APPROVED)
      .gte("purchase_date", startUTC)
      .lte("purchase_date", endUTC),
    supabase
      .from("dash_gestao_meta_ads_campaigns_daily")
      .select("campaign_name, leads_all")
      .in("account_id", config.meta_ads_account_ids)
      .gte("date", dataInicio)
      .lte("date", dataFim),
    supabase
      .from("dash_gestao_meta_ads_daily")
      .select("spend")
      .in("account_id", config.meta_ads_account_ids)
      .gte("date", dataInicio)
      .lte("date", dataFim),
    getOrganicLeadsCount(supabase, config.organic_lead_events, dataInicio, dataFim),
  ]);

  if (salesResult.error) throw new Error(salesResult.error.message);
  if (metaResult.error) throw new Error(metaResult.error.message);
  if (metaSpendResult.error) throw new Error(metaSpendResult.error.message);

  const totalSales = (salesResult.data ?? []).length;
  const totalRevenue = (salesResult.data ?? []).reduce(
    (sum, row) => sum + (row.currency === "BRL" ? Number(row.price ?? 0) : 0),
    0
  );
  const metaSpend = (metaSpendResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.spend ?? 0),
    0
  );
  const matchingMetaRows = ((metaResult.data ?? []) as MetaAdsCampaignDailyRow[]).filter((row) =>
    matchesCampaignTerms(String(row.campaign_name ?? ""), normalizedCampaignTerms)
  );
  const metaLeads = matchingMetaRows.reduce(
    (sum, row) => sum + Number(row.leads_all ?? 0),
    0
  );
  const totalLeads = metaLeads + organicLeads;

  return {
    total_sales: totalSales,
    total_revenue: totalRevenue,
    total_leads: totalLeads,
    meta_leads: metaLeads,
    organic_leads: organicLeads,
    meta_spend: metaSpend,
    sales_conversion_rate: totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0,
    cac: totalSales > 0 ? metaSpend / totalSales : 0,
  };
}
