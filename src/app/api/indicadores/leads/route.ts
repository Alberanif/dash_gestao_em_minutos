import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { GlobalLeadsMetrics } from "@/types/indicadores";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data, error: dbError } = await supabase
    .from("dash_gestao_captacao_leads")
    .select("evento")
    .gte("data_cadastro", `${start_date}T00:00:00`)
    .lte("data_cadastro", `${end_date}T23:59:59`)
    .limit(10_000);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const rows = (data ?? []) as { evento: string }[];

  const eventMap = new Map<string, number>();
  for (const row of rows) {
    const ev = row.evento ?? "DESCONHECIDO";
    eventMap.set(ev, (eventMap.get(ev) ?? 0) + 1);
  }

  const by_event = Array.from(eventMap.entries())
    .map(([evento, count]) => ({ evento, count }))
    .sort((a, b) => b.count - a.count);

  const result: GlobalLeadsMetrics = { total: rows.length, by_event };

  return NextResponse.json(result);
}
