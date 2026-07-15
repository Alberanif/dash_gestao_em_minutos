import { fetchPeriodSummary } from "../service/period-summary";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

const PERIOD = { startDate: "2026-06-01", endDate: "2026-06-30" };

interface FilterParts {
  produtos?: string[];
  termos?: string[];
  eventos?: string[];
}

function filterWith({ produtos = [], termos = [], eventos = [] }: FilterParts): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: produtos.map((id) => ({ product_id: id, product_name: `Produto ${id}` })),
    meta_ads_terms: termos,
    captacao_leads_eventos: eventos,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const FULL = filterWith({ produtos: ["111"], termos: ["PC Ao Vivo"], eventos: ["Evento A"] });

function sale(price: number, product_id = "111") {
  return {
    product_id,
    product_name: `Produto ${product_id}`,
    price,
    currency: "BRL",
    status: "APPROVED",
    purchase_date: "2026-06-15T12:00:00.000Z",
  };
}

function campaignDay(spend: number, leads_all: number) {
  return { spend, impressions: 1000, link_clicks: 50, leads_all, page_views: 30, checkout: 5 };
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("fetchPeriodSummary", () => {
  it("compõe todas as seções numa chamada só — uma call = visão completa", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [campaignDay(100, 20)]);
    supabase.setRows("dash_gestao_hotmart_sales", [sale(250)]);
    supabase.setRpc("dash_gestao_leads_unique_total", 40);
    supabase.setRpc("dash_gestao_leads_by_event_unique", [{ evento: "Evento A", count: 40 }]);
    supabase.setRpc("dash_gestao_leads_by_source", [{ source: "instagram", count: 40 }]);
    supabase.setRpc("get_conversion_sources", [{ source: "instagram", count: 1 }]);

    const summary = await fetchPeriodSummary(
      { period: PERIOD, filter: expandFilter(FULL) },
      supabase.client
    );

    expect(summary.period).toEqual(PERIOD);
    expect(summary.sources).toEqual({ meta: true, hotmart: true, leads: true });
    expect(summary.meta.meta_spend).toBe(100);
    expect(summary.meta.meta_leads).toBe(20);
    expect(summary.hotmart.total_revenue).toBe(250);
    expect(summary.hotmart.products).toEqual([
      expect.objectContaining({ product_id: "111", sales_count: 1, revenue: 250 }),
    ]);
    expect(summary.leads).toEqual({
      total: 40,
      by_event: [{ evento: "Evento A", count: 40 }],
      by_source: [{ source: "instagram", count: 40 }],
    });
    expect(summary.conversionSources).toEqual([{ source: "instagram", count: 1 }]);
  });

  it("calcula os derivados no servidor, para o modelo não dividir número na mão", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [campaignDay(100, 20)]);
    supabase.setRows("dash_gestao_hotmart_sales", [sale(250), sale(150)]);

    const summary = await fetchPeriodSummary(
      { period: PERIOD, filter: expandFilter(FULL) },
      supabase.client
    );

    // receita 400 / investimento 100
    expect(summary.derived.roas).toBeCloseTo(4);
    // investimento 100 / 2 vendas
    expect(summary.derived.cpa).toBeCloseTo(50);
    // 2 vendas / 20 leads * 100
    expect(summary.derived.conversionRate).toBeCloseTo(10);
  });

  it("com investimento zero, ROAS é null — nunca Infinity, nunca 0", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [campaignDay(0, 0)]);
    supabase.setRows("dash_gestao_hotmart_sales", [sale(250)]);

    const summary = await fetchPeriodSummary(
      { period: PERIOD, filter: expandFilter(FULL) },
      supabase.client
    );

    expect(summary.hotmart.total_revenue).toBe(250);
    expect(summary.derived.roas).toBeNull();
    expect(summary.derived.roas).not.toBe(Infinity);
    expect(summary.derived.cpa).toBeNull();
    expect(summary.derived.conversionRate).toBeNull();
  });

  it("sem Meta Ads no filtro, declara a fonte como não configurada e não consulta o banco", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [sale(250)]);
    const semMeta = expandFilter(filterWith({ produtos: ["111"], eventos: ["Evento A"] }));

    const summary = await fetchPeriodSummary({ period: PERIOD, filter: semMeta }, supabase.client);

    expect(summary.sources.meta).toBe(false);
    expect(supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")).toHaveLength(0);
    // CPL ausente é null, não zero: zero seria lido como "investi e não captei".
    expect(summary.meta.meta_cpl_traffic).toBeNull();
    expect(summary.derived.roas).toBeNull();
    // A fonte que *está* configurada continua trazendo número de verdade.
    expect(summary.hotmart.total_revenue).toBe(250);
  });

  it("distingue fonte não configurada de zero de verdade — mesmos números, flags diferentes", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", []);
    const comMeta = expandFilter(filterWith({ produtos: ["111"], termos: ["PC Ao Vivo"] }));
    const semMeta = expandFilter(filterWith({ produtos: ["111"] }));

    const zeroDeVerdade = await fetchPeriodSummary(
      { period: PERIOD, filter: comMeta },
      supabase.client
    );
    const naoConfigurada = await fetchPeriodSummary(
      { period: PERIOD, filter: semMeta },
      supabase.client
    );

    expect(zeroDeVerdade.meta.meta_spend).toBe(0);
    expect(naoConfigurada.meta.meta_spend).toBe(0);
    expect(zeroDeVerdade.sources.meta).toBe(true);
    expect(naoConfigurada.sources.meta).toBe(false);
  });

  it("filtro sem produto Hotmart não devolve as origens de conversão de outros produtos", async () => {
    supabase.setRpc("get_conversion_sources", [{ source: "de-outro-produto", count: 99 }]);
    const semHotmart = expandFilter(filterWith({ termos: ["PC Ao Vivo"], eventos: ["Evento A"] }));

    const summary = await fetchPeriodSummary(
      { period: PERIOD, filter: semHotmart },
      supabase.client
    );

    expect(summary.conversionSources).toEqual([]);
    expect(summary.sources.hotmart).toBe(false);
    expect(supabase.rpcCalls("get_conversion_sources")).toHaveLength(0);
  });

  it("propaga a falha de qualquer seção em vez de compor um resumo pela metade", async () => {
    supabase.setError("dash_gestao_hotmart_sales", "timeout no banco");

    await expect(
      fetchPeriodSummary({ period: PERIOD, filter: expandFilter(FULL) }, supabase.client)
    ).rejects.toThrow("timeout no banco");
  });
});
