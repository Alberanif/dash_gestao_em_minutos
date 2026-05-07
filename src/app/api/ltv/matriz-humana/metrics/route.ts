import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { LtvMetrics } from "@/types/ltv";

const PRODUCT_ID = "7235833";
const STATUS_APPROVED = ["COMPLETE", "APPROVED"];
const STATUS_CANCELLED = ["REFUNDED", "CANCELLED", "CHARGEBACK"];

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

async function countSales(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  statuses: string[],
  start: string,
  end: string
): Promise<number> {
  const { count, error } = await supabase
    .from("dash_gestao_hotmart_sales")
    .select("id", { count: "exact", head: true })
    .eq("product_id", PRODUCT_ID)
    .in("status", statuses)
    .gte("purchase_date", start)
    .lte("purchase_date", end + "T23:59:59");
  if (error) throw new Error(error.message);
  return count ?? 0;
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
    const [ativas, canceladas, canceladasPrev, novas, novasPrev] = await Promise.all([
      countSales(supabase, STATUS_APPROVED, start, end),
      countSales(supabase, STATUS_CANCELLED, start, end),
      countSales(supabase, STATUS_CANCELLED, prevStart, prevEnd),
      countSales(supabase, STATUS_APPROVED, start, end),
      countSales(supabase, STATUS_APPROVED, prevStart, prevEnd),
    ]);

    const metrics: LtvMetrics = {
      assinaturas_ativas: ativas,
      assinaturas_canceladas: canceladas,
      assinaturas_canceladas_delta: canceladas - canceladasPrev,
      novas_assinaturas: novas,
      novas_assinaturas_delta: novas - novasPrev,
    };

    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
