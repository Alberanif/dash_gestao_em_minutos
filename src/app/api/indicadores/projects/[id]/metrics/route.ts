import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { IndicadoresMetrics } from "@/types/indicadores";

function avgField(rows: Record<string, unknown>[], field: string): number | null {
  const vals = rows
    .map((r) => r[field])
    .filter((v): v is number => v !== null && v !== undefined && typeof v === "number");
  return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date e end_date são obrigatórios" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: project, error: projectError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .select("campaign_terms, organic_lead_events")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const terms: string[] = project.campaign_terms ?? [];
  const organicEvents: string[] = project.organic_lead_events ?? [];

  let campaignQuery = supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("spend, impressions, link_clicks, leads_all, page_views")
    .gte("date", start_date)
    .lte("date", end_date);

  if (terms.length > 0) {
    const ilikeFilter = terms.map((t) => `campaign_name.ilike.%${t}%`).join(",");
    campaignQuery = campaignQuery.or(ilikeFilter);
  } else {
    campaignQuery = campaignQuery.eq("campaign_id", "NO_MATCH");
  }

  const baseLeadsQuery = () =>
    supabase
      .from("dash_gestao_captacao_leads")
      .select("*", { count: "exact", head: true })
      .gte("data_cadastro", start_date)
      .lte("data_cadastro", end_date + "T23:59:59");

  let organicLeadsQuery = baseLeadsQuery().eq("utm_content", "ORG");
  let unknownLeadsQuery = baseLeadsQuery().eq("utm_content", "");

  if (organicEvents.length > 0) {
    organicLeadsQuery = organicLeadsQuery.in("evento", organicEvents);
    unknownLeadsQuery = unknownLeadsQuery.in("evento", organicEvents);
  } else {
    organicLeadsQuery = organicLeadsQuery.eq("evento", "__NO_MATCH__");
    unknownLeadsQuery = unknownLeadsQuery.eq("evento", "__NO_MATCH__");
  }

  const [campaignsResult, weeklyResult, organicResult, unknownResult] = await Promise.all([
    campaignQuery,
    supabase
      .from("dash_gestao_indicadores_weekly_data")
      .select("*")
      .eq("project_id", id)
      .gte("week_start", start_date)
      .lte("week_start", end_date),
    organicLeadsQuery,
    unknownLeadsQuery,
  ]);

  if (campaignsResult.error) {
    return NextResponse.json({ error: campaignsResult.error.message }, { status: 500 });
  }
  if (weeklyResult.error) {
    return NextResponse.json({ error: weeklyResult.error.message }, { status: 500 });
  }
  if (organicResult.error) {
    return NextResponse.json({ error: organicResult.error.message }, { status: 500 });
  }
  if (unknownResult.error) {
    return NextResponse.json({ error: unknownResult.error.message }, { status: 500 });
  }

  const campaigns = campaignsResult.data ?? [];
  const weekly = (weeklyResult.data ?? []) as Record<string, unknown>[];

  const meta_spend = campaigns.reduce((s, r) => s + (r.spend ?? 0), 0);
  const totalImpressions = campaigns.reduce((s, r) => s + ((r.impressions as number) ?? 0), 0);
  const totalLinkClicks = campaigns.reduce((s, r) => s + ((r.link_clicks as number) ?? 0), 0);
  const meta_leads = campaigns.reduce((s, r) => s + ((r.leads_all as number) ?? 0), 0);
  const totalPageViews = campaigns.reduce((s, r) => s + ((r.page_views as number) ?? 0), 0);
  const meta_cpm = totalImpressions > 0 ? (meta_spend / totalImpressions) * 1000 : 0;
  const meta_ctr = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
  const meta_connect_rate = totalLinkClicks > 0 ? (totalPageViews / totalLinkClicks) * 100 : null;
  const meta_cpl_traffic = meta_leads > 0 ? meta_spend / meta_leads : null;
  const meta_lp_conversion = totalPageViews > 0 ? (meta_leads / totalPageViews) * 100 : null;

  const metrics: IndicadoresMetrics = {
    meta_spend,
    meta_cpm,
    meta_ctr,
    meta_leads,
    meta_connect_rate,
    meta_lp_conversion,
    meta_cpl_traffic,
    google_spend: avgField(weekly, "google_spend"),
    google_cpm: avgField(weekly, "google_cpm"),
    google_leads: avgField(weekly, "google_leads"),
    google_connect_rate: avgField(weekly, "google_connect_rate"),
    google_cpl_traffic: avgField(weekly, "google_cpl_traffic"),
    google_lp_conversion: avgField(weekly, "google_lp_conversion"),
    organic_leads: organicResult.count ?? 0,
    unknown_leads: unknownResult.count ?? 0,
  };

  return NextResponse.json(metrics);
}
