import type { FilterRecord } from "@/types/indicadores";
import { calcConversionRate, calcCPA, calcROAS } from "@/lib/utils/cross-metrics";
import { calcConversionRates, calcFunnelStages } from "@/lib/utils/funnel-metrics";
import { expandFilter, toSearchParams } from "../filter-expansion";
import {
  ZERADO_HOTMART,
  ZERADO_LEADS,
  ZERADO_META,
  derivarResultado,
  fonteConfigurada,
  montarConsulta,
  paramsDaFonte,
} from "../dashboard-evento";
import { carregarFonte, iniciarCargaDoEvento } from "../dashboard-evento-servidor";
import * as leitura from "../leitura";
import * as complementar from "../leitura-complementar";

jest.mock("../leitura", () => ({ loadMetaMetrics: jest.fn(), loadDailySeries: jest.fn() }));
jest.mock("../leitura-complementar", () => ({
  loadHotmartMetrics: jest.fn(),
  loadLeadsMetrics: jest.fn(),
  loadConversionSources: jest.fn(),
}));

const supabase = {} as never;
const period = { startDate: "2026-07-01", endDate: "2026-07-28" };

function filtro(extra: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    account_id: "acc",
    name: "Imersão",
    hotmart_products: [{ product_id: "p1", product_name: "P1" }],
    meta_ads_terms: ["PC"],
    captacao_leads_eventos: ["Evento A"],
    is_organic: false,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...extra,
  };
}

/** Os parâmetros que o `fetchAll` do V1 monta (indicadores-dashboard.tsx), copiados como estavam. */
function legacyParams(f: FilterRecord, offer: string | null) {
  const expanded = expandFilter(f, offer);
  const params = `?${toSearchParams(expanded, period)}`;
  const leadsParams = `?${toSearchParams({ ...expanded, metaTerms: [], productIds: [], offerCode: null }, period)}`;
  return { params, leadsParams };
}

const mocks = {
  meta: leitura.loadMetaMetrics as jest.Mock,
  daily: leitura.loadDailySeries as jest.Mock,
  hotmart: complementar.loadHotmartMetrics as jest.Mock,
  leads: complementar.loadLeadsMetrics as jest.Mock,
  sources: complementar.loadConversionSources as jest.Mock,
};

beforeEach(() => {
  jest.clearAllMocks();
  mocks.meta.mockResolvedValue({ ...ZERADO_META, meta_spend: 100 });
  mocks.daily.mockResolvedValue([]);
  mocks.hotmart.mockResolvedValue({ ...ZERADO_HOTMART, total_sales: 4, total_revenue: 400 });
  mocks.leads.mockResolvedValue({ ...ZERADO_LEADS, total: 9 });
  mocks.sources.mockResolvedValue([{ source: "ig", count: 2 }]);
});

describe("montarConsulta (paridade com o fetchAll do V1)", () => {
  it.each([
    ["evento completo", filtro(), null],
    ["com oferta", filtro(), "OFERTA1"],
    ["só Meta", filtro({ hotmart_products: [], captacao_leads_eventos: [] }), null],
    ["sem fonte nenhuma", filtro({ hotmart_products: [], meta_ads_terms: [], captacao_leads_eventos: [] }), null],
  ])("%s: mesma query string do V1", (_nome, f, offer) => {
    const consulta = montarConsulta(f, period, offer);
    const esperado = legacyParams(f, offer);
    expect(consulta.params).toBe(esperado.params);
    expect(consulta.leadsParams).toBe(esperado.leadsParams);
  });

  it("leads não leva termo de Meta, produto nem oferta", () => {
    const { leadsParams } = montarConsulta(filtro(), period, "OFERTA1");
    expect(leadsParams).not.toContain("meta_terms");
    expect(leadsParams).not.toContain("product_ids");
    expect(leadsParams).not.toContain("offer_code");
    expect(leadsParams).toContain("eventos%5B%5D=Evento+A");
  });

  it("a chave muda com evento, período e oferta", () => {
    const base = montarConsulta(filtro(), period).chave;
    expect(montarConsulta(filtro({ id: "22222222-2222-4222-8222-222222222222" }), period).chave).not.toBe(base);
    expect(montarConsulta(filtro(), { ...period, endDate: "2026-07-27" }).chave).not.toBe(base);
    expect(montarConsulta(filtro(), period, "X").chave).not.toBe(base);
  });
});

describe("fonteConfigurada", () => {
  it("diária sempre; as outras seguem o filtro", () => {
    const { expanded } = montarConsulta(filtro({ hotmart_products: [], captacao_leads_eventos: [] }), period);
    expect(fonteConfigurada(expanded, "daily")).toBe(true);
    expect(fonteConfigurada(expanded, "meta")).toBe(true);
    expect(fonteConfigurada(expanded, "hotmart")).toBe(false);
    expect(fonteConfigurada(expanded, "sources")).toBe(false);
    expect(fonteConfigurada(expanded, "leads")).toBe(false);
  });
});

