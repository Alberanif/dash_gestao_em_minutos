import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { expandFromSearchParams } from "@/lib/indicadores/filter-expansion";
import {
  fetchConversionSources,
  fetchConversionSourcesUnscoped,
  fetchConversionSourcesWeekly,
} from "@/lib/indicadores/service/conversion-sources";

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
    // Opt-in da Planilha: com breakdown=weekly a resposta vira um objeto
    // { sources, weeks } — sem o parâmetro, segue o array de sempre.
    if (searchParams.get("breakdown") === "weekly") {
      return NextResponse.json(await fetchConversionSourcesWeekly(query, supabase));
    }
    const sources = filter.sources.hotmart
      ? await fetchConversionSources(query, supabase)
      : await fetchConversionSourcesUnscoped(query, supabase);
    return NextResponse.json(sources);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar origens de conversão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
