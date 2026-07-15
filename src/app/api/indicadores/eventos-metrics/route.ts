import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { fetchEventosMetrics } from "@/lib/indicadores/service/eventos-metrics";
import type { FilterRecord } from "@/types/indicadores";

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
  const { data: filters, error: dbError } = await supabase
    .from("dash_gestao_filters")
    .select("*")
    .eq("account_id", account_id)
    .order("name", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const map = await fetchEventosMetrics(
    (filters ?? []) as FilterRecord[],
    createSupabaseServiceClient()
  );

  return NextResponse.json(map);
}
