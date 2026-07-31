import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { parseDateRange } from "@/lib/ultimates/date-range";
import type { UltimatesRosterRow } from "@/types/ultimates";

type Params = { id: string };

// Linha bruta como devolvida pela RPC via PostgREST — numeric pode chegar
// como string (ver conventions.md seção "cuidado com numeric").
type RawRosterRow = Omit<UltimatesRosterRow, "total_value"> & {
  total_value: number | string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;

  // Recorte opcional por intervalo (spec 2026-07-31). Ausência das DUAS pontas
  // = ciclo inteiro, o contrato de sempre. Meia ponta é erro, não "assume o
  // resto": adivinhar o outro extremo devolveria um número que ninguém pediu.
  const startParam = request.nextUrl.searchParams.get("start");
  const endParam = request.nextUrl.searchParams.get("end");
  const pediuIntervalo = startParam !== null || endParam !== null;
  const range = pediuIntervalo ? parseDateRange(startParam ?? "", endParam ?? "") : null;

  if (pediuIntervalo && range === null) {
    return NextResponse.json({ error: "Intervalo inválido" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("id")
    .eq("id", id)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  const { data, error: rpcError } = await supabase.rpc("dash_gestao_ultimates_roster", {
    p_cycle_id: id,
    // Só manda as chaves quando há intervalo: assim a chamada sem filtro
    // continua batendo na assinatura de um argumento e segue funcionando com a
    // migration 058 ainda não aplicada.
    ...(range ? { p_start: range.start, p_end: range.end } : {}),
  });

  if (rpcError) {
    // PGRST202 = "função não existe com essa assinatura". Com intervalo pedido,
    // isso significa migration 058 pendente — situação esperada neste ambiente,
    // cuja fila de migrations anda dias atrás do código. 501 ("não
    // implementado") deixa o cliente distinguir "ainda não subiu" de falha real
    // e degradar só o recorte, sem derrubar o dashboard. Sem intervalo não há
    // recorte a degradar, então ali o mesmo código continua sendo 500.
    if (range && rpcError.code === "PGRST202") {
      return NextResponse.json(
        { error: "Recorte por data indisponível" },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const rows: UltimatesRosterRow[] = ((data as RawRosterRow[]) ?? []).map((row) => ({
    ...row,
    total_value: row.total_value === null || row.total_value === undefined
      ? null
      : Number(row.total_value),
  }));

  return NextResponse.json({ rows });
}
