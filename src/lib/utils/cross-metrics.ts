export interface ROASInput {
  metaSpend: number | null;
  hotmartTotalRevenue: number | null;
}

export interface CPAInput {
  metaSpend: number | null;
  hotmartTotalSales: number | null;
}

export interface ConversionRateInput {
  metaLeads: number | null;
  hotmartTotalSales: number | null;
}

/**
 * ROAS = hotmart_total_revenue / meta_spend
 * Returns null when either operand is 0 or null.
 */
export function calcROAS({ metaSpend, hotmartTotalRevenue }: ROASInput): number | null {
  if (!metaSpend || !hotmartTotalRevenue) return null;
  return hotmartTotalRevenue / metaSpend;
}

/**
 * CPA = meta_spend / hotmart_total_sales
 * Returns null when meta_spend is 0/null or hotmart_total_sales is 0/null.
 */
export function calcCPA({ metaSpend, hotmartTotalSales }: CPAInput): number | null {
  if (!metaSpend || !hotmartTotalSales) return null;
  return metaSpend / hotmartTotalSales;
}

/**
 * Taxa de Conversão Ads→Vendas = hotmart_total_sales / meta_leads * 100
 * Returns null when meta_leads is 0 or null, or hotmart_total_sales is null.
 * Returns 0 when hotmart_total_sales is 0 and meta_leads > 0.
 */
export function calcConversionRate({ metaLeads, hotmartTotalSales }: ConversionRateInput): number | null {
  if (!metaLeads) return null;
  if (hotmartTotalSales === null || hotmartTotalSales === undefined) return null;
  return (hotmartTotalSales / metaLeads) * 100;
}
