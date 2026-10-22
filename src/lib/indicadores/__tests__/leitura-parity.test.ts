import { expandFromSearchParams } from "../filter-expansion";
import { fetchDailySeries } from "../service/daily";
import {
  fetchMetaMetrics,
  fetchMetaMetricsUnscoped,
  fetchMetaMetricsWeekly,
} from "../service/meta";
import { createFilter, listFilters, loadDailySeries, loadMetaMetrics, readPeriod } from "../leitura";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

/**
 * Paridade com o que as rotas entregavam antes da extração. As funções
 * `legacy*` são a lógica das rotas `daily`, `metrics` e `filters` copiada
 * literalmente de antes (main @ 93f7d35), executada sobre o mesmo banco falso.
 */

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
  supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
    { date: "2026-07-06", spend: 100, impressions: 1000, link_clicks: 50, leads_all: 10, page_views: 40, checkout: 2 },
    { date: "2026-07-10", spend: 200, impressions: 2000, link_clicks: 100, leads_all: 20, page_views: 80, checkout: 4 },
    { date: "2026-07-22", spend: 300, impressions: 3000, link_clicks: 150, leads_all: 30, page_views: 120, checkout: 6 },
  ]);
});

async function legacyDaily(searchParams: URLSearchParams, client: FakeSupabase["client"]) {
  const startDate = searchParams.get("start_date")!;
  const endDate = searchParams.get("end_date")!;
  const filter = expandFromSearchParams(searchParams);
  return fetchDailySeries({ period: { startDate, endDate }, filter }, client);
}

async function legacyMetrics(searchParams: URLSearchParams, client: FakeSupabase["client"]) {
  const startDate = searchParams.get("start_date")!;
  const endDate = searchParams.get("end_date")!;
  const filter = expandFromSearchParams(searchParams);
  const query = { period: { startDate, endDate }, filter };
  if (searchParams.get("breakdown") === "weekly") {
    return fetchMetaMetricsWeekly(query, client);
  }
  return filter.sources.meta ? fetchMetaMetrics(query, client) : fetchMetaMetricsUnscoped(query, client);
}

const QUERIES = [
  "start_date=2026-07-06&end_date=2026-07-22&meta_terms[]=PC",
  "start_date=2026-07-06&end_date=2026-07-22",
  "start_date=2026-07-06&end_date=2026-07-22&meta_terms[]=PC&breakdown=weekly",
  "start_date=2026-07-06&end_date=2026-07-22&breakdown=weekly",
  "start_date=2026-07-06&end_date=2026-07-22&meta_terms[]=PC&breakdown=outro",
];

describe("readPeriod", () => {
  it("devolve null quando falta start_date ou end_date", () => {
    expect(readPeriod(new URLSearchParams("start_date=2026-07-06"))).toBeNull();
    expect(readPeriod(new URLSearchParams("end_date=2026-07-06"))).toBeNull();
    expect(readPeriod(new URLSearchParams(""))).toBeNull();
  });

  it("devolve o período quando as duas datas existem", () => {
    expect(readPeriod(new URLSearchParams("start_date=2026-07-06&end_date=2026-07-22"))).toEqual({
      startDate: "2026-07-06",
      endDate: "2026-07-22",
    });
  });
});

describe("loadDailySeries — paridade com a rota daily", () => {
  it.each(QUERIES)("série idêntica à de antes para ?%s", async (query) => {
    const sp = new URLSearchParams(query);
    const period = readPeriod(sp)!;

    const novo = await loadDailySeries(sp, period, supabase.client);
    const antigo = await legacyDaily(sp, supabase.client);

    expect(novo).toEqual(antigo);
    expect(novo.length).toBeGreaterThan(0);
  });

  it("a série reflete os gastos do banco (guarda contra comparar vazio com vazio)", async () => {
    const sp = new URLSearchParams("start_date=2026-07-06&end_date=2026-07-22&meta_terms[]=PC");
    const novo = await loadDailySeries(sp, readPeriod(sp)!, supabase.client);

    expect(novo.find((p) => p.date === "2026-07-10")?.meta_spend).toBe(200);
  });
});

