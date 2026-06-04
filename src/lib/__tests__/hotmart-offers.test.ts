import { sortOffers } from "../utils/hotmart-offers";
import { buildHotmartMetricsUrl } from "../utils/hotmart-metrics-filter";

// ── sortOffers ────────────────────────────────────────────────────────────────

describe("sortOffers()", () => {
  const mainOffer = {
    offer_code: "MAIN001",
    offer_name: "Oferta Principal",
    price: 997,
    currency: "BRL",
    is_main_offer: true,
  };

  const offerA = {
    offer_code: "OFR_A",
    offer_name: "Boleto Parcelado",
    price: 800,
    currency: "BRL",
    is_main_offer: false,
  };

  const offerB = {
    offer_code: "OFR_B",
    offer_name: "Cartão à Vista",
    price: 900,
    currency: "BRL",
    is_main_offer: false,
  };

  const offerC = {
    offer_code: "OFR_C",
    offer_name: "Acesso Anual",
    price: 1200,
    currency: "BRL",
    is_main_offer: false,
  };

  it("places main offer first", () => {
    const result = sortOffers([offerB, offerA, mainOffer]);
    expect(result[0]).toEqual(mainOffer);
  });

  it("sorts non-main offers alphabetically in pt-BR after main offer", () => {
    const result = sortOffers([offerB, mainOffer, offerC, offerA]);
    expect(result[0]).toEqual(mainOffer);
    // After main: Acesso Anual, Boleto Parcelado, Cartão à Vista
    expect(result[1]).toEqual(offerC); // Acesso Anual
    expect(result[2]).toEqual(offerA); // Boleto Parcelado
    expect(result[3]).toEqual(offerB); // Cartão à Vista
  });

  it("handles empty array", () => {
    expect(sortOffers([])).toEqual([]);
  });

  it("handles single offer", () => {
    expect(sortOffers([offerA])).toEqual([offerA]);
  });

  it("does not mutate the original array", () => {
    const original = [offerB, mainOffer, offerA];
    const copy = [...original];
    sortOffers(original);
    expect(original).toEqual(copy);
  });

  it("sorts two non-main offers alphabetically when no main offer present", () => {
    const result = sortOffers([offerB, offerA]);
    expect(result[0]).toEqual(offerA); // Boleto Parcelado < Cartão à Vista
    expect(result[1]).toEqual(offerB);
  });
});

// ── buildHotmartMetricsUrl ────────────────────────────────────────────────────

describe("buildHotmartMetricsUrl()", () => {
  it("returns URL with start_date and end_date", () => {
    const url = buildHotmartMetricsUrl("/api/indicadores/hotmart", {
      start_date: "2024-01-01",
      end_date: "2024-01-31",
    });
    expect(url).toContain("start_date=2024-01-01");
    expect(url).toContain("end_date=2024-01-31");
  });

  it("appends offer_code when provided", () => {
    const url = buildHotmartMetricsUrl("/api/indicadores/hotmart", {
      start_date: "2024-01-01",
      end_date: "2024-01-31",
      offer_code: "OFERTA_BRL",
    });
    expect(url).toContain("offer_code=OFERTA_BRL");
  });

  it("does NOT append offer_code when null", () => {
    const url = buildHotmartMetricsUrl("/api/indicadores/hotmart", {
      start_date: "2024-01-01",
      end_date: "2024-01-31",
      offer_code: null,
    });
    expect(url).not.toContain("offer_code");
  });

  it("does NOT append offer_code when undefined", () => {
    const url = buildHotmartMetricsUrl("/api/indicadores/hotmart", {
      start_date: "2024-01-01",
      end_date: "2024-01-31",
    });
    expect(url).not.toContain("offer_code");
  });

  it("appends multiple product_ids", () => {
    const url = buildHotmartMetricsUrl("/api/indicadores/hotmart", {
      start_date: "2024-01-01",
      end_date: "2024-01-31",
      product_ids: ["prod-1", "prod-2"],
    });
    const params = new URLSearchParams(url.split("?")[1]);
    const ids = params.getAll("product_ids[]");
    expect(ids).toContain("prod-1");
    expect(ids).toContain("prod-2");
    expect(ids).toHaveLength(2);
  });

  it("does NOT append product_ids[] when array is empty", () => {
    const url = buildHotmartMetricsUrl("/api/indicadores/hotmart", {
      start_date: "2024-01-01",
      end_date: "2024-01-31",
      product_ids: [],
    });
    expect(url).not.toContain("product_ids");
  });

  it("preserves the route pathname", () => {
    const url = buildHotmartMetricsUrl("/api/indicadores/hotmart", {
      start_date: "2024-01-01",
      end_date: "2024-01-31",
    });
    expect(url.startsWith("/api/indicadores/hotmart?")).toBe(true);
  });
});
