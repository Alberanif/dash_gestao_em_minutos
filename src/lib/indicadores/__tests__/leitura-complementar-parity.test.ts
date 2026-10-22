import { expandFromSearchParams } from "../filter-expansion";
import {
  fetchConversionSources,
  fetchConversionSourcesUnscoped,
  fetchConversionSourcesWeekly,
} from "../service/conversion-sources";
import { fetchDebriefingMetrics, type DebriefingQueryProduct } from "../service/debriefing";
import { fetchEventosMetrics } from "../service/eventos-metrics";
import { fetchHotmartMetrics, fetchHotmartMetricsUnscoped, fetchHotmartMetricsWeekly } from "../service/hotmart";
import { fetchLeadsMetrics, fetchLeadsMetricsUnscoped, fetchLeadsMetricsWeekly } from "../service/leads";
import { fetchMetaCampaigns, normalizeSearch } from "../service/meta-campaigns";
import {
  loadConversionSources,
  loadDebriefingMetrics,
  loadEventosMetrics,
  loadHotmartMetrics,
  loadLeadsMetrics,
  loadMetaCampaigns,
  parseDebriefingProducts,
} from "../leitura-complementar";
import type { FilterRecord } from "@/types/indicadores";
import type { SupabaseLike } from "../service/types";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

/**
 * Paridade com o que as rotas hotmart, leads, conversion-sources, campaigns,
 * debriefing e eventos-metrics entregavam antes da extração. As funções
 * `legacy*` são a lógica das rotas copiada literalmente de antes
 * (refactor/indicadores-leitura-principal @ 469494c), executada sobre o mesmo
 * banco falso.
 */

type Client = FakeSupabase["client"];

let supabase: FakeSupabase;

const BASE = "start_date=2026-07-06&end_date=2026-07-22";
const period = { startDate: "2026-07-06", endDate: "2026-07-22" };

beforeEach(() => {
  supabase = makeFakeSupabase();
  supabase.setRows("dash_gestao_hotmart_sales", [
    { product_id: "111", product_name: "Ingresso", price: 100, currency: "BRL", status: "APPROVED", purchase_date: "2026-07-10T12:00:00.000Z", offer_code: "abc" },
    { product_id: "111", product_name: "Ingresso", price: 100, currency: "BRL", status: "APPROVED", purchase_date: "2026-07-15T12:00:00.000Z", offer_code: "abc" },
    { product_id: "222", product_name: "Mentoria", price: 500, currency: "BRL", status: "APPROVED", purchase_date: "2026-07-20T12:00:00.000Z", offer_code: "xyz" },
  ]);
  supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
    { date: "2026-07-10", spend: 200, impressions: 2000, link_clicks: 100, leads_all: 20, page_views: 80, checkout: 4, campaign_id: "c1", campaign_name: "PC black" },
    { date: "2026-07-12", spend: 50, impressions: 500, link_clicks: 20, leads_all: 5, page_views: 10, checkout: 1, campaign_id: "c2", campaign_name: "Outra" },
  ]);
  supabase.setRpc("dash_gestao_leads_unique_total", 42);
  supabase.setRpc("dash_gestao_leads_by_source", [{ source: "instagram", count: 30 }]);
  supabase.setRpc("dash_gestao_leads_by_event_unique", [{ evento: "Evento A", count: 42 }]);
  supabase.setRpc("get_conversion_sources", [{ source: "instagram", count: 12 }]);
});

async function legacyHotmart(sp: URLSearchParams, client: Client) {
  const filter = expandFromSearchParams(sp);
  const query = { period, filter };
  if (sp.get("breakdown") === "weekly") return fetchHotmartMetricsWeekly(query, client);
  return filter.sources.hotmart ? fetchHotmartMetrics(query, client) : fetchHotmartMetricsUnscoped(query, client);
}

async function legacyLeads(sp: URLSearchParams, client: Client) {
  const filter = expandFromSearchParams(sp);
  const query = { period, filter };
  if (sp.get("breakdown") === "weekly") return fetchLeadsMetricsWeekly(query, client);
  return filter.sources.leads ? fetchLeadsMetrics(query, client) : fetchLeadsMetricsUnscoped(query, client);
}

async function legacyConversionSources(sp: URLSearchParams, client: Client) {
  const filter = expandFromSearchParams(sp);
  const query = { period, filter };
  if (sp.get("breakdown") === "weekly") return fetchConversionSourcesWeekly(query, client);
  return filter.sources.hotmart
    ? fetchConversionSources(query, client)
    : fetchConversionSourcesUnscoped(query, client);
}

async function legacyCampaigns(sp: URLSearchParams, client: SupabaseLike) {
  const search = normalizeSearch(sp.get("q"));
  const filter = expandFromSearchParams(sp);
  return fetchMetaCampaigns({ period, filter }, client, search);
}

