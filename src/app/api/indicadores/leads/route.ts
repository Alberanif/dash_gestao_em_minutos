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
    const eventosParam = eventos.length > 0 ? eventos : null;

    const [eventCountsOrTotal, sourceResult] = await Promise.all([
      eventos.length > 0
        ? Promise.all(
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
          )
        : supabase
            .from("dash_gestao_captacao_leads")
            .select("*", { count: "exact", head: true })
            .gte("data_cadastro", `${start_date}T00:00:00`)
            .lte("data_cadastro", `${end_date}T23:59:59`),
      supabase.rpc("dash_gestao_leads_by_source", {
        p_start_date: start_date,
        p_end_date: end_date,
        p_eventos: eventosParam,
      }),
    ]);

    const { data: sourceData, error: sourceError } = sourceResult as {
      data: Array<{ source: string; count: number }> | null;
      error: { message: string } | null;
    };
    if (sourceError) throw new Error(sourceError.message);
    const by_source = (sourceData ?? []).map((r) => ({
      source: r.source,
      count: Number(r.count),
    }));

    if (eventos.length > 0) {
      const eventCounts = eventCountsOrTotal as Array<{ evento: string; count: number }>;
      const by_event = eventCounts
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count);
      const total = eventCounts.reduce((sum, r) => sum + r.count, 0);
      return NextResponse.json({ total, by_event, by_source } as GlobalLeadsMetrics);
    }

    const { count, error: countError } = eventCountsOrTotal as {
      count: number | null;
      error: { message: string } | null;
    };
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    return NextResponse.json({ total: count ?? 0, by_event: [], by_source } as GlobalLeadsMetrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
