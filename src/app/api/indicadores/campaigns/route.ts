import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { expandFromSearchParams } from "@/lib/indicadores/filter-expansion";
import { fetchMetaCampaigns, normalizeSearch } from "@/lib/indicadores/service/meta-campaigns";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const search = normalizeSearch(searchParams.get("q"));
  const filter = expandFromSearchParams(searchParams);
  const supabase = createSupabaseServiceClient();

  try {
    const result = await fetchMetaCampaigns({ period: { startDate, endDate }, filter }, supabase, search);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar as campanhas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
