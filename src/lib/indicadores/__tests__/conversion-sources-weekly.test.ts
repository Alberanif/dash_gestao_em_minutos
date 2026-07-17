import { fetchConversionSourcesWeekly } from "../service/conversion-sources";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { brtToUtc } from "../timezone";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

// Exemplo do PRD: 06/07 (seg) a 22/07 → semanas 06–08/07, 09–15/07, 16–22/07
const PERIOD = { startDate: "2026-07-06", endDate: "2026-07-22" };

function filterWithProducts(productIds: string[]): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: productIds.map((id) => ({ product_id: id, product_name: `Produto ${id}` })),
    meta_ads_terms: [],
    captacao_leads_eventos: [],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// Vendas por utm_source em função da semana pedida (chave = início BRT da semana).
const WEEKLY_SOURCES: Record<string, Array<{ source: string; count: number }>> = {
  "2026-07-06": [{ source: "instagram", count: 4 }],
  "2026-07-09": [
    { source: "instagram", count: 6 },
    { source: "email", count: 3 },
  ],
  "2026-07-16": [{ source: "email", count: 2 }],
};

function arm(supabase: FakeSupabase) {
  supabase.setRpc("get_conversion_sources", (args: Record<string, unknown>) => {
    if (args.p_start_date === brtToUtc(PERIOD.startDate, false) && args.p_end_date === brtToUtc(PERIOD.endDate, true)) {
      return [
        { source: "instagram", count: 10 },
        { source: "email", count: 5 },
      ];
    }
    const weekStart = Object.keys(WEEKLY_SOURCES).find(
      (start) => args.p_start_date === brtToUtc(start, false)
    );
    return weekStart ? WEEKLY_SOURCES[weekStart] : [];
  });
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("fetchConversionSourcesWeekly", () => {
  it("devolve as origens do período mais a contagem por origem por semana quinta→quarta", async () => {
    arm(supabase);

    const result = await fetchConversionSourcesWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(["111"])) },
      supabase.client
    );

    expect(result.sources).toEqual([
      { source: "instagram", count: 10 },
      { source: "email", count: 5 },
    ]);
    expect(result.weeks.map((w) => [w.startDate, w.endDate])).toEqual([
      ["2026-07-06", "2026-07-08"],
      ["2026-07-09", "2026-07-15"],
      ["2026-07-16", "2026-07-22"],
    ]);
  });

  it("consulta a RPC uma vez por semana com o intervalo da semana convertido para UTC", async () => {
    arm(supabase);

    await fetchConversionSourcesWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(["111"])) },
      supabase.client
    );

    const calls = supabase.rpcCalls("get_conversion_sources").map((c) => c.args);
    expect(calls).toContainEqual(
      expect.objectContaining({
        p_start_date: brtToUtc("2026-07-09", false),
        p_end_date: brtToUtc("2026-07-15", true),
      })
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        p_start_date: brtToUtc("2026-07-16", false),
        p_end_date: brtToUtc("2026-07-22", true),
      })
    );
  });

  it("origem presente no período mas zerada numa semana aparece com contagem 0", async () => {
    arm(supabase);

    const result = await fetchConversionSourcesWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(["111"])) },
      supabase.client
    );

    expect(result.weeks[0].sources).toContainEqual({ source: "email", count: 0 });
    expect(result.weeks[2].sources).toContainEqual({ source: "instagram", count: 0 });
  });

  it("a soma das contagens semanais por origem bate com o agregado da origem (RF-4)", async () => {
    arm(supabase);

    const result = await fetchConversionSourcesWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts(["111"])) },
      supabase.client
    );

    for (const { source, count } of result.sources) {
      const weeklySum = result.weeks.reduce(
        (sum, week) => sum + (week.sources.find((s) => s.source === source)?.count ?? 0),
        0
      );
      expect(weeklySum).toBe(count);
    }
  });

  it("fonte não configurada devolve vazio com semanas vazias, sem consultar o banco", async () => {
    const result = await fetchConversionSourcesWeekly(
      { period: PERIOD, filter: expandFilter(filterWithProducts([])) },
      supabase.client
    );

    expect(result.sources).toEqual([]);
    expect(result.weeks).toHaveLength(3);
    expect(result.weeks.every((w) => w.sources.length === 0)).toBe(true);
    expect(supabase.rpcCalls()).toHaveLength(0);
  });
});
