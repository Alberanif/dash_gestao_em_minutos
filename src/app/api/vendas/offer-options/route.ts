import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Ofertas disponíveis de UM produto, com o número de vendas de cada uma
 * (PRD #185). GET ?product_id=X devolve
 * { offers: [{ offer_code, offer_name, sales_count }] }.
 *
 * Continua sendo RPC porque o client Supabase não agrega (precisamos de count
 * por offer_code) e porque dash_gestao_hotmart_sales não tem policy de select
 * para authenticated — a leitura tem que passar pelo service client.
 */

interface RawOfferOption {
  offer_code: string;
  offer_name: string;
  // bigint chega como string pelo PostgREST.
  sales_count: number | string | null;
}

export async function GET(request: NextRequest) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const productId = request.nextUrl.searchParams.get("product_id")?.trim();
  if (!productId) {
    return NextResponse.json({ error: "product_id é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: rpcError } = await supabase.rpc("dash_gestao_vendas_offer_options", {
    p_product_ids: [productId],
  });
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const offers = ((data as RawOfferOption[]) ?? []).map((row) => ({
    offer_code: row.offer_code,
    offer_name: row.offer_name,
    sales_count: Number(row.sales_count ?? 0),
  }));
  return NextResponse.json({ offers });
}
