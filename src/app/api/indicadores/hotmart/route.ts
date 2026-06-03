import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { GlobalHotmartMetrics, HotmartProductMetrics } from "@/types/indicadores";

const STATUS_APPROVED = ["COMPLETE", "APPROVED"];

function brtToUtc(dateStr: string, endOfDay = false): string {
  const time = endOfDay ? "T23:59:59" : "T00:00:00";
  return new Date(`${dateStr}${time}-03:00`).toISOString();
}

async function fetchAllPages<T>(
  query: () => ReturnType<ReturnType<ReturnType<typeof createSupabaseServiceClient>["from"]>["select"]>,
  buildQuery: (from: number) => any
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const startUtc = brtToUtc(start_date, false);
  const endUtc = brtToUtc(end_date, true);

  const supabase = createSupabaseServiceClient();

  // Tenta via RPC (mais eficiente — sem limite de linhas)
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_hotmart_metrics", {
    p_start_date: startUtc,
    p_end_date: endUtc,
  });

  if (!rpcError && rpcData) {
    const d = rpcData as Omit<GlobalHotmartMetrics, "total_sales">;
    return NextResponse.json({
      ...d,
      total_sales: (d.total_sales_brl ?? 0) + (d.total_sales_foreign ?? 0),
    } as GlobalHotmartMetrics);
  }

  // Fallback: paginação manual (enquanto a migration 035 não for aplicada)
  const baseFilters = (q: any) =>
    q
      .in("status", STATUS_APPROVED)
      .gte("purchase_date", startUtc)
      .lte("purchase_date", endUtc);

  const [brlRows, foreignRows] = await Promise.all([
    (async () => {
      const all: { product_id: string; product_name: string; price: number }[] = [];
      let from = 0;
      while (true) {
        const { data, error: e } = await baseFilters(
          supabase
            .from("dash_gestao_hotmart_sales")
            .select("product_id, product_name, price")
            .eq("currency", "BRL")
        ).range(from, from + 999);
        if (e) throw new Error(e.message);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
      return all;
    })(),
    (async () => {
      const all: { product_id: string; product_name: string }[] = [];
      let from = 0;
      while (true) {
        const { data, error: e } = await baseFilters(
          supabase
            .from("dash_gestao_hotmart_sales")
            .select("product_id, product_name")
            .neq("currency", "BRL")
        ).range(from, from + 999);
        if (e) throw new Error(e.message);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
      return all;
    })(),
  ]);

  const productMap = new Map<string, HotmartProductMetrics>();

  for (const row of brlRows) {
    const existing = productMap.get(row.product_id);
    if (existing) {
      existing.sales_count += 1;
      existing.revenue += row.price ?? 0;
    } else {
      productMap.set(row.product_id, {
        product_id: row.product_id,
        product_name: row.product_name ?? row.product_id,
        sales_count: 1,
        revenue: row.price ?? 0,
        is_foreign_currency: false,
      });
    }
  }

  for (const row of foreignRows) {
    const existing = productMap.get(row.product_id);
    if (existing) {
      existing.sales_count += 1;
    } else {
      productMap.set(row.product_id, {
        product_id: row.product_id,
        product_name: row.product_name ?? row.product_id,
        sales_count: 1,
        revenue: 0,
        is_foreign_currency: true,
      });
    }
  }

  const products = Array.from(productMap.values()).sort((a, b) => b.sales_count - a.sales_count);
  const total_sales_brl = brlRows.length;
  const total_sales_foreign = foreignRows.length;
  const total_revenue = brlRows.reduce((s, r) => s + (r.price ?? 0), 0);

  return NextResponse.json({
    products,
    total_sales: total_sales_brl + total_sales_foreign,
    total_sales_brl,
    total_sales_foreign,
    total_revenue,
  } satisfies GlobalHotmartMetrics);
}
