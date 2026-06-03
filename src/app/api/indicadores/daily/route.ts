import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { DailyPoint } from "@/types/indicadores";

function brtToUtc(dateStr: string, endOfDay = false): string {
  const time = endOfDay ? "T23:59:59" : "T00:00:00";
  return new Date(`${dateStr}${time}-03:00`).toISOString();
}

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const startUtc = brtToUtc(start_date, false);
  const endUtc = brtToUtc(end_date, true);

  const supabase = createSupabaseServiceClient();

  const [metaResult, hotmartResult, leadsResult] = await Promise.all([
    supabase
      .from("dash_gestao_meta_ads_campaigns_daily")
      .select("date, spend, leads_all, checkout")
      .gte("date", start_date)
      .lte("date", end_date),
    supabase
      .from("dash_gestao_hotmart_sales")
      .select("purchase_date")
      .in("status", ["COMPLETE", "APPROVED"])
      .gte("purchase_date", startUtc)
      .lte("purchase_date", endUtc),
    supabase
      .from("dash_gestao_captacao_leads")
      .select("data_cadastro")
      .gte("data_cadastro", `${start_date}T00:00:00`)
      .lte("data_cadastro", `${end_date}T23:59:59`)
      .limit(10_000),
  ]);

  if (metaResult.error) {
    return NextResponse.json({ error: metaResult.error.message }, { status: 500 });
  }
  if (hotmartResult.error) {
    return NextResponse.json({ error: hotmartResult.error.message }, { status: 500 });
  }
  if (leadsResult.error) {
    return NextResponse.json({ error: leadsResult.error.message }, { status: 500 });
  }

  // Aggregate Meta Ads by date
  const metaByDate = new Map<string, { spend: number; leads: number; checkout: number }>();
  for (const row of (metaResult.data ?? []) as { date: string; spend: number; leads_all: number; checkout: number }[]) {
    const d = row.date;
    const existing = metaByDate.get(d);
    if (existing) {
      existing.spend += row.spend ?? 0;
      existing.leads += row.leads_all ?? 0;
      existing.checkout += row.checkout ?? 0;
    } else {
      metaByDate.set(d, { spend: row.spend ?? 0, leads: row.leads_all ?? 0, checkout: row.checkout ?? 0 });
    }
  }

  // Aggregate Hotmart by BRT date (slice purchase_date to date string)
  const hotmartByDate = new Map<string, number>();
  for (const row of (hotmartResult.data ?? []) as { purchase_date: string }[]) {
    // Convert UTC timestamp back to BRT date by subtracting 3h
    const brtDate = new Date(new Date(row.purchase_date).getTime() - 3 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    hotmartByDate.set(brtDate, (hotmartByDate.get(brtDate) ?? 0) + 1);
  }

  // Aggregate leads by date
  const leadsByDate = new Map<string, number>();
  for (const row of (leadsResult.data ?? []) as { data_cadastro: string }[]) {
    const d = row.data_cadastro.slice(0, 10);
    leadsByDate.set(d, (leadsByDate.get(d) ?? 0) + 1);
  }

  // Build complete date range
  const allDates = new Set<string>([
    ...metaByDate.keys(),
    ...hotmartByDate.keys(),
    ...leadsByDate.keys(),
  ]);

  // Fill gaps in the date range between start_date and end_date
  const start = new Date(start_date);
  const end = new Date(end_date);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDates.add(d.toISOString().slice(0, 10));
  }

  const points: DailyPoint[] = Array.from(allDates)
    .sort()
    .map((date) => {
      const meta = metaByDate.get(date);
      const meta_spend = meta?.spend ?? 0;
      const meta_leads = meta?.leads ?? 0;
      const meta_checkout = meta?.checkout ?? 0;
      const meta_cpl_traffic = meta_leads > 0 ? meta_spend / meta_leads : null;

      return {
        date,
        meta_spend,
        meta_leads,
        meta_cpl_traffic,
        meta_checkout,
        hotmart_sales: hotmartByDate.get(date) ?? 0,
        lead_captacoes: leadsByDate.get(date) ?? 0,
      };
    });

  return NextResponse.json(points);
}
