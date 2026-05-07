import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { LtvMetrics } from "@/types/ltv";

function getPreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return {
    prevStart: prevStart.toISOString().slice(0, 10),
    prevEnd: prevEnd.toISOString().slice(0, 10),
  };
}

async function aggregateForPeriod(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  start: string,
  end: string
) {
  const { data, error } = await supabase
    .from("dash_gestao_ltv_solides")
    .select("assinaturas_ativas, assinaturas_canceladas, novas_assinaturas")
    .lte("period_start", end)
    .gte("period_end", start);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  return data.reduce(
    (acc, row) => ({
      assinaturas_ativas: acc.assinaturas_ativas + (row.assinaturas_ativas ?? 0),
      assinaturas_canceladas: acc.assinaturas_canceladas + (row.assinaturas_canceladas ?? 0),
      novas_assinaturas: acc.novas_assinaturas + (row.novas_assinaturas ?? 0),
    }),
    { assinaturas_ativas: 0, assinaturas_canceladas: 0, novas_assinaturas: 0 }
  );
}

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Parâmetros start e end são obrigatórios" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { prevStart, prevEnd } = getPreviousPeriod(start, end);

  try {
    const [current, previous] = await Promise.all([
      aggregateForPeriod(supabase, start, end),
      aggregateForPeriod(supabase, prevStart, prevEnd),
    ]);

    if (!current) {
      return NextResponse.json(null);
    }

    const metrics: LtvMetrics = {
      assinaturas_ativas: current.assinaturas_ativas,
      assinaturas_canceladas: current.assinaturas_canceladas,
      assinaturas_canceladas_delta: current.assinaturas_canceladas - (previous?.assinaturas_canceladas ?? 0),
      novas_assinaturas: current.novas_assinaturas,
      novas_assinaturas_delta: current.novas_assinaturas - (previous?.novas_assinaturas ?? 0),
    };

    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
