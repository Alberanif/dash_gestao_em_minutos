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

  const eventos = searchParams.getAll("eventos[]");
  const supabase = createSupabaseServiceClient();

  try {
    if (eventos.length > 0) {
      // One COUNT query per event in parallel — bypasses PostgREST max_rows limit
      const eventCounts = await Promise.all(
        eventos.map(async (ev) => {
          const { count, error: countError } = await supabase
            .from("dash_gestao_captacao_leads")
            .select("*", { count: "exact", head: true })
            .gte("data_cadastro", `${start_date}T00:00:00`)
            .lte("data_cadastro", `${end_date}T23:59:59`)
            .eq("evento", ev);
          if (countError) throw new Error(countError.message);
          return { evento: ev, count: count ?? 0 };
        })
      );

      const by_event = eventCounts
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count);
      const total = eventCounts.reduce((sum, r) => sum + r.count, 0);

      return NextResponse.json({ total, by_event } as GlobalLeadsMetrics);
    }

    // No event filter: single total count
    const { count, error: countError } = await supabase
      .from("dash_gestao_captacao_leads")
      .select("*", { count: "exact", head: true })
      .gte("data_cadastro", `${start_date}T00:00:00`)
      .lte("data_cadastro", `${end_date}T23:59:59`);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    return NextResponse.json({ total: count ?? 0, by_event: [] } as GlobalLeadsMetrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
