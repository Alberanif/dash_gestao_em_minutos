import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { readPeriod } from "@/lib/indicadores/leitura";
import { loadLeadsMetrics } from "@/lib/indicadores/leitura-complementar";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const period = readPeriod(searchParams);

  if (!period) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  try {
    return NextResponse.json(await loadLeadsMetrics(searchParams, period, supabase));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
