import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { parseDateRange } from "@/lib/vendas/date-range";

// Handler comum das leituras de uma visualização (kpis, daily, hourly, offers):
// permissão (gestor e analista), 404 para visualização inexistente, validação de
// ?start&end (YYYY-MM-DD, ambos opcionais) e chamada da RPC dash_gestao_vendas_view_*.
// O fuso/regra de contagem vivem no SQL (migration 070); aqui só se repassa.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function validDay(value: string): boolean {
  return ISO_DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export async function handleViewRead(
  request: NextRequest,
  params: Promise<{ id: string }>,
  rpc: string,
  shape: (data: unknown) => unknown
): Promise<NextResponse> {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;
  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");

  for (const value of [start, end]) {
    if (value !== null && !validDay(value)) {
      return NextResponse.json(
        { error: "start/end devem estar no formato YYYY-MM-DD" },
        { status: 400 }
      );
    }
  }
  if (start !== null && end !== null && parseDateRange(start, end) === null) {
    return NextResponse.json({ error: "end deve ser >= start" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: view, error: viewError } = await supabase
    .from("dash_gestao_vendas_views")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (viewError) return NextResponse.json({ error: viewError.message }, { status: 500 });
  if (!view) return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });

  const { data, error: rpcError } = await supabase.rpc(rpc, {
    p_view_id: id,
    p_start: start,
    p_end: end,
  });

  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

  return NextResponse.json(shape(data));
}

// bigint chega como string pelo PostgREST: toda contagem passa por Number().
type Raw = Record<string, unknown>;

export function rowsOf(data: unknown): Raw[] {
  return Array.isArray(data) ? (data as Raw[]) : [];
}

export const num = (value: unknown): number => Number(value ?? 0);
