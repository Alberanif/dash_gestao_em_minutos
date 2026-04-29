import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { CampaignOption } from "@/types/eqa-eventos";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const rawTerms = request.nextUrl.searchParams.get("terms") ?? "";

  const terms = rawTerms
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = createSupabaseServiceClient();

  let query = supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("campaign_id, campaign_name")
    .order("date", { ascending: false })
    .limit(500);

  // Filtrar por termos ILIKE (OR entre termos)
  if (terms.length > 0) {
    const ilikeClauses = terms
      .map((t) => t.replace(/[(),%]/g, ""))
      .filter(Boolean)
      .map((t) => `campaign_name.ilike.%${t}%`)
      .join(",");
    if (ilikeClauses) {
      query = query.or(ilikeClauses);
    }
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicar por campaign_id
  const seen = new Set<string>();
  const unique: CampaignOption[] = [];
  for (const row of data ?? []) {
    if (!seen.has(row.campaign_id)) {
      seen.add(row.campaign_id);
      unique.push({
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
      });
    }
  }

  // Ordenar alfabeticamente por nome
  unique.sort((a, b) => a.campaign_name.localeCompare(b.campaign_name, "pt-BR"));

  return NextResponse.json(unique);
}
