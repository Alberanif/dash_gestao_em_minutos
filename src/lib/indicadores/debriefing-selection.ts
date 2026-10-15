import type {
  DebriefingDailyPoint,
  DebriefingMetrics,
  DebriefingTotals,
} from "./service/debriefing";

/**
 * Recorta as métricas do Debriefing para os produtos selecionados.
 * Seleção vazia = "Todos": devolve as métricas como vieram.
 */
export function selectDebriefingProducts(
  metrics: DebriefingMetrics,
  selectedIds: string[]
): DebriefingMetrics {
  if (selectedIds.length === 0) return metrics;

  const wanted = new Set(selectedIds);
  const products = metrics.products.filter((p) => wanted.has(p.product_id));

  const totals: DebriefingTotals = {
    total_sales: 0,
    total_sales_brl: 0,
    total_sales_foreign: 0,
    total_revenue_brl: 0,
  };
  const byDate = new Map<string, DebriefingDailyPoint>();

  for (const p of products) {
    totals.total_sales += p.total_sales;
    totals.total_sales_brl += p.total_sales_brl;
    totals.total_sales_foreign += p.total_sales_foreign;
    totals.total_revenue_brl += p.total_revenue_brl;

    for (const d of p.daily_series) {
      const acc = byDate.get(d.date);
      if (acc) {
        acc.sales_count += d.sales_count;
        acc.sales_brl += d.sales_brl;
        acc.sales_foreign += d.sales_foreign;
        acc.revenue += d.revenue;
      } else {
        byDate.set(d.date, { ...d });
      }
    }
  }

  const daily_series = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { totals, daily_series, products };
}

/**
 * Liga/desliga um produto. Vazio = "Todos". Desmarcar o último ou marcar
 * todos volta para vazio.
 */
export function toggleProductSelection(
  selected: string[],
  productId: string,
  allIds: string[]
): string[] {
  const next = selected.includes(productId)
    ? selected.filter((id) => id !== productId)
    : [...selected, productId];
  return next.length >= allIds.length ? [] : next;
}
