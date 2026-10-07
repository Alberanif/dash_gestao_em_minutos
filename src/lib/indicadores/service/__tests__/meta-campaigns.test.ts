import { fetchMetaCampaigns, MAX_SEARCH_LENGTH } from "../meta-campaigns";
import { fetchMetaMetrics } from "../meta";

type Row = Record<string, unknown>;

function day(id: string, name: string, date: string, spend: number, extra: Row = {}): Row {
  return {
    campaign_id: id,
    campaign_name: name,
    date,
    spend,
    impressions: 1000,
    link_clicks: 100,
    leads_all: 10,
    page_views: 50,
    checkout: 1,
    ...extra,
  };
}

function fakeSupabase(rows: Row[]) {
  const calls: {
    from: string[]; select: string[]; or: string[]; ilike: string[][]; ranges: number[][];
  } = { from: [], select: [], or: [], ilike: [], ranges: [] };
  const q: Record<string, unknown> = {};
  q.select = (c: string) => { calls.select.push(c); return q; };
  q.gte = () => q;
  q.lte = () => q;
  q.or = (e: string) => { calls.or.push(e); return q; };
  q.ilike = (c: string, p: string) => { calls.ilike.push([c, p]); return q; };
  q.range = async (a: number, b: number) => {
    calls.ranges.push([a, b]);
    return { data: rows.slice(a, b + 1), error: null };
  };
  return { client: { from: (t: string) => { calls.from.push(t); return q; } }, calls };
}

const period = { startDate: "2026-05-01", endDate: "2026-05-31" };
const filter = (meta = true) =>
  ({ sources: { meta }, metaTerms: ["evento"] }) as never;

describe("fetchMetaCampaigns", () => {
  it("agrupa por campaign_id, usa o nome mais recente e ordena por gasto desc", async () => {
    const { client } = fakeSupabase([
      day("a", "Antigo", "2026-05-01", 10),
      day("b", "B", "2026-05-02", 50),
      day("a", "Novo", "2026-05-03", 20),
    ]);
    const res = await fetchMetaCampaigns({ period, filter: filter() }, client);
    expect(res.campaigns.map((c) => [c.campaign_id, c.campaign_name, c.meta_spend])).toEqual([
      ["b", "B", 50],
      ["a", "Novo", 30],
    ]);
    expect(res.campaigns[1].meta_impressions).toBe(2000);
    expect(res.campaigns[1].meta_cpm).toBe(15);
  });

  it("oculta gasto zero, conta ocultas e mantém o total sobre todas as linhas", async () => {
    const rows = [day("a", "A", "2026-05-01", 10), day("z", "Z", "2026-05-01", 0)];
    const { client } = fakeSupabase(rows);
    const res = await fetchMetaCampaigns({ period, filter: filter() }, client);
    expect(res.campaigns.map((c) => c.campaign_id)).toEqual(["a"]);
    expect(res.hidden_zero_spend).toBe(1);
    expect(res.total.meta_impressions).toBe(2000);
    const { client: c2 } = fakeSupabase(rows);
    expect(res.total).toEqual(await fetchMetaMetrics({ period, filter: filter() }, c2));
  });

  it("não trunca períodos com mais de 1000 linhas", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) =>
      day(`c${i % 5}`, "X", "2026-05-01", 1)
    );
    const { client, calls } = fakeSupabase(rows);
    const res = await fetchMetaCampaigns({ period, filter: filter() }, client);
    expect(res.total.meta_spend).toBe(2500);
    expect(calls.ranges.length).toBe(3);
  });

  it("consulta por ilike nos termos e seleciona campaign_id/campaign_name", async () => {
    const { client, calls } = fakeSupabase([]);
    await fetchMetaCampaigns({ period, filter: filter() }, client);
    expect(calls.or[0]).toBe("campaign_name.ilike.%evento%");
    expect(calls.select[0]).toContain("campaign_id");
    expect(calls.select[0]).toContain("campaign_name");
  });

  it("busca: aplica ilike literal em AND com o filtro (.or), com trim", async () => {
    const { client, calls } = fakeSupabase([]);
    await fetchMetaCampaigns({ period, filter: filter() }, client, "  Black LP ");
    expect(calls.ilike).toEqual([["campaign_name", "%Black LP%"]]);
    expect(calls.or[0]).toBe("campaign_name.ilike.%evento%");
  });

  it("busca: vazio, só espaços ou ausente não aplica ilike", async () => {
    const { client, calls } = fakeSupabase([]);
    await fetchMetaCampaigns({ period, filter: filter() }, client, "   ");
    await fetchMetaCampaigns({ period, filter: filter() }, client);
    expect(calls.ilike).toEqual([]);
  });

  it("busca: escapa %, _ e barra invertida; vírgula e parênteses passam intactos", async () => {
    const { client, calls } = fakeSupabase([]);
    await fetchMetaCampaigns({ period, filter: filter() }, client, "100%_a\\b,(x)");
    expect(calls.ilike[0][1]).toBe("%100\\%\\_a\\\\b,(x)%");
  });

  it("busca: limita o termo a MAX_SEARCH_LENGTH caracteres", async () => {
    const { client, calls } = fakeSupabase([]);
    await fetchMetaCampaigns(
      { period, filter: filter() }, client, "a".repeat(MAX_SEARCH_LENGTH + 50)
    );
    expect(calls.ilike[0][1]).toBe(`%${"a".repeat(MAX_SEARCH_LENGTH)}%`);
  });

  it("busca: linhas, ocultas e Total refletem só o subconjunto devolvido", async () => {
    const { client } = fakeSupabase([
      day("a", "Black A", "2026-05-01", 10),
      day("z", "Black Z", "2026-05-01", 0),
    ]);
    const res = await fetchMetaCampaigns({ period, filter: filter() }, client, "black");
    expect(res.campaigns.map((c) => c.campaign_id)).toEqual(["a"]);
    expect(res.hidden_zero_spend).toBe(1);
    expect(res.total.meta_spend).toBe(10);
    expect(res.total.meta_cpm).toBe(5);
  });

  it("sem fonte meta devolve vazio e zerado sem consultar", async () => {
    const { client, calls } = fakeSupabase([day("a", "A", "2026-05-01", 10)]);
    const res = await fetchMetaCampaigns({ period, filter: filter(false) }, client);
    expect(res.campaigns).toEqual([]);
    expect(res.hidden_zero_spend).toBe(0);
    expect(res.total.meta_spend).toBe(0);
    expect(calls.from).toEqual([]);
  });
});
