import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UltimatesOfferOption } from "@/types/ultimates";

/**
 * Dash Ultimates — ofertas do produto do ciclo, com o número de vendas de cada
 * uma (PRD docs/PRD_2026-07-30_ultimates_excluir_ofertas.md, seção 6.3).
 *
 * Alimenta o seletor do modal "Ofertas excluídas". Existe como RPC porque o
 * client Supabase não agrega (precisamos de count por offer_code) e porque
 * dash_gestao_hotmart_sales não tem policy de select para authenticated —
 * a leitura tem que passar pelo service client, como no roster e no daily.
 */

type Params = { id: string };

// bigint chega como string pelo PostgREST (ver conventions.md, "cuidado com
// numeric") e a UI ordena/compara esse valor.
type RawOfferOption = Omit<UltimatesOfferOption, "sales_count"> & {
  sales_count: number | string | null;
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

  const { data, error: rpcError } = await supabase.rpc(
    "dash_gestao_ultimates_offer_options",
    { p_cycle_id: id }
  );

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const offers: UltimatesOfferOption[] = ((data as RawOfferOption[]) ?? []).map((row) => ({
    offer_code: row.offer_code,
    offer_name: row.offer_name,
    sales_count: Number(row.sales_count ?? 0),
    is_excluded: row.is_excluded,
  }));

  return NextResponse.json({ offers });
}
