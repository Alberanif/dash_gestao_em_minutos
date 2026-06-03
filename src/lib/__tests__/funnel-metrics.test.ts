import { calcFunnelStages, calcConversionRates } from "../utils/funnel-metrics";
import type { GlobalMetrics, GlobalHotmartMetrics } from "@/types/indicadores";

const baseMetrics: GlobalMetrics = {
  meta_spend: 1000,
  meta_cpm: 10,
  meta_ctr: 2,
  meta_leads: 50,
  meta_checkout: 30,
  meta_impressions: 100_000,
  meta_link_clicks: 2000,
  meta_page_views: 1500,
  meta_connect_rate: 75,
  meta_lp_conversion: 3.33,
  meta_cpl_traffic: 20,
};

const baseHotmart: GlobalHotmartMetrics = {
  products: [],
  total_sales: 10,
  total_sales_brl: 10,
  total_sales_foreign: 0,
  total_revenue: 5000,
};

describe("calcFunnelStages()", () => {
  it("returns null when metrics is null", () => {
    expect(calcFunnelStages(null, baseHotmart)).toBeNull();
  });

  it("returns null when hotmartMetrics is null", () => {
    expect(calcFunnelStages(baseMetrics, null)).toBeNull();
  });

  it("returns null when meta_impressions is null", () => {
    const metrics = { ...baseMetrics, meta_impressions: null as unknown as number };
    expect(calcFunnelStages(metrics, baseHotmart)).toBeNull();
  });

  it("returns 5 stages with correct labels", () => {
    const stages = calcFunnelStages(baseMetrics, baseHotmart);
    expect(stages).not.toBeNull();
    expect(stages!.map((s) => s.label)).toEqual([
      "Impressões",
      "Cliques no link",
      "Visualizações de LP",
      "Leads captados",
      "Vendas aprovadas",
    ]);
  });

  it("maps each stage to the correct source field", () => {
    const stages = calcFunnelStages(baseMetrics, baseHotmart)!;
    expect(stages[0].value).toBe(100_000); // impressions
    expect(stages[1].value).toBe(2000);    // link_clicks
    expect(stages[2].value).toBe(1500);    // page_views
    expect(stages[3].value).toBe(50);      // leads
    expect(stages[4].value).toBe(10);      // hotmart total_sales
  });
});

describe("calcConversionRates()", () => {
  it("returns 4 rates for a 5-stage funnel", () => {
    const stages = calcFunnelStages(baseMetrics, baseHotmart)!;
    const rates = calcConversionRates(stages);
    expect(rates).toHaveLength(4);
  });

  it("calculates CTR as link_clicks / impressions × 100", () => {
    const stages = calcFunnelStages(baseMetrics, baseHotmart)!;
    const rates = calcConversionRates(stages);
    // 2000 / 100000 * 100 = 2
    expect(rates[0].label).toBe("CTR");
    expect(rates[0].pct).toBeCloseTo(2, 5);
  });

  it("returns null pct when the denominator stage is 0", () => {
    const metricsZeroClicks: GlobalMetrics = { ...baseMetrics, meta_link_clicks: 0 };
    const stages = calcFunnelStages(metricsZeroClicks, baseHotmart)!;
    const rates = calcConversionRates(stages);
    // CTR denominator is impressions (100000) — still fine
    // Taxa LP: page_views / link_clicks; link_clicks = 0 → null
    expect(rates[1].pct).toBeNull();
  });

  it("returns null pct when impressions is 0", () => {
    const zeroImpressions: GlobalMetrics = {
      ...baseMetrics,
      meta_impressions: 0,
      meta_link_clicks: 0,
    };
    const stages = calcFunnelStages(zeroImpressions, baseHotmart)!;
    const rates = calcConversionRates(stages);
    expect(rates[0].pct).toBeNull();
  });
});
