import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UltimatesRosterRow } from "@/types/ultimates";

type Params = { id: string };

// Linha bruta como devolvida pela RPC via PostgREST — numeric pode chegar
// como string (ver conventions.md seção "cuidado com numeric").
type RawRosterRow = Omit<UltimatesRosterRow, "total_value"> & {
  total_value: number | string | null;
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

  const { data, error: rpcError } = await supabase.rpc("dash_gestao_ultimates_roster", {
    p_cycle_id: id,
  });

  if (rpcError) {
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
