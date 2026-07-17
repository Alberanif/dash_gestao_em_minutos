import { fetchHotmartMetricsWeekly } from "../service/hotmart";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

// Exemplo do PRD: 06/07 (seg) a 22/07 → semanas 06–08/07, 09–15/07, 16–22/07
const PERIOD = { startDate: "2026-07-06", endDate: "2026-07-22" };

function filterWithProducts(products: Array<{ product_id: string; product_name: string }>): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: products,
    meta_ads_terms: [],
    captacao_leads_eventos: [],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const INGRESSO = [{ product_id: "111", product_name: "Ingresso" }];

function brlSale(purchaseDateUtc: string, price: number) {
  return {
    product_id: "111",
    product_name: "Ingresso",
    price,
    currency: "BRL",
    status: "APPROVED",
    purchase_date: purchaseDateUtc,
  };
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("fetchHotmartMetricsWeekly", () => {
  it("devolve o agregado do período mais vendas e receita por semana quinta→quarta", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [
      brlSale("2026-07-06T15:00:00.000Z", 100), // 06/07 BRT → semana 1
      brlSale("2026-07-10T15:00:00.000Z", 200), // 10/07 BRT → semana 2
      brlSale("2026-07-20T15:00:00.000Z", 300), // 20/07 BRT → semana 3
    ]);

    const result = await fetchHotmartMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(INGRESSO)) },
      supabase.client
    );

    expect(result.total_sales).toBe(3);
    expect(result.total_revenue).toBe(600);
    expect(result.weeks.map((w) => [w.startDate, w.endDate])).toEqual([
      ["2026-07-06", "2026-07-08"],
      ["2026-07-09", "2026-07-15"],
      ["2026-07-16", "2026-07-22"],
    ]);
    expect(result.weeks.map((w) => w.total_sales)).toEqual([1, 1, 1]);
    expect(result.weeks.map((w) => w.total_revenue)).toEqual([100, 200, 300]);
  });

  it("aloca a venda na semana da data BRT, não da data UTC", async () => {
    // 09/07 01:00 UTC ainda é 08/07 22:00 em BRT → pertence à semana 1
    supabase.setRows("dash_gestao_hotmart_sales", [
      brlSale("2026-07-09T01:00:00.000Z", 150),
    ]);

    const result = await fetchHotmartMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(INGRESSO)) },
      supabase.client
    );

    expect(result.weeks[0].total_sales).toBe(1);
    expect(result.weeks[1].total_sales).toBe(0);
  });

  it("a soma das semanas bate com o agregado, incluindo moeda estrangeira (RF-4)", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [
      brlSale("2026-07-07T12:00:00.000Z", 100),
      brlSale("2026-07-12T12:00:00.000Z", 250.5),
      {
        product_id: "111",
        product_name: "Ingresso",
        price: 50,
        currency: "USD",
        status: "COMPLETE",
        purchase_date: "2026-07-17T12:00:00.000Z",
      },
    ]);

    const result = await fetchHotmartMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(INGRESSO)) },
      supabase.client
    );

    const sum = (pick: (w: (typeof result.weeks)[number]) => number) =>
      result.weeks.reduce((total, w) => total + pick(w), 0);

    expect(sum((w) => w.total_sales)).toBe(result.total_sales);
    expect(sum((w) => w.total_sales_brl)).toBe(result.total_sales_brl);
    expect(sum((w) => w.total_sales_foreign)).toBe(result.total_sales_foreign);
    expect(sum((w) => w.total_revenue)).toBeCloseTo(result.total_revenue);
    // a venda estrangeira conta em vendas, não em receita BRL
    expect(result.weeks[2].total_sales_foreign).toBe(1);
    expect(result.weeks[2].total_revenue).toBe(0);
  });

  it("semana sem vendas vem zerada", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [
      brlSale("2026-07-06T12:00:00.000Z", 100),
    ]);

    const result = await fetchHotmartMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(INGRESSO)) },
      supabase.client
    );

    expect(result.weeks[1]).toMatchObject({
      total_sales: 0,
      total_sales_brl: 0,
      total_sales_foreign: 0,
      total_revenue: 0,
    });
  });

  it("fonte não configurada devolve zerado com semanas zeradas, sem consultar o banco", async () => {
    const result = await fetchHotmartMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts([])) },
      supabase.client
    );

    expect(result.total_sales).toBe(0);
    expect(result.weeks).toHaveLength(3);
    expect(result.weeks.every((w) => w.total_sales === 0 && w.total_revenue === 0)).toBe(true);
    expect(supabase.queriesFor("dash_gestao_hotmart_sales")).toHaveLength(0);
  });

  it("mantém o escopo do filtro: produtos, status aprovado e período em UTC", async () => {
    await fetchHotmartMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(INGRESSO)) },
      supabase.client
    );

    const q = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(q.in).toContainEqual(["product_id", ["111"]]);
    expect(q.in).toContainEqual(["status", ["COMPLETE", "APPROVED"]]);
    expect(q.gte).toContainEqual(["purchase_date", "2026-07-06T03:00:00.000Z"]);
    expect(q.lte).toContainEqual(["purchase_date", "2026-07-23T02:59:59.000Z"]);
  });
});
