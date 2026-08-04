import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UltimatesOfferOption, UltimatesOfferlessOption } from "@/types/ultimates";

/**
 * Dash Ultimates — ofertas disponíveis dos produtos, com o número de vendas de
 * cada uma (PRD docs/PRD_2026-08-04_ultimates_ofertas_do_ciclo.md, seção 6).
 *
 * Escopada por PRODUTO e não por ciclo — foi por isso que ela saiu de
 * /cycles/[id]/offer-options: a sanfona do CycleFormModal precisa da lista na
 * CRIAÇÃO, quando ainda não existe cycle_id pelo qual escopar. Quem cruza
 * "oferta existente" com "oferta escolhida" é o cliente, com as listas de
 * UltimatesCycleProductRef.
 *
 * Continua sendo RPC porque o client Supabase não agrega (precisamos de count
 * por offer_code) e porque dash_gestao_hotmart_sales não tem policy de select
 * para authenticated — a leitura tem que passar pelo service client.
 */

// bigint chega como string pelo PostgREST (ver conventions.md, "cuidado com
// numeric") e a UI ordena/compara esse valor.
type RawOfferOption = Omit<UltimatesOfferOption, "sales_count"> & {
  sales_count: number | string | null;
};

type RawOfferlessOption = Omit<UltimatesOfferlessOption, "sales_count"> & {
  sales_count: number | string | null;
};

export async function GET(request: NextRequest) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  // productIds=a,b,c — lista na query string, e não no corpo, porque isto é
  // leitura pura e o modal a refaz a cada produto marcado.
  const productIds = Array.from(
    new Set(
      (request.nextUrl.searchParams.get("productIds") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );

  if (productIds.length === 0) {
    return NextResponse.json({ error: "productIds é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // As duas RPCs são independentes (uma agrega por oferta, a outra conta as
  // vendas SEM oferta) e alimentam a mesma sanfona: em série o modal esperaria
  // dois round-trips para pintar uma lista só.
  const [offersResult, offerlessResult] = await Promise.all([
    supabase.rpc("dash_gestao_ultimates_offer_options", { p_product_ids: productIds }),
    supabase.rpc("dash_gestao_ultimates_offerless_counts", { p_product_ids: productIds }),
  ]);

  if (offersResult.error) {
    return NextResponse.json({ error: offersResult.error.message }, { status: 500 });
  }

  if (offerlessResult.error) {
    return NextResponse.json({ error: offerlessResult.error.message }, { status: 500 });
  }

  const offers: UltimatesOfferOption[] = ((offersResult.data as RawOfferOption[]) ?? []).map(
    (row) => ({
      offer_code: row.offer_code,
      offer_name: row.offer_name,
      product_id: row.product_id,
      product_name: row.product_name,
      sales_count: Number(row.sales_count ?? 0),
    })
  );

  const offerless: UltimatesOfferlessOption[] = (
    (offerlessResult.data as RawOfferlessOption[]) ?? []
  ).map((row) => ({
    product_id: row.product_id,
    sales_count: Number(row.sales_count ?? 0),
  }));

  return NextResponse.json({ offers, offerless });
}
