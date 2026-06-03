import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { GlobalMetrics } from "@/types/indicadores";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data, error: dbError } = await supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("spend, impressions, link_clicks, leads_all, page_views, checkout")
    .gte("date", start_date)
    .lte("date", end_date);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const rows = (data ?? []) as {
    spend: number;
    impressions: number;
    link_clicks: number;
    leads_all: number;
    page_views: number;
    checkout: number;
  }[];

  const meta_spend = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
  const meta_impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const meta_link_clicks = rows.reduce((s, r) => s + (r.link_clicks ?? 0), 0);
  const meta_leads = rows.reduce((s, r) => s + (r.leads_all ?? 0), 0);
  const meta_page_views = rows.reduce((s, r) => s + (r.page_views ?? 0), 0);
  const meta_checkout = rows.reduce((s, r) => s + (r.checkout ?? 0), 0);

  const meta_cpm = meta_impressions > 0 ? (meta_spend / meta_impressions) * 1000 : 0;
  const meta_ctr = meta_impressions > 0 ? (meta_link_clicks / meta_impressions) * 100 : 0;
  const meta_connect_rate = meta_link_clicks > 0 ? (meta_page_views / meta_link_clicks) * 100 : null;
  const meta_lp_conversion = meta_page_views > 0 ? (meta_leads / meta_page_views) * 100 : null;
  const meta_cpl_traffic = meta_leads > 0 ? meta_spend / meta_leads : null;

  const metrics: GlobalMetrics = {
    meta_spend,
    meta_cpm,
    meta_ctr,
    meta_leads,
    meta_checkout,
    meta_impressions,
    meta_link_clicks,
    meta_page_views,
    meta_connect_rate,
    meta_lp_conversion,
    meta_cpl_traffic,
  };

  return NextResponse.json(metrics);
}