describe("loadMetaMetrics — paridade com a rota metrics", () => {
  it.each(QUERIES)("métricas idênticas às de antes para ?%s", async (query) => {
    const sp = new URLSearchParams(query);
    const period = readPeriod(sp)!;

    const novo = await loadMetaMetrics(sp, period, supabase.client);
    const antigo = await legacyMetrics(sp, supabase.client);

    expect(novo).toEqual(antigo);
  });

  it("com filtro de Meta, soma o gasto do período; sem filtro, usa o caminho sem escopo", async () => {
    const comFiltro = new URLSearchParams("start_date=2026-07-06&end_date=2026-07-22&meta_terms[]=PC");
    const semFiltro = new URLSearchParams("start_date=2026-07-06&end_date=2026-07-22");

    const a = await loadMetaMetrics(comFiltro, readPeriod(comFiltro)!, supabase.client);
    const b = await loadMetaMetrics(semFiltro, readPeriod(semFiltro)!, supabase.client);

    expect(a).toEqual(await fetchMetaMetrics({ period: readPeriod(comFiltro)!, filter: expandFromSearchParams(comFiltro) }, supabase.client));
    expect(b).toEqual(await fetchMetaMetricsUnscoped({ period: readPeriod(semFiltro)!, filter: expandFromSearchParams(semFiltro) }, supabase.client));
  });

  it("breakdown=weekly devolve a visão semanal, diferente do agregado simples", async () => {
    const sp = new URLSearchParams("start_date=2026-07-06&end_date=2026-07-22&meta_terms[]=PC&breakdown=weekly");
    const semanal = await loadMetaMetrics(sp, readPeriod(sp)!, supabase.client);
    const plain = new URLSearchParams("start_date=2026-07-06&end_date=2026-07-22&meta_terms[]=PC");
    const simples = await loadMetaMetrics(plain, readPeriod(plain)!, supabase.client);

    expect(semanal).not.toEqual(simples);
  });
});

/** Cliente com a cadeia `from().select().eq().order()` / `insert().select().single()` e registro das chamadas. */
function makeFiltersClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: Array<[string, unknown[]]> = [];
  const rec = (name: string, ret: unknown) =>
    jest.fn((...args: unknown[]) => {
      calls.push([name, args]);
      return ret;
    });
  const terminal = Promise.resolve(result);
  const chain: Record<string, unknown> = {};
  chain.order = rec("order", terminal);
  chain.eq = rec("eq", chain);
  chain.single = rec("single", terminal);
  chain.select = rec("select", chain);
  chain.insert = rec("insert", chain);
  const client = { from: rec("from", chain) };
  return { client, calls };
}

async function legacyListFilters(accountId: string, client: { from: (t: string) => any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await client
    .from("dash_gestao_filters")
    .select("*")
    .eq("account_id", accountId)
    .order("name", { ascending: true });
  return error ? { status: 500, body: { error: error.message } } : { status: 200, body: data };
}

describe("listFilters — paridade com GET /filters", () => {
  it("mesma consulta e mesma lista, ordenada por nome", async () => {
    const rows = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
    const novo = makeFiltersClient({ data: rows, error: null });
    const antigo = makeFiltersClient({ data: rows, error: null });

    const res = await listFilters("acc-1", novo.client);
    const ref = await legacyListFilters("acc-1", antigo.client);

    expect(novo.calls).toEqual(antigo.calls);
    expect(novo.calls).toContainEqual(["order", ["name", { ascending: true }]]);
    expect(res).toEqual({ data: ref.body });
  });

  it("erro de banco vira { error } com a mesma mensagem que a rota devolvia no 500", async () => {
    const { client } = makeFiltersClient({ data: null, error: { message: "boom" } });

    expect(await listFilters("acc-1", client)).toEqual({ error: "boom" });
  });
});

describe("createFilter — paridade com POST /filters", () => {
  const base = {
    account_id: "acc-1",
    name: "Evento X",
    hotmart_products: [{ product_id: "1", name: "P" }],
    main_hotmart_product: null,
    debriefing_offer_codes: null,
    meta_ads_terms: ["PC"],
    captacao_leads_eventos: [],
  };

  it("sem debriefing_products, a coluna fica fora do insert", async () => {
    const { client, calls } = makeFiltersClient({ data: { id: "n" }, error: null });

    const res = await createFilter({ ...base, debriefing_products: undefined }, client);

    expect(res).toEqual({ data: { id: "n" } });
    const insert = calls.find(([n]) => n === "insert")![1][0] as Record<string, unknown>;
    expect("debriefing_products" in insert).toBe(false);
    expect(insert).toEqual({ ...base, status: "ativo" });
  });

  it("com debriefing_products (inclusive null), a coluna entra no insert", async () => {
    const { client, calls } = makeFiltersClient({ data: { id: "n" }, error: null });

    await createFilter({ ...base, debriefing_products: null }, client);

    const insert = calls.find(([n]) => n === "insert")![1][0] as Record<string, unknown>;
    expect(insert).toEqual({ ...base, debriefing_products: null, status: "ativo" });
  });

  it("erro de banco vira { error } com a mensagem do banco", async () => {
    const { client } = makeFiltersClient({ data: null, error: { message: "duplicado" } });

    expect(await createFilter({ ...base, debriefing_products: undefined }, client)).toEqual({ error: "duplicado" });
  });
});
