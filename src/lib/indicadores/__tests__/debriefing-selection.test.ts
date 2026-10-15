import { selectDebriefingProducts, toggleProductSelection } from "../debriefing-selection";
import type { DebriefingMetrics, DebriefingDailyPoint } from "../service/debriefing";

const pt = (date: string, n: number, revenue: number, foreign = 0): DebriefingDailyPoint => ({
  date,
  sales_count: n + foreign,
  sales_brl: n,
  sales_foreign: foreign,
  revenue,
});

const product = (id: string, series: DebriefingDailyPoint[]) => ({
  product_id: id,
  product_name: `Produto ${id}`,
  total_sales: series.reduce((s, d) => s + d.sales_count, 0),
  total_sales_brl: series.reduce((s, d) => s + d.sales_brl, 0),
  total_sales_foreign: series.reduce((s, d) => s + d.sales_foreign, 0),
  total_revenue_brl: series.reduce((s, d) => s + d.revenue, 0),
  offers_breakdown: [],
  daily_series: series,
});

const A = product("a", [pt("2026-01-01", 1, 10), pt("2026-01-02", 0, 0)]);
const B = product("b", [pt("2026-01-01", 2, 20), pt("2026-01-02", 1, 5, 1)]);
const C = product("c", [pt("2026-01-01", 4, 40), pt("2026-01-02", 0, 0)]);

const METRICS: DebriefingMetrics = {
  totals: { total_sales: 9, total_sales_brl: 8, total_sales_foreign: 1, total_revenue_brl: 75 },
  daily_series: [pt("2026-01-01", 7, 70), pt("2026-01-02", 1, 5, 1)],
  products: [A, B, C],
};

describe("selectDebriefingProducts", () => {
  it("seleção vazia (Todos) devolve as métricas originais", () => {
    expect(selectDebriefingProducts(METRICS, [])).toBe(METRICS);
  });

  it("recalcula totais, série e produtos só com os selecionados", () => {
    const res = selectDebriefingProducts(METRICS, ["a", "b"]);

    expect(res.products.map((p) => p.product_id)).toEqual(["a", "b"]);
    expect(res.totals).toEqual({
      total_sales: 5,
      total_sales_brl: 4,
      total_sales_foreign: 1,
      total_revenue_brl: 35,
    });
    expect(res.daily_series).toEqual([pt("2026-01-01", 3, 30), pt("2026-01-02", 1, 5, 1)]);
  });

  it("ignora ids que não existem nas métricas", () => {
    const res = selectDebriefingProducts(METRICS, ["c", "zzz"]);
    expect(res.products.map((p) => p.product_id)).toEqual(["c"]);
    expect(res.totals.total_sales).toBe(4);
  });
});

describe("toggleProductSelection", () => {
  const all = ["a", "b", "c"];

  it("de 'Todos' (vazio), clicar num chip seleciona só ele", () => {
    expect(toggleProductSelection([], "b", all)).toEqual(["b"]);
  });

  it("liga e desliga o produto", () => {
    expect(toggleProductSelection(["a"], "b", all)).toEqual(["a", "b"]);
    expect(toggleProductSelection(["a", "b"], "a", all)).toEqual(["b"]);
  });

  it("desmarcar o último volta para Todos (vazio)", () => {
    expect(toggleProductSelection(["b"], "b", all)).toEqual([]);
  });

  it("marcar todos os chips equivale a Todos (vazio)", () => {
    expect(toggleProductSelection(["a", "b"], "c", all)).toEqual([]);
  });
});
