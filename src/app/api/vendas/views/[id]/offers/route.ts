import { NextRequest } from "next/server";
import { handleViewRead, rowsOf, num } from "@/lib/vendas/views-read";
import type { VendasViewOfferRow } from "@/types/vendas";

type Params = { id: string };

export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
  return handleViewRead(request, params, "dash_gestao_vendas_view_offers", (data) => ({ rows: rowsOf(data).map((r): VendasViewOfferRow => ({ offer_code: String(r.offer_code), offer_name: r.offer_name === null || r.offer_name === undefined ? null : String(r.offer_name), sales: num(r.sales), refunded: num(r.refunded) })) }));
}
