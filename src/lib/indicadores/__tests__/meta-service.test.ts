import { fetchMetaMetrics, fetchMetaMetricsUnscoped } from "../service/meta";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

const PERIOD = { startDate: "2026-06-01", endDate: "2026-06-30" };

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

describe("fetchMetaMetrics", () => {
  it("restringe a consulta aos termos de campanha do filtro — sem isso o agente lia o investimento de todas as campanhas", async () => {
    await fetchMetaMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo", "Ingresso"])) },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")[0];
    expect(q.or).toContainEqual(
      "campaign_name.ilike.%PC Ao Vivo%,campaign_name.ilike.%Ingresso%"
    );
  });

  it("passa a data crua, sem converter para UTC — a tabela diária do Meta já é BRT", async () => {
    await fetchMetaMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo"])) },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")[0];
    expect(q.gte).toContainEqual(["date", "2026-06-01"]);
    expect(q.lte).toContainEqual(["date", "2026-06-30"]);
  });

  it("devolve o zerado quando o filtro não tem termos de Meta Ads, sem consultar o banco", async () => {
    const result = await fetchMetaMetrics(
      { period: PERIOD, filter: expandFilter(filterWith([])) },
      supabase.client
    );

    expect(result.meta_spend).toBe(0);
    expect(result.meta_leads).toBe(0);
    expect(supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")).toHaveLength(0);
  });

  it("não inventa CPL quando a fonte não está configurada — devolve null, nunca zero", async () => {
    const result = await fetchMetaMetrics(
      { period: PERIOD, filter: expandFilter(filterWith([])) },
      supabase.client
    );

    expect(result.meta_cpl_traffic).toBeNull();
    expect(result.meta_connect_rate).toBeNull();
    expect(result.meta_lp_conversion).toBeNull();
  });

  it("agrega investimento, leads, impressões e cliques das linhas diárias", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { spend: 100, impressions: 2000, link_clicks: 100, leads_all: 10, page_views: 50, checkout: 4 },
      { spend: 50, impressions: 2000, link_clicks: 100, leads_all: 10, page_views: 50, checkout: 1 },
    ]);

    const result = await fetchMetaMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo"])) },
      supabase.client
    );

    expect(result.meta_spend).toBe(150);
    expect(result.meta_leads).toBe(20);
    expect(result.meta_impressions).toBe(4000);
    expect(result.meta_link_clicks).toBe(200);
    expect(result.meta_checkout).toBe(5);
    expect(result.meta_cpm).toBeCloseTo(37.5);
    expect(result.meta_ctr).toBeCloseTo(5);
    expect(result.meta_cpl_traffic).toBeCloseTo(7.5);
  });

  it("pagina além do cap de 1000 linhas do PostgREST — período vitalício não pode subestimar o investimento", async () => {
    supabase.setRows(
      "dash_gestao_meta_ads_campaigns_daily",
      Array.from({ length: 1500 }, () => ({
        spend: 1, impressions: 10, link_clicks: 1, leads_all: 1, page_views: 1, checkout: 0,
      }))
    );

    const result = await fetchMetaMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo"])) },
      supabase.client
    );

    expect(result.meta_spend).toBe(1500);
    expect(result.meta_leads).toBe(1500);
  });

  it("propaga o erro do banco em vez de devolver zero silenciosamente", async () => {
    supabase.setError("dash_gestao_meta_ads_campaigns_daily", "conexão perdida");

    await expect(
      fetchMetaMetrics(
        { period: PERIOD, filter: expandFilter(filterWith(["PC Ao Vivo"])) },
        supabase.client
      )
    ).rejects.toThrow("conexão perdida");
  });
});

describe("fetchMetaMetricsUnscoped", () => {
  it("não aplica termo nenhum — é o caminho global que o route preserva sem meta_terms[]", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { spend: 80, impressions: 1000, link_clicks: 50, leads_all: 8, page_views: 20, checkout: 2 },
    ]);

    const result = await fetchMetaMetricsUnscoped(
      { period: PERIOD, filter: expandFilter(filterWith([])) },
      supabase.client
    );

    expect(result.meta_spend).toBe(80);
    const q = supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")[0];
    expect(q.or).toEqual([]);
  });
});
