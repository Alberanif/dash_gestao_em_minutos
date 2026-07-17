import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { expandFromSearchParams } from "@/lib/indicadores/filter-expansion";
import {
  fetchHotmartMetrics,
  fetchHotmartMetricsUnscoped,
  fetchHotmartMetricsWeekly,
} from "@/lib/indicadores/service/hotmart";

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
    // Opt-in da Planilha: agrega também por semana quinta→quarta. Sem o
    // parâmetro, a resposta permanece exatamente a de sempre.
    if (searchParams.get("breakdown") === "weekly") {
      return NextResponse.json(await fetchHotmartMetricsWeekly(query, supabase));
    }
    const metrics = filter.sources.hotmart
      ? await fetchHotmartMetrics(query, supabase)
      : await fetchHotmartMetricsUnscoped(query, supabase);
    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar métricas da Hotmart";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
