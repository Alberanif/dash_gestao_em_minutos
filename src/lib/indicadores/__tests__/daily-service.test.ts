import { fetchDailySeries } from "../service/daily";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

const PERIOD = { startDate: "2026-06-01", endDate: "2026-06-03" };

interface FilterParts {
  products?: string[];
  terms?: string[];
  eventos?: string[];
}

function filterWith({ products = [], terms = [], eventos = [] }: FilterParts): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: products.map((id) => ({ product_id: id, product_name: `Produto ${id}` })),
    meta_ads_terms: terms,
    captacao_leads_eventos: eventos,
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

describe("fetchDailySeries", () => {
  it("restringe as vendas Hotmart aos produtos do filtro", async () => {
    await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({ products: ["111", "222"] })) },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(q.in).toContainEqual(["product_id", ["111", "222"]]);
  });

  it("restringe o Meta Ads aos termos do filtro, no intervalo de datas BRT", async () => {
    await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({ terms: ["PC Ao Vivo", "Black"] })) },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")[0];
    expect(q.or).toContainEqual(
      "campaign_name.ilike.%PC Ao Vivo%,campaign_name.ilike.%Black%"
    );
    expect(q.gte).toContainEqual(["date", "2026-06-01"]);
    expect(q.lte).toContainEqual(["date", "2026-06-03"]);
  });

  it("conta os leads pela RPC diária, restrita aos eventos do filtro", async () => {
    await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({ eventos: ["evento-a"] })) },
      supabase.client
    );

    expect(supabase.rpcCalls("dash_gestao_leads_daily_counts")).toEqual([
      {
        fn: "dash_gestao_leads_daily_counts",
        args: {
          p_start_date: "2026-06-01",
          p_end_date: "2026-06-03",
          p_eventos: ["evento-a"],
        },
      },
    ]);
  });

  it("passa p_eventos nulo quando o filtro não tem eventos, sem virar lista vazia", async () => {
    await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({})) },
      supabase.client
    );

    const [call] = supabase.rpcCalls("dash_gestao_leads_daily_counts");
    expect(call.args.p_eventos).toBeNull();
  });

  it("soma as campanhas Meta do mesmo dia num único ponto, com CPL null-safe", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { date: "2026-06-01", spend: 100, leads_all: 4, checkout: 2 },
      { date: "2026-06-01", spend: 50, leads_all: 1, checkout: 3 },
      { date: "2026-06-02", spend: 30, leads_all: 0, checkout: 0 },
    ]);

    const series = await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({ terms: ["PC"] })) },
      supabase.client
    );

    expect(series[0]).toEqual({
      date: "2026-06-01",
      meta_spend: 150,
      meta_leads: 5,
      meta_cpl_traffic: 30,
      meta_checkout: 5,
      hotmart_sales: 0,
      lead_captacoes: 0,
    });
    // Investimento sem lead nenhum é ausência de CPL, nunca Infinity nem 0.
    expect(series[1].meta_cpl_traffic).toBeNull();
  });

  it("conta a venda no dia BRT em que ela aconteceu, não no dia UTC", async () => {
    const approved = { status: "APPROVED", product_id: "111" };
    supabase.setRows("dash_gestao_hotmart_sales", [
      // 01/06 22:00 BRT chega no banco como 02/06 01:00 UTC: é venda do dia 1.
      { ...approved, purchase_date: "2026-06-02T01:00:00.000Z" },
      { ...approved, purchase_date: "2026-06-02T15:00:00.000Z" },
      { ...approved, purchase_date: "2026-06-02T18:00:00.000Z" },
    ]);

    const series = await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({ products: ["111"] })) },
      supabase.client
    );

    const byDate = Object.fromEntries(series.map((p) => [p.date, p.hotmart_sales]));
    expect(byDate).toEqual({ "2026-06-01": 1, "2026-06-02": 2, "2026-06-03": 0 });
  });

  it("preenche as lacunas do intervalo mesmo sem nenhum dado", async () => {
    const series = await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({ products: ["111"] })) },
      supabase.client
    );

    expect(series.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
  });

  it("traz os leads por dia devolvidos pela RPC", async () => {
    supabase.setRpc("dash_gestao_leads_daily_counts", [
      { date: "2026-06-02", count: 7 },
    ]);

    const series = await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({ eventos: ["evento-a"] })) },
      supabase.client
    );

    expect(series.map((p) => p.lead_captacoes)).toEqual([0, 7, 0]);
  });

  it("aplica o código de oferta nas vendas, como o card de Hotmart já faz", async () => {
    await fetchDailySeries(
      {
        period: PERIOD,
        filter: expandFilter(filterWith({ products: ["111"] }), "OFERTA-X"),
      },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(q.eq).toContainEqual(["offer_code", "OFERTA-X"]);
  });

  it("não consulta vendas quando o filtro não tem produtos — ausência não vira série global", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [
      { status: "APPROVED", product_id: "999", purchase_date: "2026-06-02T15:00:00.000Z" },
    ]);

    const series = await fetchDailySeries(
      { period: PERIOD, filter: expandFilter(filterWith({ terms: ["PC"] })) },
      supabase.client
    );

    expect(supabase.queriesFor("dash_gestao_hotmart_sales")).toHaveLength(0);
    expect(series.map((p) => p.hotmart_sales)).toEqual([0, 0, 0]);
  });

  it("propaga o erro do banco em vez de devolver série zerada", async () => {
    supabase.setError("dash_gestao_meta_ads_campaigns_daily", "conexão perdida");

    await expect(
      fetchDailySeries(
        { period: PERIOD, filter: expandFilter(filterWith({ terms: ["PC"] })) },
        supabase.client
      )
    ).rejects.toThrow("conexão perdida");
  });
});
