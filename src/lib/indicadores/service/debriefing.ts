import { brtToUtc, utcToBrtDate } from "../timezone";
import type { SupabaseLike } from "./types";

const STATUS_APPROVED = ["COMPLETE", "APPROVED"];
const PAGE_SIZE = 1000;

export interface DebriefingTotals {
  total_sales: number;
  total_sales_brl: number;
  total_sales_foreign: number;
  total_revenue_brl: number;
}

export interface DebriefingDailyPoint {
  date: string;
  sales_count: number;
  sales_brl: number;
  sales_foreign: number;
  revenue: number;
}

export interface DebriefingOfferBreakdown {
  offer_code: string;
  offer_name: string;
  sales_count: number;
  revenue: number;
}

export interface DebriefingProductMetrics extends DebriefingTotals {
  product_id: string;
  product_name: string;
  offers_breakdown: DebriefingOfferBreakdown[];
  /** Série diária só deste produto (mesmos dias da consolidada). */
  daily_series: DebriefingDailyPoint[];
}

export interface DebriefingMetrics {
  totals: DebriefingTotals;
  /** Consolidada: soma dos produtos. */
  daily_series: DebriefingDailyPoint[];
  /** Na ordem recebida. */
  products: DebriefingProductMetrics[];
}

export interface DebriefingQueryProduct {
  product_id: string;
  /** Nome de reserva para produto sem vendas no período. */
  product_name?: string;
  /** Vazio/ausente = todas as ofertas. "Sem Oferta" marca vendas sem offer_code. */
  offer_codes?: string[];
}

export interface DebriefingQuery {
  startDate: string;
  endDate: string;
  products: DebriefingQueryProduct[];
}

type HotmartSaleRow = {
  product_id: string;
  product_name: string | null;
  price: number | null;
  currency: string | null;
  purchase_date: string;
  offer_code: string | null;
  offer_name: string | null;
};

async function fetchProductSales(
  productId: string,
  startUtc: string,
  endUtc: string,
  supabase: SupabaseLike
): Promise<HotmartSaleRow[]> {
  const buildQuery = () =>
    supabase
      .from("dash_gestao_hotmart_sales")
      .select("product_id, product_name, price, currency, purchase_date, offer_code, offer_name")
      .in("status", STATUS_APPROVED)
      .gte("purchase_date", startUtc)
      .lte("purchase_date", endUtc)
      .eq("product_id", productId);

  const sales: HotmartSaleRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    sales.push(...(data as HotmartSaleRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return sales;
}

export async function fetchDebriefingMetrics(
  { startDate, endDate, products }: DebriefingQuery,
  supabase: SupabaseLike
): Promise<DebriefingMetrics> {
  const startUtc = brtToUtc(startDate, false);
  const endUtc = brtToUtc(endDate, true);

  const salesByProduct = await Promise.all(
    products.map((p) => fetchProductSales(p.product_id, startUtc, endUtc, supabase))
  );

  const totals: DebriefingTotals = {
    total_sales: 0,
    total_sales_brl: 0,
    total_sales_foreign: 0,
    total_revenue_brl: 0,
  };

  type DailyMap = Map<string, Omit<DebriefingDailyPoint, "date">>;
  const newDailyMap = (): DailyMap => {
    const map: DailyMap = new Map();
    const current = new Date(`${startDate}T00:00:00-03:00`);
    const end = new Date(`${endDate}T00:00:00-03:00`);
    while (current <= end) {
      map.set(current.toISOString().slice(0, 10), {
        sales_count: 0,
        sales_brl: 0,
        sales_foreign: 0,
        revenue: 0,
      });
      current.setDate(current.getDate() + 1);
    }
    return map;
  };
  const toSeries = (map: DailyMap): DebriefingDailyPoint[] =>
    Array.from(map.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));

  const dailyMap = newDailyMap();

  const productResults: DebriefingProductMetrics[] = products.map((product, idx) => {
    const sales = salesByProduct[idx];
    // Regra por produto: sem oferta marcada conta tudo; com ofertas, só as marcadas.
    const codes = product.offer_codes ?? [];
    const filterSet = codes.length > 0 ? new Set(codes) : null;
    const filteredSales = filterSet
      ? sales.filter((s) => filterSet.has(s.offer_code || "Sem Oferta"))
      : sales;

    const productName =
      sales.find((s) => s.product_name)?.product_name || product.product_name || product.product_id;

    const result: DebriefingProductMetrics = {
      product_id: product.product_id,
      product_name: productName,
      total_sales: 0,
      total_sales_brl: 0,
      total_sales_foreign: 0,
      total_revenue_brl: 0,
      offers_breakdown: [],
      daily_series: [],
    };
    const productDailyMap = newDailyMap();
    const offersMap = new Map<string, DebriefingOfferBreakdown>();

    for (const sale of filteredSales) {
      const isBrl = sale.currency === "BRL" || !sale.currency;
      const price = sale.price ?? 0;

      if (isBrl) {
        result.total_sales_brl += 1;
        result.total_revenue_brl += price;
      } else {
        result.total_sales_foreign += 1;
      }

      const day = utcToBrtDate(sale.purchase_date);
      for (const dayEntry of [dailyMap.get(day), productDailyMap.get(day)]) {
        if (!dayEntry) continue;
        dayEntry.sales_count += 1;
        if (isBrl) {
          dayEntry.sales_brl += 1;
          dayEntry.revenue += price;
        } else {
          dayEntry.sales_foreign += 1;
        }
      }

      const offerKey = sale.offer_code || "Sem Oferta";
      const offerEntry = offersMap.get(offerKey);
      if (offerEntry) {
        offerEntry.sales_count += 1;
        if (isBrl) offerEntry.revenue += price;
      } else {
        offersMap.set(offerKey, {
          offer_code: offerKey,
          offer_name: sale.offer_name || sale.offer_code || "Sem Oferta",
          sales_count: 1,
          revenue: isBrl ? price : 0,
        });
      }
    }

    result.total_sales = result.total_sales_brl + result.total_sales_foreign;
    result.offers_breakdown = Array.from(offersMap.values()).sort((a, b) => b.sales_count - a.sales_count);
    result.daily_series = toSeries(productDailyMap);

    totals.total_sales += result.total_sales;
    totals.total_sales_brl += result.total_sales_brl;
    totals.total_sales_foreign += result.total_sales_foreign;
    totals.total_revenue_brl += result.total_revenue_brl;
    return result;
  });

  return { totals, daily_series: toSeries(dailyMap), products: productResults };
}
