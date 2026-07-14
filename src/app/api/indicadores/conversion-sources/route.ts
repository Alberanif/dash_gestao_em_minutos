import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { expandFromSearchParams } from "@/lib/indicadores/filter-expansion";
import {
  fetchConversionSources,
  fetchConversionSourcesUnscoped,
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
    const sources = filter.sources.hotmart
      ? await fetchConversionSources(query, supabase)
      : await fetchConversionSourcesUnscoped(query, supabase);
    return NextResponse.json(sources);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar origens de conversão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