/** O parser que vivia dentro da rota debriefing, copiado literalmente. */
function legacyParseProducts(
  raw: string | null
): { ok: true; value: DebriefingQueryProduct[] } | { ok: false; error: string } {
  if (!raw) return { ok: false, error: "products is required" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "products must be valid JSON" };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "products must be an array" };
  if (parsed.length === 0) return { ok: false, error: "products must not be empty" };

  const value: DebriefingQueryProduct[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object" || typeof item.product_id !== "string" || item.product_id.trim() === "") {
      return { ok: false, error: `products[${i}].product_id is required` };
    }
    const offerCodes = Array.isArray(item.offer_codes)
      ? item.offer_codes.filter((c): c is string => typeof c === "string")
      : [];
    value.push({
      product_id: item.product_id,
      product_name: typeof item.product_name === "string" ? item.product_name : undefined,
      offer_codes: offerCodes,
    });
  }
  return { ok: true, value };
}

const SCOPED = [
  `${BASE}&product_ids[]=111&eventos[]=Evento%20A&meta_terms[]=PC`,
  BASE,
  `${BASE}&product_ids[]=111&eventos[]=Evento%20A&meta_terms[]=PC&breakdown=weekly`,
  `${BASE}&breakdown=weekly`,
  `${BASE}&product_ids[]=111&breakdown=outro`,
];

describe("loadHotmartMetrics — paridade com a rota hotmart", () => {
  it.each(SCOPED)("idêntico ao de antes para ?%s", async (query) => {
    const sp = new URLSearchParams(query);
    expect(await loadHotmartMetrics(sp, period, supabase.client)).toEqual(await legacyHotmart(sp, supabase.client));
  });

  it("com filtro de produto usa o caminho escopado; sem filtro, o sem escopo", async () => {
    const com = new URLSearchParams(`${BASE}&product_ids[]=111`);
    const sem = new URLSearchParams(BASE);

    expect(await loadHotmartMetrics(com, period, supabase.client)).toEqual(
      await fetchHotmartMetrics({ period, filter: expandFromSearchParams(com) }, supabase.client)
    );
    expect(await loadHotmartMetrics(sem, period, supabase.client)).toEqual(
      await fetchHotmartMetricsUnscoped({ period, filter: expandFromSearchParams(sem) }, supabase.client)
    );
  });

  it("breakdown=weekly devolve a visão semanal, diferente do agregado simples", async () => {
    const semanal = await loadHotmartMetrics(
      new URLSearchParams(`${BASE}&product_ids[]=111&breakdown=weekly`),
      period,
      supabase.client
    );
    const simples = await loadHotmartMetrics(
      new URLSearchParams(`${BASE}&product_ids[]=111`),
      period,
      supabase.client
    );
    expect(semanal).not.toEqual(simples);
  });
});

describe("loadLeadsMetrics — paridade com a rota leads", () => {
  it.each(SCOPED)("idêntico ao de antes para ?%s", async (query) => {
    const sp = new URLSearchParams(query);
    expect(await loadLeadsMetrics(sp, period, supabase.client)).toEqual(await legacyLeads(sp, supabase.client));
  });

  it("com evento usa o caminho escopado; sem evento, o sem escopo", async () => {
    const com = new URLSearchParams(`${BASE}&eventos[]=Evento%20A`);
    const sem = new URLSearchParams(BASE);

    expect(await loadLeadsMetrics(com, period, supabase.client)).toEqual(
      await fetchLeadsMetrics({ period, filter: expandFromSearchParams(com) }, supabase.client)
    );
    expect(await loadLeadsMetrics(sem, period, supabase.client)).toEqual(
      await fetchLeadsMetricsUnscoped({ period, filter: expandFromSearchParams(sem) }, supabase.client)
    );
  });

  it("breakdown=weekly devolve a visão semanal, diferente do agregado simples", async () => {
    const semanal = await loadLeadsMetrics(
      new URLSearchParams(`${BASE}&eventos[]=Evento%20A&breakdown=weekly`),
      period,
      supabase.client
    );
    const simples = await loadLeadsMetrics(
      new URLSearchParams(`${BASE}&eventos[]=Evento%20A`),
      period,
      supabase.client
    );
    expect(semanal).not.toEqual(simples);
  });
});

