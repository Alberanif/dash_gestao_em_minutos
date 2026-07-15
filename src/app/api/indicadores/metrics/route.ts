import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { expandFromSearchParams } from "@/lib/indicadores/filter-expansion";
import { fetchMetaMetrics, fetchMetaMetricsUnscoped } from "@/lib/indicadores/service/meta";

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
  const query = { period: { startDate, endDate }, filter };

  try {
    const metrics = filter.sources.meta
      ? await fetchMetaMetrics(query, supabase)
      : await fetchMetaMetricsUnscoped(query, supabase);
    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar métricas do Meta Ads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
