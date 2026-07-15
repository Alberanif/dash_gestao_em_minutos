import type { GlobalHotmartMetrics, HotmartProductMetrics } from "@/types/indicadores";
import type { ExpandedFilter, Period } from "../filter-expansion";
import { brtToUtc } from "../timezone";
import type { SupabaseLike } from "./types";

const STATUS_APPROVED = ["COMPLETE", "APPROVED"];
const PAGE_SIZE = 1000;

export const ZEROED_HOTMART: GlobalHotmartMetrics = {
  products: [],
  total_sales: 0,
  total_sales_brl: 0,
  total_sales_foreign: 0,
  total_revenue: 0,
};

export interface HotmartQuery {
  period: Period;
  filter: ExpandedFilter;
}

type SaleRow = { product_id: string; product_name: string | null; price?: number | null };

/**
 * Receita e vendas Hotmart no escopo do filtro. Fonte não configurada (filtro
 * sem produtos Hotmart) é *ausência* — devolve zerado sem consultar, em vez de
 * devolver o total global, que era o que o agente lia antes.
 */
export async function fetchHotmartMetrics(
  { period, filter }: HotmartQuery,
  supabase: SupabaseLike
): Promise<GlobalHotmartMetrics> {
  if (!filter.sources.hotmart) return { ...ZEROED_HOTMART, products: [] };

  const startUtc = brtToUtc(period.startDate, false);
  const endUtc = brtToUtc(period.endDate, true);

  const scoped = (currency: { column: "eq" | "neq" }, columns: string) => {
    let query = supabase
      .from("dash_gestao_hotmart_sales")
      .select(columns)
      [currency.column]("currency", "BRL")
      .in("status", STATUS_APPROVED)
      .gte("purchase_date", startUtc)
      .lte("purchase_date", endUtc)
      .in("product_id", filter.productIds);
    if (filter.offerCode) query = query.eq("offer_code", filter.offerCode);
    return query;
  };

  const [brlRows, foreignRows] = await Promise.all([
    paginate<SaleRow>(() => scoped({ column: "eq" }, "product_id, product_name, price")),
    paginate<SaleRow>(() => scoped({ column: "neq" }, "product_id, product_name")),
  ]);

  return aggregate(brlRows, foreignRows);
}

/**
 * Caminho legado sem escopo de produto, preservado para que o route handler
 * continue respondendo idêntico quando chamado sem `product_ids[]`. Nenhuma
 * tool do agente usa este caminho — é aqui que moram os dados globais.
 */
export async function fetchHotmartMetricsUnscoped(
  { period, filter }: HotmartQuery,
  supabase: SupabaseLike
): Promise<GlobalHotmartMetrics> {
  const startUtc = brtToUtc(period.startDate, false);
  const endUtc = brtToUtc(period.endDate, true);

  const { data, error } = await supabase.rpc("get_hotmart_metrics", {
    p_start_date: startUtc,
    p_end_date: endUtc,
    ...(filter.offerCode ? { p_offer_code: filter.offerCode } : {}),
  });

  if (!error && data) {
    const d = data as Omit<GlobalHotmartMetrics, "total_sales">;
    return {
      ...d,
      total_sales: (d.total_sales_brl ?? 0) + (d.total_sales_foreign ?? 0),
    };
  }

  // Fallback: a RPC falhou — pagina manualmente.
  const scoped = (currency: { column: "eq" | "neq" }, columns: string) => {
    let query = supabase
      .from("dash_gestao_hotmart_sales")
      .select(columns)
      [currency.column]("currency", "BRL")
      .in("status", STATUS_APPROVED)
      .gte("purchase_date", startUtc)
      .lte("purchase_date", endUtc);
    if (filter.offerCode) query = query.eq("offer_code", filter.offerCode);
    return query;
  };

  const [brlRows, foreignRows] = await Promise.all([
    paginate<SaleRow>(() => scoped({ column: "eq" }, "product_id, product_name, price")),
    paginate<SaleRow>(() => scoped({ column: "neq" }, "product_id, product_name")),
  ]);

  return aggregate(brlRows, foreignRows);
}

interface RangeableQuery {
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

async function paginate<T>(buildQuery: () => RangeableQuery): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

function aggregate(brlRows: SaleRow[], foreignRows: SaleRow[]): GlobalHotmartMetrics {
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

  return {
    products,
    total_sales: total_sales_brl + total_sales_foreign,
    total_sales_brl,
    total_sales_foreign,
    total_revenue: brlRows.reduce((sum, row) => sum + (row.price ?? 0), 0),
  };
}
