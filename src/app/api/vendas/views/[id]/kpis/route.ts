import { NextRequest } from "next/server";
import { handleViewRead, rowsOf, num } from "@/lib/vendas/views-read";
import type { VendasViewKpis } from "@/types/vendas";

type Params = { id: string };

export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
  return handleViewRead(request, params, "dash_gestao_vendas_view_kpis", (data) => {
    // A RPC devolve sempre 1 linha; sem ela, zeros.
    const row = rowsOf(data)[0] ?? {};
    const kpis: VendasViewKpis = { sales: num(row.sales), refunded: num(row.refunded) };
    return kpis;
  });
}
