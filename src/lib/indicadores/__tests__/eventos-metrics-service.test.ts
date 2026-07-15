import { fetchEventosMetrics, LIFETIME_START } from "../service/eventos-metrics";
import { makeFakeSupabase } from "./fake-supabase";
import type { FilterRecord } from "@/types/indicadores";

const END_DATE = "2026-07-14";

function makeFilter(overrides: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Evento",
    hotmart_products: [],
    meta_ads_terms: ["PC Ao Vivo"],
    captacao_leads_eventos: ["PC_AO_VIVO_2026"],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("fetchEventosMetrics", () => {
  it("retorna mapa por filtro com leads, spend e cpl no período vitalício", async () => {
    const supabase = makeFakeSupabase();
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { spend: 300, impressions: 0, link_clicks: 0, leads_all: 0, page_views: 0, checkout: 0 },
      { spend: 200, impressions: 0, link_clicks: 0, leads_all: 0, page_views: 0, checkout: 0 },
    ]);
    supabase.setRpc("dash_gestao_leads_unique_total", 10);
    supabase.setRpc("dash_gestao_leads_by_event_unique", []);
    supabase.setRpc("dash_gestao_leads_by_source", []);

    const map = await fetchEventosMetrics([makeFilter()], supabase.client, END_DATE);

    expect(map["f-1"]).toEqual({ leads: 10, spend: 500, cpl: 50 });

    const rpc = supabase.rpcCalls("dash_gestao_leads_unique_total")[0];
    expect(rpc.args).toEqual({
      p_start_date: LIFETIME_START,
      p_end_date: END_DATE,
      p_eventos: ["PC_AO_VIVO_2026"],
    });
    const metaQuery = supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")[0];
    expect(metaQuery.gte).toEqual([["date", LIFETIME_START]]);
    expect(metaQuery.lte).toEqual([["date", END_DATE]]);
  });

  it("cpl é null quando leads = 0", async () => {
    const supabase = makeFakeSupabase();
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { spend: 100, impressions: 0, link_clicks: 0, leads_all: 0, page_views: 0, checkout: 0 },
    ]);
    supabase.setRpc("dash_gestao_leads_unique_total", 0);
    supabase.setRpc("dash_gestao_leads_by_event_unique", []);
    supabase.setRpc("dash_gestao_leads_by_source", []);

    const map = await fetchEventosMetrics([makeFilter()], supabase.client, END_DATE);

    expect(map["f-1"]).toEqual({ leads: 0, spend: 100, cpl: null });
  });

  it("fonte não configurada produz null: sem termos Meta → spend/cpl null", async () => {
    const supabase = makeFakeSupabase();
    supabase.setRpc("dash_gestao_leads_unique_total", 4);
    supabase.setRpc("dash_gestao_leads_by_event_unique", []);
    supabase.setRpc("dash_gestao_leads_by_source", []);

    const map = await fetchEventosMetrics(
      [makeFilter({ meta_ads_terms: [] })],
      supabase.client,
      END_DATE
    );

    expect(map["f-1"]).toEqual({ leads: 4, spend: null, cpl: null });
    expect(supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")).toHaveLength(0);
  });

  it("fonte não configurada produz null: sem eventos de captação → leads/cpl null", async () => {
    const supabase = makeFakeSupabase();
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { spend: 100, impressions: 0, link_clicks: 0, leads_all: 0, page_views: 0, checkout: 0 },
    ]);

    const map = await fetchEventosMetrics(
      [makeFilter({ captacao_leads_eventos: [] })],
      supabase.client,
      END_DATE
    );

    expect(map["f-1"]).toEqual({ leads: null, spend: 100, cpl: null });
    expect(supabase.rpcCalls()).toHaveLength(0);
  });

  it("erro em um filtro vira null sem derrubar os demais", async () => {
    const supabase = makeFakeSupabase();
    supabase.setError("dash_gestao_meta_ads_campaigns_daily", "boom");
    supabase.setRpc("dash_gestao_leads_unique_total", 7);
    supabase.setRpc("dash_gestao_leads_by_event_unique", []);
    supabase.setRpc("dash_gestao_leads_by_source", []);

    const comMeta = makeFilter({ id: "quebrado" });
    const soLeads = makeFilter({ id: "saudavel", meta_ads_terms: [] });

    const map = await fetchEventosMetrics([comMeta, soLeads], supabase.client, END_DATE);

    expect(map["quebrado"]).toBeNull();
    expect(map["saudavel"]).toEqual({ leads: 7, spend: null, cpl: null });
  });
});