describe("carregarFonte (servidor)", () => {
  it("chama o carregador certo com os parâmetros do V1", async () => {
    const f = filtro();
    const consulta = montarConsulta(f, period);
    await carregarFonte("meta", consulta, period, supabase);
    await carregarFonte("leads", consulta, period, supabase);
    const [spMeta, periodoMeta] = mocks.meta.mock.calls[0];
    expect(spMeta.toString()).toBe(legacyParams(f, null).params.slice(1));
    expect(periodoMeta).toEqual(period);
    expect(mocks.leads.mock.calls[0][0].toString()).toBe(legacyParams(f, null).leadsParams.slice(1));
  });

  it("devolve o dado do carregador com a chave da consulta", async () => {
    const consulta = montarConsulta(filtro(), period);
    expect(await carregarFonte("hotmart", consulta, period, supabase)).toEqual({
      data: { ...ZERADO_HOTMART, total_sales: 4, total_revenue: 400 },
      chave: consulta.chave,
    });
  });

  it("fonte não configurada vale zero e não consulta o banco", async () => {
    const consulta = montarConsulta(filtro({ hotmart_products: [], captacao_leads_eventos: [] }), period);
    expect((await carregarFonte("hotmart", consulta, period, supabase))?.data).toEqual(ZERADO_HOTMART);
    expect((await carregarFonte("leads", consulta, period, supabase))?.data).toEqual(ZERADO_LEADS);
    expect((await carregarFonte("sources", consulta, period, supabase))?.data).toEqual([]);
    expect(mocks.hotmart).not.toHaveBeenCalled();
    expect(mocks.leads).not.toHaveBeenCalled();
    expect(mocks.sources).not.toHaveBeenCalled();
  });

  it("falha vira null em vez de derrubar a página", async () => {
    mocks.meta.mockRejectedValue(new Error("banco fora"));
    expect(await carregarFonte("meta", montarConsulta(filtro(), period), period, supabase)).toBeNull();
  });

  it("uma fonte com erro não afeta as outras", async () => {
    mocks.hotmart.mockRejectedValue(new Error("x"));
    const carga = iniciarCargaDoEvento(montarConsulta(filtro(), period), period, supabase);
    expect(await carga.hotmart).toBeNull();
    expect((await carga.meta)?.data.meta_spend).toBe(100);
    expect((await carga.leads)?.data.total).toBe(9);
  });
});

describe("derivarResultado (paridade com o V1)", () => {
  const meta = { ...ZERADO_META, meta_spend: 200, meta_leads: 50, meta_impressions: 1000, meta_link_clicks: 100, meta_page_views: 80 };
  const hotmart = { ...ZERADO_HOTMART, total_sales: 5, total_revenue: 1000 };
  const leads = { ...ZERADO_LEADS, total: 40 };

  it("com as duas fontes, bate com as funções do V1", () => {
    const { expanded } = montarConsulta(filtro(), period);
    const r = derivarResultado(expanded, meta, hotmart, leads);
    expect(r.roas).toBe(calcROAS({ metaSpend: 200, hotmartTotalRevenue: 1000 }));
    expect(r.roas).toBe(5);
    expect(r.cpa).toBe(calcCPA({ metaSpend: 200, hotmartTotalSales: 5 }));
    expect(r.convRate).toBe(calcConversionRate({ metaLeads: 50, hotmartTotalSales: 5 }));
    const etapas = calcFunnelStages(meta, hotmart, 40)!;
    expect(r.funil).toEqual({ etapas, taxas: calcConversionRates(etapas) });
  });

  it("fonte não configurada entra como null e mostra traço, não zero", () => {
    const { expanded } = montarConsulta(filtro({ meta_ads_terms: [] }), period);
    const r = derivarResultado(expanded, ZERADO_META, hotmart, leads);
    expect(r.roas).toBeNull();
    expect(r.cpa).toBeNull();
    expect(r.convRate).toBeNull();
    expect(r.funil).toBeNull();
  });

  it.each([
    ["Meta", { meta_ads_terms: [] }],
    ["Hotmart", { hotmart_products: [] }],
  ])("dado de %s fora do filtro é ignorado mesmo que não seja zero", (_nome, extra) => {
    // Ex.: resposta antiga em cache de um evento que tinha as duas fontes.
    const { expanded } = montarConsulta(filtro(extra), period);
    const r = derivarResultado(expanded, meta, hotmart, leads);
    expect(r.roas).toBeNull();
    expect(r.cpa).toBeNull();
    expect(r.convRate).toBeNull();
  });

  it("leads ausente vale zero no funil", () => {
    const { expanded } = montarConsulta(filtro(), period);
    expect(derivarResultado(expanded, meta, hotmart, null).funil?.etapas[3].value).toBe(0);
  });
});

describe("paramsDaFonte", () => {
  it("só leads usa a query reduzida", () => {
    const c = montarConsulta(filtro(), period);
    expect(paramsDaFonte(c, "leads")).toBe(c.leadsParams);
    for (const fonte of ["meta", "hotmart", "daily", "sources"] as const) expect(paramsDaFonte(c, fonte)).toBe(c.params);
  });
});
