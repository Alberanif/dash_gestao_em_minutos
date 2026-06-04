import { calcROAS, calcCPA, calcConversionRate } from "../utils/cross-metrics";

// ── Guard-layer helpers (mirrors the inline guard logic used in page.tsx) ────
// These helpers simulate the source-flag guard:
//   hasMetaFilter ? (value ?? null) : null
// They verify the expected contract before the guard is applied in page.tsx.

function guardedROAS(
  hasMetaFilter: boolean,
  hasHotmartFilter: boolean,
  metaSpend: number | null,
  hotmartRevenue: number | null,
): ReturnType<typeof calcROAS> {
  return calcROAS({
    metaSpend: hasMetaFilter ? metaSpend : null,
    hotmartTotalRevenue: hasHotmartFilter ? hotmartRevenue : null,
  });
}

function guardedCPA(
  hasMetaFilter: boolean,
  hasHotmartFilter: boolean,
  metaSpend: number | null,
  hotmartSales: number | null,
): ReturnType<typeof calcCPA> {
  return calcCPA({
    metaSpend: hasMetaFilter ? metaSpend : null,
    hotmartTotalSales: hasHotmartFilter ? hotmartSales : null,
  });
}

function guardedConvRate(
  hasMetaFilter: boolean,
  hasHotmartFilter: boolean,
  metaLeads: number | null,
  hotmartSales: number | null,
): ReturnType<typeof calcConversionRate> {
  return calcConversionRate({
    metaLeads: hasMetaFilter ? metaLeads : null,
    hotmartTotalSales: hasHotmartFilter ? hotmartSales : null,
  });
}

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

// ── Source-flag guards (page.tsx contract) ───────────────────────────────────
// These tests verify that when a source flag is false, the guarded wrappers
// return null regardless of the data values. This is the contract that the
// guard logic in page.tsx must satisfy.

describe("ROAS with source-flag guard", () => {
  it("returns null when hasMetaFilter is false (only Hotmart configured)", () => {
    // Meta not configured → meta_spend comes in as 0 (ZEROED_META)
    // The guard must pass null instead of 0 to avoid Infinity or wrong results
    expect(guardedROAS(false, true, 0, 5000)).toBeNull();
  });

  it("returns null when hasHotmartFilter is false (only Meta configured)", () => {
    // Hotmart not configured → total_revenue comes in as 0 (ZEROED_HOTMART)
    expect(guardedROAS(true, false, 1000, 0)).toBeNull();
  });

  it("returns calculated value when both sources are configured", () => {
    expect(guardedROAS(true, true, 1000, 5000)).toBeCloseTo(5, 5);
  });

  it("returns null when both sources are unconfigured", () => {
    expect(guardedROAS(false, false, 0, 0)).toBeNull();
  });
});

describe("CPA with source-flag guard", () => {
  it("returns null when hasMetaFilter is false", () => {
    expect(guardedCPA(false, true, 0, 10)).toBeNull();
  });

  it("returns null when hasHotmartFilter is false", () => {
    expect(guardedCPA(true, false, 1000, 0)).toBeNull();
  });

  it("returns calculated value when both sources are configured", () => {
    expect(guardedCPA(true, true, 1000, 10)).toBeCloseTo(100, 5);
  });
});

describe("ConversionRate with source-flag guard", () => {
  it("returns null when hasMetaFilter is false", () => {
    expect(guardedConvRate(false, true, 0, 10)).toBeNull();
  });

  it("returns null when hasHotmartFilter is false and hotmart sales > 0 would otherwise produce a result", () => {
    // Without the guard: calcConversionRate({ metaLeads: 50, hotmartTotalSales: 0 }) = 0
    // With guard, hotmart not configured → hotmartSales becomes null → returns null
    expect(guardedConvRate(true, false, 50, 0)).toBeNull();
  });

  it("returns calculated value when both sources are configured", () => {
    expect(guardedConvRate(true, true, 50, 10)).toBeCloseTo(20, 5);
  });
});
