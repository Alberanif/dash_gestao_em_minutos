import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadEventosMetrics } from "@/lib/indicadores/leitura-complementar";

/**
 * Métricas vitalícias de todos os filtros da conta numa única resposta:
 * { filter_id: { leads, spend, cpl } | null }.
 */
export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const account_id = request.nextUrl.searchParams.get("account_id");
  if (!account_id) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const result = await loadEventosMetrics(account_id, supabase, createSupabaseServiceClient());

  if (result.error !== undefined) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result.data);
}
