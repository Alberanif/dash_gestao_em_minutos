import { fetchLeadsMetricsWeekly } from "../service/leads";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

// Exemplo do PRD: 06/07 (seg) a 22/07 → semanas 06–08/07, 09–15/07, 16–22/07
const PERIOD = { startDate: "2026-07-06", endDate: "2026-07-22" };

function filterWith(eventos: string[]): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: [],
    meta_ads_terms: [],
    captacao_leads_eventos: eventos,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// Contagens por origem em função do período pedido — simula o corte do banco.
const WEEKLY_SOURCES: Record<string, Array<{ source: string; count: number }>> = {
  "2026-07-06": [{ source: "meta", count: 10 }],
  "2026-07-09": [
    { source: "meta", count: 20 },
    { source: "youtube", count: 5 },
  ],
  "2026-07-16": [{ source: "youtube", count: 7 }],
};

function arm(supabase: FakeSupabase) {
  const isAggregate = (args: Record<string, unknown>) =>
    args.p_start_date === PERIOD.startDate && args.p_end_date === PERIOD.endDate;

  supabase.setRpc("dash_gestao_leads_by_source", (args: Record<string, unknown>) => {
    if (isAggregate(args)) {
      // agregado do período inteiro
      return [
        { source: "meta", count: 30 },
        { source: "youtube", count: 12 },
      ];
    }
    return WEEKLY_SOURCES[args.p_start_date as string] ?? [];
  });
  supabase.setRpc("dash_gestao_leads_unique_total", (args: Record<string, unknown>) => {
    if (isAggregate(args)) return 42;
    const weekly = WEEKLY_SOURCES[args.p_start_date as string] ?? [];
    return weekly.reduce((sum, r) => sum + r.count, 0);
  });
  supabase.setRpc("dash_gestao_leads_by_event_unique", [{ evento: "Evento A", count: 42 }]);
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("fetchLeadsMetricsWeekly", () => {
  it("devolve o agregado do período mais leads por origem por semana quinta→quarta", async () => {
    arm(supabase);

    const result = await fetchLeadsMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["Evento A"])) },
      supabase.client
    );

    expect(result.total).toBe(42);
    expect(result.by_source).toEqual([
      { source: "meta", count: 30 },
      { source: "youtube", count: 12 },
    ]);
    expect(result.weeks.map((w) => [w.startDate, w.endDate])).toEqual([
      ["2026-07-06", "2026-07-08"],
      ["2026-07-09", "2026-07-15"],
      ["2026-07-16", "2026-07-22"],
    ]);
  });

  it("consulta as RPCs uma vez por semana com as datas cruas da semana", async () => {
    arm(supabase);

    await fetchLeadsMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["Evento A"])) },
      supabase.client
    );

    const bySourceCalls = supabase.rpcCalls("dash_gestao_leads_by_source").map((c) => c.args);
    expect(bySourceCalls).toContainEqual({
      p_start_date: "2026-07-09",
      p_end_date: "2026-07-15",
      p_eventos: ["Evento A"],
    });
    expect(bySourceCalls).toContainEqual({
      p_start_date: "2026-07-16",
      p_end_date: "2026-07-22",
      p_eventos: ["Evento A"],
    });
  });

  it("origem presente no período mas zerada numa semana aparece com contagem 0 naquela semana", async () => {
    arm(supabase);

    const result = await fetchLeadsMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["Evento A"])) },
      supabase.client
    );

    // youtube não teve leads na semana 1; meta não teve na semana 3
    const week1 = result.weeks[0];
    const week3 = result.weeks[2];
    expect(week1.by_source).toContainEqual({ source: "youtube", count: 0 });
    expect(week3.by_source).toContainEqual({ source: "meta", count: 0 });
  });

  it("a soma das contagens semanais por origem bate com o agregado da origem (RF-4)", async () => {
    arm(supabase);

    const result = await fetchLeadsMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["Evento A"])) },
      supabase.client
    );

    for (const { source, count } of result.by_source) {
      const weeklySum = result.weeks.reduce(
        (sum, week) => sum + (week.by_source.find((s) => s.source === source)?.count ?? 0),
        0
      );
      expect(weeklySum).toBe(count);
    }
  });

  it("o conjunto de origens do agregado é a união das origens semanais", async () => {
    arm(supabase);

    const result = await fetchLeadsMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith(["Evento A"])) },
      supabase.client
    );

    const aggregateSources = new Set(result.by_source.map((s) => s.source));
    for (const week of result.weeks) {
      expect(new Set(week.by_source.map((s) => s.source))).toEqual(aggregateSources);
    }
  });

  it("fonte não configurada devolve zerado com semanas zeradas, sem consultar o banco", async () => {
    const result = await fetchLeadsMetricsWeekly(
      { period: PERIOD, filter: expandFilter(filterWith([])) },
      supabase.client
    );

    expect(result.total).toBe(0);
    expect(result.weeks).toHaveLength(3);
    expect(result.weeks.every((w) => w.total === 0 && w.by_source.length === 0)).toBe(true);
    expect(supabase.rpcCalls()).toHaveLength(0);
  });
});
