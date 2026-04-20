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
    .select("campaign_terms")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const terms: string[] = project.campaign_terms ?? [];

  let campaignQuery = supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("spend, impressions, clicks, conversions")
    .gte("date", start_date)
    .lte("date", end_date);

  if (terms.length > 0) {
    const ilikeFilter = terms.map((t) => `campaign_name.ilike.%${t}%`).join(",");
    campaignQuery = campaignQuery.or(ilikeFilter);
  } else {
    campaignQuery = campaignQuery.eq("campaign_id", "NO_MATCH");
  }

  const [campaignsResult, weeklyResult] = await Promise.all([
    campaignQuery,
    supabase
      .from("dash_gestao_indicadores_weekly_data")
      .select("*")
      .eq("project_id", id)
      .gte("week_start", start_date)
      .lte("week_start", end_date),
  ]);

  if (campaignsResult.error) {
    return NextResponse.json({ error: campaignsResult.error.message }, { status: 500 });
  }
  if (weeklyResult.error) {
    return NextResponse.json({ error: weeklyResult.error.message }, { status: 500 });
  }

  const campaigns = campaignsResult.data ?? [];
  const weekly = (weeklyResult.data ?? []) as Record<string, unknown>[];

  const meta_spend = campaigns.reduce((s, r) => s + (r.spend ?? 0), 0);
  const totalImpressions = campaigns.reduce((s, r) => s + ((r.impressions as number) ?? 0), 0);
  const totalClicks = campaigns.reduce((s, r) => s + ((r.clicks as number) ?? 0), 0);
  const meta_leads = campaigns.reduce((s, r) => s + ((r.conversions as number) ?? 0), 0);
  const meta_cpm = totalImpressions > 0 ? (meta_spend / totalImpressions) * 1000 : 0;
  const meta_ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const metrics: IndicadoresMetrics = {
    meta_spend,
    meta_cpm,
    meta_ctr,
    meta_leads,
    meta_connect_rate: avgField(weekly, "meta_connect_rate"),
    meta_lp_conversion: avgField(weekly, "meta_lp_conversion"),
    meta_cpl_traffic: avgField(weekly, "meta_cpl_traffic"),
    google_spend: avgField(weekly, "google_spend"),
    google_cpm: avgField(weekly, "google_cpm"),
    google_leads: avgField(weekly, "google_leads"),
    google_connect_rate: avgField(weekly, "google_connect_rate"),
    google_cpl_traffic: avgField(weekly, "google_cpl_traffic"),
    google_lp_conversion: avgField(weekly, "google_lp_conversion"),
  };

  return NextResponse.json(metrics);
}
