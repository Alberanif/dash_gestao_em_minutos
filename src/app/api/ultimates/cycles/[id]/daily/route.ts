import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UltimatesDailyRow } from "@/types/ultimates";

type Params = { id: string };

// Linha bruta como devolvida pela RPC via PostgREST — bigint pode chegar
// como string (mesmo cuidado do numeric, ver conventions.md). new_buyers é
// opcional porque a versão pré-051 da RPC não devolve a coluna.
type RawDailyRow = Omit<UltimatesDailyRow, "renewals" | "new_buyers"> & {
  renewals: number | string;
  new_buyers?: number | string | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("id")
    .eq("id", id)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  const { data, error: rpcError } = await supabase.rpc("dash_gestao_ultimates_daily", {
    p_cycle_id: id,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const days: UltimatesDailyRow[] = ((data as RawDailyRow[]) ?? []).map((row) => ({
    ...row,
    renewals: Number(row.renewals),
    // ?? 0 é ponte para o ambiente onde a migration 051 ainda não foi
    // aplicada: sem ela a RPC não devolve new_buyers e Number(undefined)
    // viraria NaN, quebrando o eixo Y das DUAS séries do gráfico. Assim a
    // série de novos compradores só fica vazia. Remover quando 051 estiver
    // aplicada em produção.
    new_buyers: Number(row.new_buyers ?? 0),
  }));

  return NextResponse.json({ days });
}
