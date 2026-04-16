// src/app/api/funnels/campaigns/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface CampaignOption {
  campaign_id: string;
  campaign_name: string;
  account_id: string;
}

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const rawAccountIds = request.nextUrl.searchParams.get("account_ids") ?? "";
  const rawTerms = request.nextUrl.searchParams.get("terms") ?? "";

  const accountIds = rawAccountIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const terms = rawTerms
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (accountIds.length === 0) {
    return NextResponse.json([]);
  }

  const supabase = createSupabaseServiceClient();

  let query = supabase
    .from("dash_gestao_meta_ads_campaigns")
    .select("campaign_id, campaign_name, account_id, collected_date")
    .in("account_id", accountIds)
    .order("collected_date", { ascending: false });

  // Filtrar por termos ILIKE (OR entre termos)
  if (terms.length > 0) {
    const ilikeClauses = terms
      .map((t) => `campaign_name.ilike.%${t}%`)
      .join(",");
    query = query.or(ilikeClauses);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicar por campaign_id (mantém snapshot mais recente — já ordenado DESC)
  const seen = new Set<string>();
  const unique: CampaignOption[] = [];
  for (const row of data ?? []) {
    if (!seen.has(row.campaign_id)) {
      seen.add(row.campaign_id);
      unique.push({
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        account_id: row.account_id,
      });
    }
  }

  // Ordenar alfabeticamente por nome
  unique.sort((a, b) => a.campaign_name.localeCompare(b.campaign_name, "pt-BR"));

  return NextResponse.json(unique);
}
