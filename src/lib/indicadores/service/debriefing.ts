import { brtToUtc, utcToBrtDate } from "../timezone";
import type { SupabaseLike } from "./types";

const STATUS_APPROVED = ["COMPLETE", "APPROVED"];
const PAGE_SIZE = 1000;

export interface DebriefingMetrics {
  product_id: string;
  product_name: string | null;
  total_sales: number;
  total_sales_brl: number;
  total_sales_foreign: number;
  total_revenue_brl: number;
  available_offers: Array<{
    offer_code: string;
    offer_name: string;
    sales_count: number;
  }>;
  daily_series: Array<{
    date: string;
    sales_count: number;
    sales_brl: number;
    sales_foreign: number;
    revenue: number;
  }>;
  offers_breakdown: Array<{
    offer_code: string;
    offer_name: string;
    sales_count: number;
    revenue: number;
  }>;
}

export interface DebriefingQuery {
  startDate: string;
  endDate: string;
  productId: string;
  offerCodes?: string[];
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

export async function fetchDebriefingMetrics(
  { startDate, endDate, productId, offerCodes = [] }: DebriefingQuery,
  supabase: SupabaseLike
): Promise<DebriefingMetrics> {
  const startUtc = brtToUtc(startDate, false);
  const endUtc = brtToUtc(endDate, true);

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

  // 1. Calculate available offers (all offers for this product in period)
  const availableOffersMap = new Map<string, { offer_code: string; offer_name: string; sales_count: number }>();
  let productName: string | null = null;

  for (const sale of sales) {
    if (!productName && sale.product_name) {
      productName = sale.product_name;
    }
    const offerKey = sale.offer_code || "Sem Oferta";
    const offerName = sale.offer_name || sale.offer_code || "Sem Oferta";
    const existing = availableOffersMap.get(offerKey);
    if (existing) {
      existing.sales_count += 1;
    } else {
      availableOffersMap.set(offerKey, {
        offer_code: offerKey,
        offer_name: offerName,
        sales_count: 1,
      });
    }
  }

  const available_offers = Array.from(availableOffersMap.values()).sort((a, b) => b.sales_count - a.sales_count);

  // 2. Filter sales if offerCodes filter is provided
  const filterSet = offerCodes.length > 0 ? new Set(offerCodes) : null;
  const filteredSales = filterSet
    ? sales.filter((s) => filterSet.has(s.offer_code || "Sem Oferta"))
    : sales;

  let totalSalesBrl = 0;
  let totalSalesForeign = 0;
  let totalRevenueBrl = 0;

  const dailyMap = new Map<
    string,
    { sales_count: number; sales_brl: number; sales_foreign: number; revenue: number }
  >();
  const offersMap = new Map<string, { offer_code: string; offer_name: string; sales_count: number; revenue: number }>();

  // Build daily series date template between startDate and endDate
  const current = new Date(`${startDate}T00:00:00-03:00`);
  const end = new Date(`${endDate}T00:00:00-03:00`);
  while (current <= end) {
    const dStr = current.toISOString().slice(0, 10);
    dailyMap.set(dStr, { sales_count: 0, sales_brl: 0, sales_foreign: 0, revenue: 0 });
    current.setDate(current.getDate() + 1);
  }

  for (const sale of filteredSales) {
    const isBrl = sale.currency === "BRL" || !sale.currency;
    const price = sale.price ?? 0;

    if (isBrl) {
      totalSalesBrl += 1;
      totalRevenueBrl += price;
    } else {
      totalSalesForeign += 1;
    }

    const brtDate = utcToBrtDate(sale.purchase_date);
    const dayEntry = dailyMap.get(brtDate);
    if (dayEntry) {
      dayEntry.sales_count += 1;
      if (isBrl) {
        dayEntry.sales_brl += 1;
        dayEntry.revenue += price;
      } else {
        dayEntry.sales_foreign += 1;
      }
    }

    const offerKey = sale.offer_code || "Sem Oferta";
    const offerName = sale.offer_name || sale.offer_code || "Sem Oferta";
    const offerEntry = offersMap.get(offerKey);
    if (offerEntry) {
      offerEntry.sales_count += 1;
      if (isBrl) offerEntry.revenue += price;
    } else {
      offersMap.set(offerKey, {
        offer_code: offerKey,
        offer_name: offerName,
        sales_count: 1,
        revenue: isBrl ? price : 0,
      });
    }
  }

  const daily_series = Array.from(dailyMap.entries())
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const offers_breakdown = Array.from(offersMap.values()).sort((a, b) => b.sales_count - a.sales_count);

  return {
    product_id: productId,
    product_name: productName,
    total_sales: totalSalesBrl + totalSalesForeign,
    total_sales_brl: totalSalesBrl,
    total_sales_foreign: totalSalesForeign,
    total_revenue_brl: totalRevenueBrl,
    available_offers,
    daily_series,
    offers_breakdown,
  };
}