describe("loadConversionSources — paridade com a rota conversion-sources", () => {
  it.each(SCOPED)("idêntico ao de antes para ?%s", async (query) => {
    const sp = new URLSearchParams(query);
    expect(await loadConversionSources(sp, period, supabase.client)).toEqual(
      await legacyConversionSources(sp, supabase.client)
    );
  });

  it("sem breakdown devolve o array de sempre; com breakdown=weekly, um objeto { sources, weeks }", async () => {
    const simples = await loadConversionSources(
      new URLSearchParams(`${BASE}&product_ids[]=111`),
      period,
      supabase.client
    );
    const semanal = await loadConversionSources(
      new URLSearchParams(`${BASE}&product_ids[]=111&breakdown=weekly`),
      period,
      supabase.client
    );

    expect(simples).toEqual([{ source: "instagram", count: 12 }]);
    expect(Array.isArray(semanal)).toBe(false);
    expect(semanal).toEqual(expect.objectContaining({ sources: expect.anything(), weeks: expect.anything() }));
  });
});

/**
 * O fake compartilhado não tem `ilike` (a busca por nome de campanha). Este
 * cliente mínimo aplica o padrão `%termo%` sobre `campaign_name` e ignora o
 * `.or()` dos termos do filtro (todas as linhas semeadas casam).
 */
function makeCampaignsClient(rows: Array<Record<string, unknown>>) {
  const ilikes: string[] = [];
  const client = {
    from: () => {
      let found = rows;
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.gte = () => builder;
      builder.lte = () => builder;
      builder.or = () => builder;
      builder.ilike = (_col: string, pattern: string) => {
        ilikes.push(pattern);
        const needle = pattern.replace(/^%|%$/g, "").toLowerCase();
        found = found.filter((r) => String(r.campaign_name).toLowerCase().includes(needle));
        return builder;
      };
      builder.range = () => Promise.resolve({ data: found, error: null });
      return builder;
    },
  };
  return { client, ilikes };
}

const CAMPAIGN_ROWS = [
  { campaign_id: "c1", campaign_name: "PC black", date: "2026-07-10", spend: 200, impressions: 2000, link_clicks: 100, leads_all: 20, page_views: 80, checkout: 4 },
  { campaign_id: "c2", campaign_name: "Outra", date: "2026-07-12", spend: 50, impressions: 500, link_clicks: 20, leads_all: 5, page_views: 10, checkout: 1 },
];

describe("loadMetaCampaigns — paridade com a rota campaigns", () => {
  it.each([
    `${BASE}&meta_terms[]=PC`,
    `${BASE}&meta_terms[]=PC&q=%20black%20`,
    `${BASE}&meta_terms[]=PC&q=outra`,
    `${BASE}&meta_terms[]=PC&q=100%25_`,
    BASE,
  ])("idêntico ao de antes para ?%s", async (query) => {
    const sp = new URLSearchParams(query);
    const { client } = makeCampaignsClient(CAMPAIGN_ROWS);
    expect(await loadMetaCampaigns(sp, period, client)).toEqual(await legacyCampaigns(sp, client));
  });

  it("o termo de busca chega ao serviço normalizado e restringe as campanhas", async () => {
    const { client, ilikes } = makeCampaignsClient(CAMPAIGN_ROWS);

    const todas = await loadMetaCampaigns(new URLSearchParams(`${BASE}&meta_terms[]=PC`), period, client);
    const busca = await loadMetaCampaigns(
      new URLSearchParams(`${BASE}&meta_terms[]=PC&q=%20black%20`),
      period,
      client
    );

    expect(todas.campaigns).toHaveLength(2);
    expect(busca.campaigns).toHaveLength(1);
    expect(ilikes).toEqual(["%black%"]);
  });

  it("sem meta_terms não consulta o banco e devolve a resposta vazia", async () => {
    const { client } = makeCampaignsClient(CAMPAIGN_ROWS);
    const r = await loadMetaCampaigns(new URLSearchParams(BASE), period, client);
    expect(r.campaigns).toEqual([]);
    expect(r.hidden_zero_spend).toBe(0);
  });
});

describe("parseDebriefingProducts — paridade com o parser da rota debriefing", () => {
  const ENTRADAS: Array<string | null> = [
    null,
    "",
    "{não é json",
    '{"a":1}',
    "[]",
    "[null]",
    '[{"product_id":""}]',
    '[{"product_id":"  "}]',
    '[{"product_id":123}]',
    '[{"product_id":"111"}]',
    '[{"product_id":"111","offer_codes":["abc",7,"def"],"product_name":"Ingresso"}]',
    '[{"product_id":"111","product_name":5},{"product_id":"222","offer_codes":"abc"}]',
    '[{"product_id":"111"},{"x":1}]',
  ];

  it.each(ENTRADAS)("mesma resposta de antes para %j", (raw) => {
    expect(parseDebriefingProducts(raw)).toEqual(legacyParseProducts(raw));
  });

  it("filtra offer_codes que não são texto e aponta o índice do produto inválido", () => {
    expect(parseDebriefingProducts('[{"product_id":"111","offer_codes":["abc",7]}]')).toEqual({
      ok: true,
      value: [{ product_id: "111", product_name: undefined, offer_codes: ["abc"] }],
    });
    expect(parseDebriefingProducts('[{"product_id":"111"},{"x":1}]')).toEqual({
      ok: false,
      error: "products[1].product_id is required",
    });
  });
});

