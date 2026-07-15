import { fetchHotmartMetrics } from "../service/hotmart";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

const PERIOD = { startDate: "2026-06-01", endDate: "2026-06-30" };

// BRT (UTC-3) → UTC. Um erro aqui desloca vendas de um dia para o outro.
const START_UTC = "2026-06-01T03:00:00.000Z";
const END_UTC = "2026-07-01T02:59:59.000Z";

function filterWith(products: string[]): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: products.map((id) => ({ product_id: id, product_name: `Produto ${id}` })),
    meta_ads_terms: [],
    captacao_leads_eventos: [],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

type SaleFixture = { product_id: string; product_name: string; price: number; currency: string };

function sale(fixture: SaleFixture) {
  return { ...fixture, status: "APPROVED", purchase_date: "2026-06-15T12:00:00.000Z" };
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("fetchHotmartMetrics", () => {
  it("restringe a consulta aos produtos do filtro — sem isso o agente lia vendas de todos os produtos", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [
      sale({ product_id: "111", product_name: "Ingresso", price: 100, currency: "BRL" }),
    ]);

    await fetchHotmartMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["111", "222"])) },
      supabase.client
    );

    const salesQueries = supabase.queriesFor("dash_gestao_hotmart_sales");
    expect(salesQueries.length).toBeGreaterThan(0);
    for (const q of salesQueries) {
      expect(q.in).toContainEqual(["product_id", ["111", "222"]]);
    }
  });

  it("converte as datas de BRT para UTC antes de consultar", async () => {
    await fetchHotmartMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["111"])) },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(q.gte).toContainEqual(["purchase_date", START_UTC]);
    expect(q.lte).toContainEqual(["purchase_date", END_UTC]);
  });

  it("aplica o código de oferta junto com os produtos do filtro", async () => {
    await fetchHotmartMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["111"]), "OFERTA-X") },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(q.eq).toContainEqual(["offer_code", "OFERTA-X"]);
  });

  it("conta somente vendas aprovadas", async () => {
    await fetchHotmartMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["111"])) },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(q.in).toContainEqual(["status", ["COMPLETE", "APPROVED"]]);
  });

  it("agrega receita e vendas por produto", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [
      sale({ product_id: "111", product_name: "Ingresso", price: 100, currency: "BRL" }),
      sale({ product_id: "111", product_name: "Ingresso", price: 150, currency: "BRL" }),
      sale({ product_id: "222", product_name: "Upsell", price: 50, currency: "BRL" }),
    ]);

    const result = await fetchHotmartMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["111", "222"])) },
      supabase.client
    );

    expect(result.total_revenue).toBe(300);
    expect(result.total_sales).toBe(3);
    expect(result.total_sales_brl).toBe(3);
    expect(result.products).toEqual([
      expect.objectContaining({ product_id: "111", sales_count: 2, revenue: 250 }),
      expect.objectContaining({ product_id: "222", sales_count: 1, revenue: 50 }),
    ]);
  });

  it("conta venda em moeda estrangeira sem somar receita em BRL", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [
      sale({ product_id: "111", product_name: "Ingresso", price: 100, currency: "BRL" }),
      sale({ product_id: "333", product_name: "Gringa", price: 40, currency: "USD" }),
    ]);

    const result = await fetchHotmartMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["111", "333"])) },
      supabase.client
    );

    expect(result.total_revenue).toBe(100);
    expect(result.total_sales).toBe(2);
    expect(result.total_sales_brl).toBe(1);
    expect(result.total_sales_foreign).toBe(1);
    expect(result.products).toContainEqual(
      expect.objectContaining({ product_id: "333", revenue: 0, is_foreign_currency: true })
    );
  });

  it("devolve o resultado zerado quando o filtro não tem produtos Hotmart, sem consultar o banco", async () => {
    const result = await fetchHotmartMetrics(
      { period: PERIOD, filter: expandFilter(filterWith([])) },
      supabase.client
    );

    expect(result).toEqual({
      products: [],
      total_sales: 0,
      total_sales_brl: 0,
      total_sales_foreign: 0,
      total_revenue: 0,
    });
    expect(supabase.queriesFor("dash_gestao_hotmart_sales")).toHaveLength(0);
  });

  it("propaga o erro do banco em vez de devolver zero silenciosamente", async () => {
    supabase.setError("dash_gestao_hotmart_sales", "conexão perdida");

    await expect(
      fetchHotmartMetrics(
        { period: PERIOD, filter: expandFilter(filterWith(["111"])) },
        supabase.client
      )
    ).rejects.toThrow("conexão perdida");
  });
});
