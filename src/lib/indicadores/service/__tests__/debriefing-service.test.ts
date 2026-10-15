import { fetchDebriefingMetrics } from "../debriefing";
import { makeFakeSupabase } from "../../__tests__/fake-supabase";

const sale = (over: Record<string, unknown>) => ({
  product_id: "p1",
  status: "APPROVED",
  product_name: "Produto Principal",
  price: 100,
  currency: "BRL",
  purchase_date: "2026-05-10T12:00:00.000Z",
  offer_code: "OFR_1",
  offer_name: "Oferta Padrão",
  ...over,
});

const range = { startDate: "2026-05-09", endDate: "2026-05-11" };

function setup(rows: Array<Record<string, unknown>>) {
  const fake = makeFakeSupabase();
  fake.setRows("dash_gestao_hotmart_sales", rows);
  return fake;
}

describe("fetchDebriefingMetrics (multi-produto)", () => {
  it("aplica a regra de ofertas de cada produto: um filtrado, outro conta tudo", async () => {
    const fake = setup([
      sale({ product_id: "p1", offer_code: "A", price: 10 }),
      sale({ product_id: "p1", offer_code: "B", price: 20 }),
      sale({ product_id: "p2", product_name: "Upsell", offer_code: "X", price: 5 }),
      sale({ product_id: "p2", product_name: "Upsell", offer_code: "Y", price: 7 }),
    ]);

    const res = await fetchDebriefingMetrics(
      { ...range, products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: "p2" }] },
      fake.client
    );

    expect(res.products.map((p) => [p.product_id, p.total_sales, p.total_revenue_brl])).toEqual([
      ["p1", 1, 10],
      ["p2", 2, 12],
    ]);
    expect(res.totals).toEqual({
      total_sales: 3,
      total_sales_brl: 3,
      total_sales_foreign: 0,
      total_revenue_brl: 22,
    });
    expect(res).not.toHaveProperty("available_offers");
  });

  it("produto sem vendas no período aparece com zeros e nome de reserva", async () => {
    const fake = setup([sale({ product_id: "p1" })]);

    const res = await fetchDebriefingMetrics(
      {
        ...range,
        products: [
          { product_id: "p1" },
          { product_id: "p9", product_name: "Sem Vendas", offer_codes: ["Z"] },
          { product_id: "p8" },
        ],
      },
      fake.client
    );

    expect(res.products).toHaveLength(3);
    expect(res.products[1]).toEqual({
      product_id: "p9",
      product_name: "Sem Vendas",
      total_sales: 0,
      total_sales_brl: 0,
      total_sales_foreign: 0,
      total_revenue_brl: 0,
      offers_breakdown: [],
      daily_series: [
        { date: "2026-05-09", sales_count: 0, sales_brl: 0, sales_foreign: 0, revenue: 0 },
        { date: "2026-05-10", sales_count: 0, sales_brl: 0, sales_foreign: 0, revenue: 0 },
        { date: "2026-05-11", sales_count: 0, sales_brl: 0, sales_foreign: 0, revenue: 0 },
      ],
    });
    expect(res.products[2].product_name).toBe("p8");
    expect(res.products[0].product_name).toBe("Produto Principal");
  });

  it("só 'Sem Oferta' marcado conta apenas vendas sem offer_code", async () => {
    const fake = setup([
      sale({ offer_code: null, offer_name: null, price: 3 }),
      sale({ offer_code: "A", price: 50 }),
    ]);

    const res = await fetchDebriefingMetrics(
      { ...range, products: [{ product_id: "p1", offer_codes: ["Sem Oferta"] }] },
      fake.client
    );

    expect(res.products[0].total_sales).toBe(1);
    expect(res.products[0].total_revenue_brl).toBe(3);
    expect(res.products[0].offers_breakdown.map((o) => o.offer_code)).toEqual(["Sem Oferta"]);
  });

  it("série diária consolidada soma os produtos e separa BRL de moeda estrangeira", async () => {
    const fake = setup([
      sale({ product_id: "p1", price: 100 }),
      sale({ product_id: "p2", price: 40 }),
      sale({ product_id: "p2", price: 15, currency: "USD", purchase_date: "2026-05-11T12:00:00.000Z" }),
    ]);

    const res = await fetchDebriefingMetrics(
      { ...range, products: [{ product_id: "p1" }, { product_id: "p2" }] },
      fake.client
    );

    expect(res.daily_series).toEqual([
      { date: "2026-05-09", sales_count: 0, sales_brl: 0, sales_foreign: 0, revenue: 0 },
      { date: "2026-05-10", sales_count: 2, sales_brl: 2, sales_foreign: 0, revenue: 140 },
      { date: "2026-05-11", sales_count: 1, sales_brl: 0, sales_foreign: 1, revenue: 0 },
    ]);
    expect(res.totals).toMatchObject({ total_sales_brl: 2, total_sales_foreign: 1, total_revenue_brl: 140 });
  });

  it("cada produto traz a própria série diária, e a soma delas é a série consolidada", async () => {
    const fake = setup([
      sale({ product_id: "p1", price: 100 }),
      sale({ product_id: "p2", price: 40 }),
      sale({ product_id: "p2", price: 15, currency: "USD", purchase_date: "2026-05-11T12:00:00.000Z" }),
    ]);

    const res = await fetchDebriefingMetrics(
      { ...range, products: [{ product_id: "p1" }, { product_id: "p2" }] },
      fake.client
    );

    expect(res.products[0].daily_series.map((d) => [d.date, d.sales_count, d.revenue])).toEqual([
      ["2026-05-09", 0, 0],
      ["2026-05-10", 1, 100],
      ["2026-05-11", 0, 0],
    ]);
    expect(res.products[1].daily_series.map((d) => [d.date, d.sales_count, d.sales_foreign, d.revenue])).toEqual([
      ["2026-05-09", 0, 0, 0],
      ["2026-05-10", 1, 0, 40],
      ["2026-05-11", 1, 1, 0],
    ]);
  });

  it("busca cada produto em consulta própria, paginando de 1000 em 1000", async () => {
    const many = Array.from({ length: 1001 }, () => sale({ product_id: "p1", price: 1 }));
    const fake = setup(many);

    const res = await fetchDebriefingMetrics(
      { ...range, products: [{ product_id: "p1" }, { product_id: "p2" }] },
      fake.client
    );

    expect(res.products[0].total_sales).toBe(1001);
    const queries = fake.queriesFor("dash_gestao_hotmart_sales");
    expect(queries.filter((q) => q.eq.some(([, v]) => v === "p1")).flatMap((q) => q.range)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(queries.some((q) => q.eq.some(([, v]) => v === "p2"))).toBe(true);
  });

  it("propaga erro do banco", async () => {
    const fake = setup([]);
    fake.setError("dash_gestao_hotmart_sales", "boom");
    await expect(
      fetchDebriefingMetrics({ ...range, products: [{ product_id: "p1" }] }, fake.client)
    ).rejects.toThrow("boom");
  });
});
