import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { expandFromSearchParams } from "@/lib/indicadores/filter-expansion";
import { fetchDailySeries } from "@/lib/indicadores/service/daily";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const filter = expandFromSearchParams(searchParams);
  const supabase = createSupabaseServiceClient();

  try {
    const series = await fetchDailySeries({ period: { startDate, endDate }, filter }, supabase);
    return NextResponse.json(series);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar a série diária";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
