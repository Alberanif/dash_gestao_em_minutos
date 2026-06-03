import { calcROAS, calcCPA, calcConversionRate } from "../utils/cross-metrics";

describe("calcROAS()", () => {
  it("returns null when metaSpend is 0", () => {
    expect(calcROAS({ metaSpend: 0, hotmartTotalRevenue: 5000 })).toBeNull();
  });

  it("returns null when metaSpend is null", () => {
    expect(calcROAS({ metaSpend: null, hotmartTotalRevenue: 5000 })).toBeNull();
  });

  it("returns null when hotmartTotalRevenue is 0", () => {
    expect(calcROAS({ metaSpend: 1000, hotmartTotalRevenue: 0 })).toBeNull();
  });

  it("returns null when hotmartTotalRevenue is null", () => {
    expect(calcROAS({ metaSpend: 1000, hotmartTotalRevenue: null })).toBeNull();
  });

  it("calculates ROAS as revenue / spend", () => {
    expect(calcROAS({ metaSpend: 1000, hotmartTotalRevenue: 5000 })).toBeCloseTo(5, 5);
  });

  it("returns a fractional ROAS when revenue < spend", () => {
    expect(calcROAS({ metaSpend: 2000, hotmartTotalRevenue: 500 })).toBeCloseTo(0.25, 5);
  });
});

describe("calcCPA()", () => {
  it("returns null when metaSpend is 0", () => {
    expect(calcCPA({ metaSpend: 0, hotmartTotalSales: 10 })).toBeNull();
  });

  it("returns null when metaSpend is null", () => {
    expect(calcCPA({ metaSpend: null, hotmartTotalSales: 10 })).toBeNull();
  });

  it("returns null when hotmartTotalSales is 0", () => {
    expect(calcCPA({ metaSpend: 1000, hotmartTotalSales: 0 })).toBeNull();
  });

  it("returns null when hotmartTotalSales is null", () => {
    expect(calcCPA({ metaSpend: 1000, hotmartTotalSales: null })).toBeNull();
  });

  it("calculates CPA as spend / sales", () => {
    expect(calcCPA({ metaSpend: 1000, hotmartTotalSales: 10 })).toBeCloseTo(100, 5);
  });
});

describe("calcConversionRate()", () => {
  it("returns null when metaLeads is 0", () => {
    expect(calcConversionRate({ metaLeads: 0, hotmartTotalSales: 10 })).toBeNull();
  });

  it("returns null when metaLeads is null", () => {
    expect(calcConversionRate({ metaLeads: null, hotmartTotalSales: 10 })).toBeNull();
  });

  it("returns null when hotmartTotalSales is null", () => {
    expect(calcConversionRate({ metaLeads: 50, hotmartTotalSales: null })).toBeNull();
  });

  it("returns 0 when hotmartTotalSales is 0 and metaLeads > 0", () => {
    expect(calcConversionRate({ metaLeads: 50, hotmartTotalSales: 0 })).toBe(0);
  });

  it("calculates conversion rate as (sales / leads) × 100", () => {
    // 10 sales from 50 leads = 20%
    expect(calcConversionRate({ metaLeads: 50, hotmartTotalSales: 10 })).toBeCloseTo(20, 5);
  });
});
