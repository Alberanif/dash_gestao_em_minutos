import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { DestraveConfig } from "@/types/funnels";

const STATUS_APPROVED = ["COMPLETE", "APPROVED"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: funnel, error: funnelError } = await supabase
    .from("dash_gestao_funnels")
    .select("*")
    .eq("id", id)
    .single();

  if (funnelError || !funnel) {
    return NextResponse.json({ error: "Funil não encontrado" }, { status: 404 });
  }

  const config = funnel.config as DestraveConfig;
  const { start_date, end_date, goal_sales } = funnel;

  const totalDays =
    Math.round(
      (new Date(end_date).getTime() - new Date(start_date).getTime()) / 86_400_000
    ) + 1;
  const pace_diario = Math.round(goal_sales / totalDays);

  // ─── Vendas Hotmart ───────────────────────────────────────────
  const salesPromise =
    (config.product_ids ?? []).length > 0
      ? supabase
          .from("dash_gestao_hotmart_sales")
          .select("id", { count: "exact", head: true })
          .in("product_id", config.product_ids)
          .in("status", STATUS_APPROVED)
          .gte("purchase_date", start_date)
          .lte("purchase_date", end_date + "T23:59:59")
      : Promise.resolve({ count: 0, error: null });

  // ─── Spend Meta Ads ───────────────────────────────────────────
  // Se campaign_ids foram selecionados: usa tabela de campanhas (nível campanha)
  // Caso contrário: usa tabela diária (nível conta) — comportamento anterior
  const spendPromise =
    (config.campaign_ids ?? []).length > 0
      ? supabase
          .from("dash_gestao_meta_ads_campaigns")
          .select("spend")
          .in("campaign_id", config.campaign_ids)
          .gte("collected_date", start_date)
          .lte("collected_date", end_date)
      : (config.ad_account_ids ?? []).length > 0
      ? supabase
          .from("dash_gestao_meta_ads_daily")
          .select("spend")
          .in("account_id", config.ad_account_ids)
          .gte("date", start_date)
          .lte("date", end_date)
      : Promise.resolve({ data: [], error: null });

  const [salesResult, spendResult] = await Promise.all([salesPromise, spendPromise]);

  if (salesResult.error) {
    return NextResponse.json({ error: salesResult.error.message }, { status: 500 });
  }
  if (spendResult.error) {
    return NextResponse.json({ error: spendResult.error.message }, { status: 500 });
  }

  const total_sales = salesResult.count ?? 0;
  const spendRows = (spendResult.data as { spend: number }[] | null) ?? [];
  const total_spend = spendRows.reduce((sum, r) => sum + (r.spend ?? 0), 0);
  const cac = total_sales > 0 ? total_spend / total_sales : 0;

  return NextResponse.json({ total_sales, total_spend, cac, pace_diario });
}
