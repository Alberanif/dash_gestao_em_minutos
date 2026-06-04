import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { LancamentoPagoConfig, LancamentoConfig, FunnelMetrics } from "@/types/funnels";

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

  const { start_date, end_date, goal_sales, type } = funnel;

  const totalDays =
    Math.round(
      (new Date(end_date).getTime() - new Date(start_date).getTime()) / 86_400_000
    ) + 1;

  if (type === "lancamento_pago") {
    // ─── Lançamento Pago: Hotmart + Meta Ads Spend ─────────────────────────
    const config = funnel.config as LancamentoPagoConfig;

    const salesPromise =
      (config.product_ids ?? []).length > 0
        ? supabase
            .from("dash_gestao_hotmart_sales")
            .select("id", { count: "exact", head: true })
            .in("product_id", config.product_ids ?? [])
            .in("status", STATUS_APPROVED)
            .gte("purchase_date", start_date)
            .lte("purchase_date", end_date + "T23:59:59")
        : Promise.resolve({ count: 0, error: null });

    const salesBrlPromise =
      (config.product_ids ?? []).length > 0
        ? supabase
            .from("dash_gestao_hotmart_sales")
            .select("id", { count: "exact", head: true })
            .in("product_id", config.product_ids ?? [])
            .in("status", STATUS_APPROVED)
            .gte("purchase_date", start_date)
            .lte("purchase_date", end_date + "T23:59:59")
            .eq("currency", "BRL")
        : Promise.resolve({ count: 0, error: null });

    const spendPromise =
      (config.campaign_ids ?? []).length > 0
        ? supabase
            .from("dash_gestao_meta_ads_campaigns_daily")
            .select("spend")
            .in("campaign_id", config.campaign_ids ?? [])
            .gte("date", start_date)
            .lte("date", end_date)
        : (config.ad_account_ids ?? []).length > 0
        ? supabase
            .from("dash_gestao_meta_ads_campaigns_daily")
            .select("spend")
            .in("account_id", config.ad_account_ids ?? [])
            .gte("date", start_date)
            .lte("date", end_date)
        : Promise.resolve({ data: [], error: null });

    const [salesResult, salesBrlResult, spendResult] = await Promise.all([
      salesPromise,
      salesBrlPromise,
      spendPromise,
    ]);

    if (salesResult.error) {
      return NextResponse.json({ error: salesResult.error.message }, { status: 500 });
    }
    if (salesBrlResult.error) {
      return NextResponse.json({ error: salesBrlResult.error.message }, { status: 500 });
    }
    if (spendResult.error) {
      return NextResponse.json({ error: spendResult.error.message }, { status: 500 });
    }

    const total_sales = salesResult.count ?? 0;
    const total_sales_brl = salesBrlResult.count ?? 0;
    const total_sales_other_currencies = Math.max(0, total_sales - total_sales_brl);
    const spendRows = (spendResult.data as { spend: number }[] | null) ?? [];
    const total_spend = spendRows.reduce((sum, r) => sum + (r.spend ?? 0), 0);
    const cac = total_sales > 0 ? total_spend / total_sales : 0;
    const pace_diario = Math.round(total_sales / totalDays);
    const pace_ideal = Math.round(goal_sales / totalDays);
    const sales_remaining = Math.max(0, goal_sales - total_sales);

    const metrics: FunnelMetrics = {
      type: "lancamento_pago",
      total_sales,
      total_sales_brl,
      total_sales_other_currencies,
      total_spend,
      cac,
      pace_diario,
      pace_ideal,
      sales_remaining,
    };

    return NextResponse.json(metrics);
  } else if (type === "lancamento") {
    // ─── Lançamento: Meta Ads Leads + Spend ──────────────────────────────
    const config = funnel.config as LancamentoConfig;

    const leadsSpendPromise =
      (config.campaign_ids ?? []).length > 0
        ? supabase
            .from("dash_gestao_meta_ads_campaigns_daily")
            .select("leads_all, spend")
            .in("campaign_id", config.campaign_ids ?? [])
            .gte("date", start_date)
            .lte("date", end_date)
        : (config.ad_account_ids ?? []).length > 0
        ? supabase
            .from("dash_gestao_meta_ads_campaigns_daily")
            .select("leads_all, spend")
            .in("account_id", config.ad_account_ids ?? [])
            .gte("date", start_date)
            .lte("date", end_date)
        : Promise.resolve({ data: [], error: null });

    const { data: leadsSpendData, error: leadsSpendError } = await leadsSpendPromise;

    if (leadsSpendError) {
      return NextResponse.json({ error: leadsSpendError.message }, { status: 500 });
    }

    const rows = (leadsSpendData as { leads_all: number; spend: number }[] | null) ?? [];
    const total_leads = rows.reduce((sum, r) => sum + (r.leads_all ?? 0), 0);
    const total_spend = rows.reduce((sum, r) => sum + (r.spend ?? 0), 0);
    const cpl = total_leads > 0 ? total_spend / total_leads : 0;
    const pace_diario_leads = Math.round(total_leads / totalDays);
    const pace_ideal_leads = Math.round(goal_sales / totalDays);
    const leads_remaining = Math.max(0, goal_sales - total_leads);

    const metrics: FunnelMetrics = {
      type: "lancamento",
      total_leads,
      total_spend,
      cpl,
      pace_diario_leads,
      pace_ideal_leads,
      leads_remaining,
    };

    return NextResponse.json(metrics);
  } else {
    return NextResponse.json(
      { error: `Tipo de funil desconhecido: ${type}` },
      { status: 400 }
    );
  }
}
