import { fetchReportDiario, hojeBrt } from "../report-diario";
import { LIFETIME_START } from "../eventos-metrics";
import { fetchMetaMetrics } from "../meta";
import { fetchLeadsMetrics } from "../leads";
import { fetchHotmartMetrics } from "../hotmart";
import type { FilterRecord } from "@/types/indicadores";

jest.mock("../meta", () => ({ fetchMetaMetrics: jest.fn() }));
jest.mock("../leads", () => ({ fetchLeadsMetrics: jest.fn() }));
jest.mock("../hotmart", () => ({ fetchHotmartMetrics: jest.fn() }));

const metaMock = fetchMetaMetrics as jest.Mock;
const leadsMock = fetchLeadsMetrics as jest.Mock;
const hotmartMock = fetchHotmartMetrics as jest.Mock;
const supabase = {} as never;
const HOJE = "2026-10-25";

function makeFilter(overrides: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Evento",
    hotmart_products: [{ product_id: "999", product_name: "Captura" }],
    meta_ads_terms: ["PC Ao Vivo"],
    captacao_leads_eventos: ["PC_AO_VIVO_2026"],
    is_organic: false,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  metaMock.mockReset();
  leadsMock.mockReset();
  hotmartMock.mockReset();
  metaMock.mockResolvedValue({ meta_spend: 1000 });
  leadsMock.mockResolvedValue({ total: 7 });
  hotmartMock.mockResolvedValue({ total_sales: 100 });
});

describe("fetchReportDiario", () => {
  it("considera só filtros ativos", async () => {
    const map = await fetchReportDiario(
      [makeFilter(), makeFilter({ id: "f-2", status: "inativo" as never })],
      supabase,
      HOJE
    );
    expect(Object.keys(map)).toEqual(["f-1"]);
  });

  it("consulta uma janela só: do início da ação até hoje", async () => {
    const map = await fetchReportDiario([makeFilter()], supabase, HOJE);
    expect(map["f-1"]).toEqual({
      id: "f-1",
      nome: "Evento",
      periodo: { leads: 100, spend: 1000, cpl: 10 },
    });
    expect(metaMock).toHaveBeenCalledTimes(1);
    expect(metaMock.mock.calls[0][0].period).toEqual({ startDate: LIFETIME_START, endDate: HOJE });
    expect(hotmartMock.mock.calls[0][0].period).toEqual({ startDate: LIFETIME_START, endDate: HOJE });
  });

  it("cpl é null com 0 leads", async () => {
    hotmartMock.mockResolvedValue({ total_sales: 0 });
    const map = await fetchReportDiario([makeFilter()], supabase, HOJE);
    expect(map["f-1"]?.periodo).toEqual({ leads: 0, spend: 1000, cpl: null });
  });

  it("sem fonte meta, spend e cpl são null (não 0)", async () => {
    const map = await fetchReportDiario([makeFilter({ meta_ads_terms: [] })], supabase, HOJE);
    expect(metaMock).not.toHaveBeenCalled();
    expect(map["f-1"]?.periodo).toEqual({ leads: 100, spend: null, cpl: null });
  });

  it("falha de um funil vira null sem derrubar os outros", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    metaMock.mockImplementation(async ({ filter }) => {
      if (filter.metaTerms.includes("QUEBRA")) throw new Error("boom");
      return { meta_spend: 10 };
    });
    const map = await fetchReportDiario(
      [makeFilter({ id: "ruim", meta_ads_terms: ["QUEBRA"] }), makeFilter({ id: "bom" })],
      supabase,
      HOJE
    );
    expect(map.ruim).toBeNull();
    expect(map.bom).not.toBeNull();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("ruim"), expect.anything());
    spy.mockRestore();
  });
});

describe("leads pelas vendas do produto de captura", () => {
  it("evento pago conta vendas e ignora os registros de leads", async () => {
    const map = await fetchReportDiario([makeFilter()], supabase, HOJE);
    expect(map["f-1"]?.periodo.leads).toBe(100);
    expect(leadsMock).not.toHaveBeenCalled();
    expect(hotmartMock.mock.calls[0][0].filter.productIds).toEqual(["999"]);
  });

  it("evento orgânico segue contando registros de leads", async () => {
    const map = await fetchReportDiario([makeFilter({ is_organic: true })], supabase, HOJE);
    expect(map["f-1"]?.periodo.leads).toBe(7);
    expect(hotmartMock).not.toHaveBeenCalled();
  });

  it("evento pago sem produto de captura: leads e cpl null, sem recorrer aos registros", async () => {
    const map = await fetchReportDiario([makeFilter({ hotmart_products: [] })], supabase, HOJE);
    expect(map["f-1"]?.periodo).toEqual({ leads: null, spend: 1000, cpl: null });
    expect(leadsMock).not.toHaveBeenCalled();
  });

  it("cpl divide o investimento pelas vendas", async () => {
    hotmartMock.mockResolvedValue({ total_sales: 40 });
    const map = await fetchReportDiario([makeFilter()], supabase, HOJE);
    expect(map["f-1"]?.periodo.cpl).toBe(25);
  });

  it("falha na consulta de vendas deixa o funil indisponível", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    hotmartMock.mockRejectedValue(new Error("boom"));
    const map = await fetchReportDiario([makeFilter()], supabase, HOJE);
    expect(map["f-1"]).toBeNull();
    spy.mockRestore();
  });
});

describe("hojeBrt", () => {
  it("02:00 UTC ainda é o dia anterior em BRT", () => {
    expect(hojeBrt(new Date("2026-10-25T02:00:00Z"))).toBe("2026-10-24");
  });
  it("03:00 UTC já é o dia seguinte em BRT", () => {
    expect(hojeBrt(new Date("2026-10-25T03:00:00Z"))).toBe("2026-10-25");
  });
});
