import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { normalizeAdsComercialConfig } from "@/lib/convite/ads-comercial";
import type { ConviteAdsComercialConfig } from "@/types/convite";

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return [...new Set(
    values
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
  )];
}

async function getConviteProject(
  id: string,
  supabase: ReturnType<typeof createSupabaseServiceClient>
) {
  const { data, error } = await supabase
    .from("dash_gestao_convite_projetos")
    .select("id, grupo")
    .eq("id", id)
    .single();

  if (error || !data) {
    return { error: NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 }), project: null };
  }

  if (data.grupo !== "funil_ads_comercial") {
    return { error: NextResponse.json({ error: "Projeto não pertence ao Funil ADS Comercial" }, { status: 400 }), project: null };
  }

  return { error: null, project: data };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const projectCheck = await getConviteProject(id, supabase);
  if (projectCheck.error) return projectCheck.error;

  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_funil_ads_comercial_projects")
    .select("*")
    .eq("convite_project_id", id)
    .maybeSingle();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(normalizeAdsComercialConfig(data as Partial<ConviteAdsComercialConfig> | null));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const supabase = createSupabaseServiceClient();

  const projectCheck = await getConviteProject(id, supabase);
  if (projectCheck.error) return projectCheck.error;

  const hotmartAccountId = typeof body.hotmart_account_id === "string" && body.hotmart_account_id.trim()
    ? body.hotmart_account_id.trim()
    : null;
  const hotmartProductIds = normalizeStringArray(body.hotmart_product_ids);
  const metaAdsAccountIds = normalizeStringArray(body.meta_ads_account_ids);
  const campaignTerms = normalizeStringArray(body.campaign_terms);
  const organicLeadEvents = normalizeStringArray(body.organic_lead_events);

  if (!hotmartAccountId) {
    return NextResponse.json({ error: "Conta Hotmart é obrigatória" }, { status: 400 });
  }
  if (hotmartProductIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um produto Hotmart" }, { status: 400 });
  }
  if (metaAdsAccountIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma conta Meta Ads" }, { status: 400 });
  }
  if (campaignTerms.length === 0) {
    return NextResponse.json({ error: "Informe ao menos um termo de campanha" }, { status: 400 });
  }
  if (organicLeadEvents.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um evento orgânico" }, { status: 400 });
  }

  const [hotmartAccountResult, metaAccountsResult] = await Promise.all([
    supabase
      .from("dash_gestao_accounts")
      .select("id, platform")
      .eq("id", hotmartAccountId)
      .eq("platform", "hotmart")
      .maybeSingle(),
    supabase
      .from("dash_gestao_accounts")
      .select("id, platform")
      .in("id", metaAdsAccountIds)
      .eq("platform", "meta-ads"),
  ]);

  if (hotmartAccountResult.error) {
    return NextResponse.json({ error: hotmartAccountResult.error.message }, { status: 500 });
  }
  if (!hotmartAccountResult.data) {
    return NextResponse.json({ error: "Conta Hotmart inválida" }, { status: 400 });
  }
  if (metaAccountsResult.error) {
    return NextResponse.json({ error: metaAccountsResult.error.message }, { status: 500 });
  }
  if ((metaAccountsResult.data ?? []).length !== metaAdsAccountIds.length) {
    return NextResponse.json({ error: "Uma ou mais contas Meta Ads são inválidas" }, { status: 400 });
  }

  const { data, error: upsertError } = await supabase
    .from("dash_gestao_convite_funil_ads_comercial_projects")
    .upsert(
      {
        convite_project_id: id,
        hotmart_account_id: hotmartAccountId,
        hotmart_product_ids: hotmartProductIds,
        meta_ads_account_ids: metaAdsAccountIds,
        campaign_terms: campaignTerms,
        organic_lead_events: organicLeadEvents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "convite_project_id" }
    )
    .select("*")
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json(normalizeAdsComercialConfig(data as Partial<ConviteAdsComercialConfig>) ?? data);
}
