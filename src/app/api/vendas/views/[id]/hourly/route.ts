import { NextRequest } from "next/server";
import { handleViewRead, rowsOf, num } from "@/lib/vendas/views-read";
import type { VendasViewHourlyRow } from "@/types/vendas";

type Params = { id: string };

export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
  return handleViewRead(request, params, "dash_gestao_vendas_view_hourly", (data) => ({ rows: rowsOf(data).map((r): VendasViewHourlyRow => ({ hour: String(r.hour), sales: num(r.sales) })) }));
}