describe("loadDebriefingMetrics — paridade com a rota debriefing", () => {
  it("idêntico ao de antes e reflete as vendas dos produtos pedidos", async () => {
    const products = [{ product_id: "111", offer_codes: [] as string[] }];

    const novo = await loadDebriefingMetrics(period, products, supabase.client);
    const antigo = await fetchDebriefingMetrics(
      { startDate: period.startDate, endDate: period.endDate, products },
      supabase.client
    );

    expect(novo).toEqual(antigo);
  });

  it("repassa início e fim sem trocá-los: período sem vendas difere do período com vendas", async () => {
    const products = [{ product_id: "222", offer_codes: [] as string[] }];
    const comVendas = await loadDebriefingMetrics({ startDate: "2026-07-20", endDate: "2026-07-22" }, products, supabase.client);
    const semVendas = await loadDebriefingMetrics({ startDate: "2026-07-01", endDate: "2026-07-05" }, products, supabase.client);

    expect(comVendas).toEqual(
      await fetchDebriefingMetrics({ startDate: "2026-07-20", endDate: "2026-07-22", products }, supabase.client)
    );
    expect(comVendas).not.toEqual(semVendas);
  });
});

function filterRow(id: string, name: string): FilterRecord {
  return {
    id,
    account_id: "acc-1",
    name,
    hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
    meta_ads_terms: ["PC"],
    captacao_leads_eventos: ["Evento A"],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as FilterRecord;
}

/** Lógica da rota eventos-metrics, copiada literalmente (sem a validação de auth/account_id). */
async function legacyEventosMetrics(accountId: string, userClient: SupabaseLike, serviceClient: SupabaseLike) {
  const { data: filters, error: dbError } = await userClient
    .from("dash_gestao_filters")
    .select("*")
    .eq("account_id", accountId)
    .order("name", { ascending: true });
  if (dbError) return { error: dbError.message };
  return { data: await fetchEventosMetrics((filters ?? []) as FilterRecord[], serviceClient) };
}

/** Cliente da sessão com a cadeia `from().select().eq().order()` e registro dos `eq`. */
function makeFiltersClient(result: { data: unknown; error: { message: string } | null }) {
  const eqs: Array<[string, unknown]> = [];
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (col: string, value: unknown) => {
    eqs.push([col, value]);
    return chain;
  };
  chain.order = () => Promise.resolve(result);
  return { client: { from: () => chain }, eqs };
}

describe("loadEventosMetrics — paridade com a rota eventos-metrics", () => {
  it("idêntico ao de antes quando há filtros na conta", async () => {
    const rows = [filterRow("f-1", "A"), filterRow("f-2", "B")];
    const user = makeFiltersClient({ data: rows, error: null });

    const novo = await loadEventosMetrics("acc-1", user.client, supabase.client);
    const antigo = await legacyEventosMetrics("acc-1", user.client, supabase.client);

    expect(novo).toEqual(antigo);
    expect(Object.keys(novo.data ?? {}).sort()).toEqual(["f-1", "f-2"]);
  });

  it("sem filtros (ou com data nula) devolve mapa vazio", async () => {
    for (const data of [[], null]) {
      const user = makeFiltersClient({ data, error: null });
      const novo = await loadEventosMetrics("acc-1", user.client, supabase.client);
      expect(novo).toEqual(await legacyEventosMetrics("acc-1", user.client, supabase.client));
      expect(novo).toEqual({ data: {} });
    }
  });

  it("erro ao listar filtros volta como { error } com a mesma mensagem, sem consultar métricas", async () => {
    const user = makeFiltersClient({ data: null, error: { message: "falhou" } });
    const servico = makeFakeSupabase();

    const novo = await loadEventosMetrics("acc-1", user.client, servico.client);

    expect(novo).toEqual({ error: "falhou" });
    expect(novo).toEqual(await legacyEventosMetrics("acc-1", user.client, servico.client));
    expect(servico.queriesFor("dash_gestao_meta_ads_campaigns_daily")).toHaveLength(0);
  });

  it("lê os filtros da conta pedida", async () => {
    const user = makeFiltersClient({ data: [], error: null });
    await loadEventosMetrics("acc-9", user.client, supabase.client);
    expect(user.eqs).toContainEqual(["account_id", "acc-9"]);
  });
});
