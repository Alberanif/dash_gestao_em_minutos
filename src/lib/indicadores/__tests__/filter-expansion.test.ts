import { expandFilter, toSearchParams } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";

function makeFilter(overrides: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Ingresso PC Ao Vivo",
    hotmart_products: [
      { product_id: "111", product_name: "Ingresso" },
      { product_id: "222", product_name: "Upsell" },
    ],
    meta_ads_terms: ["PC Ao Vivo", "Ingresso"],
    captacao_leads_eventos: ["evento-a"],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("expandFilter", () => {
  it("expande um filtro com Meta, Hotmart e eventos em todos os parâmetros de consulta", () => {
    const expanded = expandFilter(makeFilter(), null);

    expect(expanded.metaTerms).toEqual(["PC Ao Vivo", "Ingresso"]);
    expect(expanded.productIds).toEqual(["111", "222"]);
    expect(expanded.eventos).toEqual(["evento-a"]);
    expect(expanded.offerCode).toBeNull();
  });

  it("marca como configuradas somente as fontes que o filtro de fato contém", () => {
    const expanded = expandFilter(makeFilter(), null);

    expect(expanded.sources).toEqual({ meta: true, hotmart: true, leads: true });
  });

  it("trata um filtro só-Hotmart: Meta e leads não configurados", () => {
    const expanded = expandFilter(
      makeFilter({ meta_ads_terms: [], captacao_leads_eventos: [] }),
      null
    );

    expect(expanded.metaTerms).toEqual([]);
    expect(expanded.eventos).toEqual([]);
    expect(expanded.productIds).toEqual(["111", "222"]);
    expect(expanded.sources).toEqual({ meta: false, hotmart: true, leads: false });
  });

  it("trata um filtro vazio: nenhuma fonte configurada", () => {
    const expanded = expandFilter(
      makeFilter({ hotmart_products: [], meta_ads_terms: [], captacao_leads_eventos: [] }),
      null
    );

    expect(expanded.sources).toEqual({ meta: false, hotmart: false, leads: false });
    expect(expanded.productIds).toEqual([]);
  });

  it("trata a ausência de filtro como escopo vazio, nunca como escopo global", () => {
    const expanded = expandFilter(null, null);

    expect(expanded.metaTerms).toEqual([]);
    expect(expanded.productIds).toEqual([]);
    expect(expanded.eventos).toEqual([]);
    expect(expanded.sources).toEqual({ meta: false, hotmart: false, leads: false });
  });

  it("carrega o código de oferta quando há uma selecionada", () => {
    expect(expandFilter(makeFilter(), "OFERTA-X").offerCode).toBe("OFERTA-X");
  });

  it("normaliza oferta ausente, vazia ou em branco para null", () => {
    expect(expandFilter(makeFilter(), null).offerCode).toBeNull();
    expect(expandFilter(makeFilter(), "").offerCode).toBeNull();
    expect(expandFilter(makeFilter(), "  ").offerCode).toBeNull();
  });

  it("descarta termos de Meta em branco, que casariam com qualquer campanha", () => {
    const expanded = expandFilter(makeFilter({ meta_ads_terms: ["PC", "  ", ""] }), null);

    expect(expanded.metaTerms).toEqual(["PC"]);
  });

  it("tolera captacao_leads_eventos ausente em filtros antigos", () => {
    const legacy = makeFilter();
    delete (legacy as Partial<FilterRecord>).captacao_leads_eventos;

    const expanded = expandFilter(legacy, null);

    expect(expanded.eventos).toEqual([]);
    expect(expanded.sources.leads).toBe(false);
  });
});

describe("toSearchParams", () => {
  it("emite os nomes de parâmetro que os endpoints de indicadores de fato leem", () => {
    const params = toSearchParams(expandFilter(makeFilter(), "OFERTA-X"), {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(params.get("start_date")).toBe("2026-06-01");
    expect(params.get("end_date")).toBe("2026-06-30");
    expect(params.getAll("meta_terms[]")).toEqual(["PC Ao Vivo", "Ingresso"]);
    expect(params.getAll("product_ids[]")).toEqual(["111", "222"]);
    expect(params.getAll("eventos[]")).toEqual(["evento-a"]);
    expect(params.get("offer_code")).toBe("OFERTA-X");
  });

  it("nunca emite filter_id — nenhum endpoint lê esse parâmetro", () => {
    const params = toSearchParams(expandFilter(makeFilter(), null), {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(params.has("filter_id")).toBe(false);
  });

  it("omite offer_code quando não há oferta selecionada", () => {
    const params = toSearchParams(expandFilter(makeFilter(), null), {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(params.has("offer_code")).toBe(false);
  });
});
