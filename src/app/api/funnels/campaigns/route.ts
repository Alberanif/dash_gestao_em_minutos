// src/app/api/funnels/campaigns/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { CampaignOption } from "@/types/funnels";

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

  // Buscar de dash_gestao_meta_ads_campaigns_daily (tem leads_pixel + dados diários)
  const query = supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("campaign_id, campaign_name, account_id, date")
    .in("account_id", accountIds)
    .order("date", { ascending: false })
    .limit(1000);

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicar por campaign_id e filtrar por termos
  const seen = new Set<string>();
  const unique: CampaignOption[] = [];

  for (const row of data ?? []) {
    if (seen.has(row.campaign_id)) continue;

    // Se há termos, filtrar por ILIKE (todos os termos devem estar presentes)
    if (terms.length > 0) {
      const cleanName = row.campaign_name.toLowerCase();
      const allTermsMatch = terms.every((term) => {
        const cleanTerm = term.toLowerCase();
        return cleanName.includes(cleanTerm);
      });
      if (!allTermsMatch) continue;
    }

    seen.add(row.campaign_id);
    unique.push({
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      account_id: row.account_id,
    });
  }

  // Ordenar alfabeticamente por nome
  unique.sort((a, b) => a.campaign_name.localeCompare(b.campaign_name, "pt-BR"));

  return NextResponse.json(unique);
}
