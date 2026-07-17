import { fetchMetaMetricsWeekly } from "../service/meta";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

// Exemplo do PRD: 06/07 (seg) a 22/07 → semanas 06–08/07, 09–15/07, 16–22/07
const PERIOD = { startDate: "2026-07-06", endDate: "2026-07-22" };

function filterWith(terms: string[]): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: [],
    meta_ads_terms: terms,
    captacao_leads_eventos: [],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("fetchMetaMetricsWeekly", () => {
  it("devolve o agregado do período mais uma entrada por semana quinta→quarta", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { date: "2026-07-06", spend: 100, impressions: 1000, link_clicks: 50, leads_all: 10, page_views: 40, checkout: 2 },
      { date: "2026-07-10", spend: 200, impressions: 2000, link_clicks: 100, leads_all: 20, page_views: 80, checkout: 4 },
      { date: "2026-07-22", spend: 300, impressions: 3000, link_clicks: 150, leads_all: 30, page_views: 120, checkout: 6 },
    ]);

    const result = await fetchMetaMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo"])) },
      supabase.client
    );

    expect(result.meta_spend).toBe(600);
    expect(result.weeks).toHaveLength(3);
    expect(result.weeks.map((w) => [w.startDate, w.endDate])).toEqual([
      ["2026-07-06", "2026-07-08"],
      ["2026-07-09", "2026-07-15"],
      ["2026-07-16", "2026-07-22"],
    ]);
    expect(result.weeks.map((w) => w.meta_spend)).toEqual([100, 200, 300]);
    expect(result.weeks.map((w) => w.meta_leads)).toEqual([10, 20, 30]);
  });

  it("a soma dos brutos semanais bate com o agregado do período (RF-4)", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { date: "2026-07-07", spend: 11.5, impressions: 900, link_clicks: 45, leads_all: 7, page_views: 30, checkout: 1 },
      { date: "2026-07-09", spend: 22.25, impressions: 1100, link_clicks: 55, leads_all: 9, page_views: 44, checkout: 3 },
      { date: "2026-07-16", spend: 33.75, impressions: 1300, link_clicks: 65, leads_all: 11, page_views: 52, checkout: 5 },
      { date: "2026-07-20", spend: 44.5, impressions: 1500, link_clicks: 75, leads_all: 13, page_views: 60, checkout: 7 },
    ]);

    const result = await fetchMetaMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo"])) },
      supabase.client
    );

    const sum = (pick: (w: (typeof result.weeks)[number]) => number) =>
      result.weeks.reduce((total, w) => total + pick(w), 0);

    expect(sum((w) => w.meta_spend)).toBeCloseTo(result.meta_spend);
    expect(sum((w) => w.meta_impressions)).toBe(result.meta_impressions);
    expect(sum((w) => w.meta_link_clicks)).toBe(result.meta_link_clicks);
    expect(sum((w) => w.meta_leads)).toBe(result.meta_leads);
    expect(sum((w) => w.meta_page_views)).toBe(result.meta_page_views);
    expect(sum((w) => w.meta_checkout)).toBe(result.meta_checkout);
  });

  it("calcula razões de cada semana a partir dos brutos daquela semana (RF-3)", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { date: "2026-07-06", spend: 100, impressions: 1000, link_clicks: 50, leads_all: 10, page_views: 40, checkout: 2 },
      { date: "2026-07-10", spend: 300, impressions: 2000, link_clicks: 40, leads_all: 60, page_views: 100, checkout: 4 },
    ]);

    const result = await fetchMetaMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo"])) },
      supabase.client
    );

    // Semana 1: CPL = 100/10; Semana 2: CPL = 300/60 — não é média das médias
    expect(result.weeks[0].meta_cpl_traffic).toBeCloseTo(10);
    expect(result.weeks[1].meta_cpl_traffic).toBeCloseTo(5);
    expect(result.weeks[0].meta_cpm).toBeCloseTo(100);
    expect(result.weeks[1].meta_cpm).toBeCloseTo(150);
  });

  it("semana sem dados vem zerada, com razões não calculáveis em null", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { date: "2026-07-06", spend: 100, impressions: 1000, link_clicks: 50, leads_all: 10, page_views: 40, checkout: 2 },
    ]);

    const result = await fetchMetaMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo"])) },
      supabase.client
    );

    const emptyWeek = result.weeks[1];
    expect(emptyWeek.meta_spend).toBe(0);
    expect(emptyWeek.meta_leads).toBe(0);
    expect(emptyWeek.meta_cpl_traffic).toBeNull();
    expect(emptyWeek.meta_connect_rate).toBeNull();
    expect(emptyWeek.meta_lp_conversion).toBeNull();
  });

  it("fonte não configurada devolve zerado com todas as semanas zeradas, sem consultar o banco", async () => {
    const result = await fetchMetaMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith([])) },
      supabase.client
    );

    expect(result.meta_spend).toBe(0);
    expect(result.weeks).toHaveLength(3);
    expect(result.weeks.every((w) => w.meta_spend === 0)).toBe(true);
    expect(supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")).toHaveLength(0);
  });

  it("restringe a consulta aos termos do filtro, como o caminho agregado", async () => {
    await fetchMetaMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo", "Ingresso"])) },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")[0];
    expect(q.or).toContainEqual(
      "campaign_name.ilike.%PC Ao Vivo%,campaign_name.ilike.%Ingresso%"
    );
    expect(q.gte).toContainEqual(["date", "2026-07-06"]);
    expect(q.lte).toContainEqual(["date", "2026-07-22"]);
  });
});
