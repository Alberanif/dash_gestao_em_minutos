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
  const eventosParam = eventos.length > 0 ? eventos : null;

  try {
    const [totalResult, byEventResult, sourceResult] = await Promise.all([
      supabase.rpc("dash_gestao_leads_unique_total", {
        p_start_date: start_date,
        p_end_date: end_date,
        p_eventos: eventosParam,
      }),
      eventos.length > 0
        ? supabase.rpc("dash_gestao_leads_by_event_unique", {
            p_start_date: start_date,
            p_end_date: end_date,
            p_eventos: eventosParam,
          })
        : Promise.resolve({ data: [] as Array<{ evento: string; count: number }>, error: null }),
      supabase.rpc("dash_gestao_leads_by_source", {
        p_start_date: start_date,
        p_end_date: end_date,
        p_eventos: eventosParam,
      }),
    ]);

    if (totalResult.error) throw new Error(totalResult.error.message);
    if (byEventResult.error) throw new Error(byEventResult.error.message);
    if (sourceResult.error) throw new Error(sourceResult.error.message);

    const total = Number(totalResult.data ?? 0);
    const by_event = ((byEventResult.data ?? []) as Array<{ evento: string; count: number }>)
      .filter((r) => r.count > 0)
      .map((r) => ({ evento: r.evento, count: Number(r.count) }));
    const by_source = ((sourceResult.data ?? []) as Array<{ source: string; count: number }>).map(
      (r) => ({ source: r.source, count: Number(r.count) })
    );

    return NextResponse.json({ total, by_event, by_source } as GlobalLeadsMetrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
