import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { EqaEventosProject, EqaEventosMetrics } from "@/types/eqa-eventos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const start_date = request.nextUrl.searchParams.get("start_date");
  const end_date = request.nextUrl.searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date e end_date são obrigatórios" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: project, error: projectError } = await supabase
    .from("dash_gestao_eqa_eventos_comercial")
    .select("*")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const typedProject = project as EqaEventosProject;
  const { lead_events, campaign_ids } = typedProject;

  // Total leads from captacao_leads
  let leadsQuery = supabase
    .from("dash_gestao_captacao_leads")
    .select("id", { count: "exact", head: true })
    .gte("data_cadastro", `${start_date}T00:00:00`)
    .lte("data_cadastro", `${end_date}T23:59:59`);

  if ((lead_events ?? []).length > 0) {
    leadsQuery = leadsQuery.in("evento", lead_events);
  }

  // Total spend from meta_ads_campaigns_daily filtered by campaign_ids
  let spendQuery = supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("spend")
    .gte("date", start_date)
    .lte("date", end_date);

  if ((campaign_ids ?? []).length > 0) {
    spendQuery = spendQuery.in("campaign_id", campaign_ids);
  }

  const [leadsResult, spendResult] = await Promise.all([
    leadsQuery,
    spendQuery,
  ]);

  if (leadsResult.error) {
    return NextResponse.json({ error: leadsResult.error.message }, { status: 500 });
  }
  if (spendResult.error) {
    return NextResponse.json({ error: spendResult.error.message }, { status: 500 });
  }

  const total_leads = leadsResult.count ?? 0;
  const spendRows = (spendResult.data as { spend: number }[] | null) ?? [];
  const total_spend = spendRows.reduce((sum, r) => sum + (r.spend ?? 0), 0);
  const cpl = total_leads > 0 ? total_spend / total_leads : null;

  const metrics: EqaEventosMetrics = {
    total_leads,
    total_spend,
    cpl,
  };

  return NextResponse.json(metrics);
}
