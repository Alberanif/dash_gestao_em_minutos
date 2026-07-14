import { fetchLeadsMetrics, fetchLeadsMetricsUnscoped } from "../service/leads";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

const PERIOD = { startDate: "2026-06-01", endDate: "2026-06-30" };

function filterWith(eventos: string[], produtos: string[] = []): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: produtos.map((id) => ({ product_id: id, product_name: `Produto ${id}` })),
    meta_ads_terms: [],
    captacao_leads_eventos: eventos,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("fetchLeadsMetrics", () => {
  it("envia os eventos do filtro como p_eventos nas RPCs, com as datas cruas", async () => {
    await fetchLeadsMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["Evento A", "Evento B"])) },
      supabase.client
    );

    expect(supabase.rpcCalls("dash_gestao_leads_unique_total")[0].args).toEqual({
      p_start_date: "2026-06-01",
      p_end_date: "2026-06-30",
      p_eventos: ["Evento A", "Evento B"],
    });
  });

  it("escopa leads SÓ por evento — nunca manda produto, mesmo com produtos no filtro", async () => {
    await fetchLeadsMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["Evento A"], ["111"])) },
      supabase.client
    );

    for (const call of supabase.rpcCalls()) {
      expect(Object.keys(call.args)).toEqual(["p_start_date", "p_end_date", "p_eventos"]);
    }
  });

  it("devolve o vazio quando o filtro não tem eventos, sem consultar o banco", async () => {
    const result = await fetchLeadsMetrics(
      { period: PERIOD, filter: expandFilter(filterWith([])) },
      supabase.client
    );

    expect(result).toEqual({ total: 0, by_event: [], by_source: [] });
    expect(supabase.rpcCalls()).toHaveLength(0);
  });

  it("descarta eventos com contagem zero na quebra por evento", async () => {
    supabase.setRpc("dash_gestao_leads_unique_total", 3);
    supabase.setRpc("dash_gestao_leads_by_event_unique", [
      { evento: "Evento A", count: 3 },
      { evento: "Evento B", count: 0 },
    ]);
    supabase.setRpc("dash_gestao_leads_by_source", [{ source: "meta", count: 3 }]);

    const result = await fetchLeadsMetrics(
      { period: PERIOD, filter: expandFilter(filterWith(["Evento A", "Evento B"])) },
      supabase.client
    );

    expect(result.total).toBe(3);
    expect(result.by_event).toEqual([{ evento: "Evento A", count: 3 }]);
    expect(result.by_source).toEqual([{ source: "meta", count: 3 }]);
  });

  it("propaga o erro da RPC em vez de devolver zero silenciosamente", async () => {
    supabase.setRpcError("dash_gestao_leads_unique_total", "RPC indisponível");

    await expect(
      fetchLeadsMetrics(
        { period: PERIOD, filter: expandFilter(filterWith(["Evento A"])) },
        supabase.client
      )
    ).rejects.toThrow("RPC indisponível");
  });
});

describe("fetchLeadsMetricsUnscoped", () => {
  it("manda p_eventos nulo e pula a quebra por evento — é o caminho global que o route preserva sem eventos[]", async () => {
    supabase.setRpc("dash_gestao_leads_unique_total", 42);
    supabase.setRpc("dash_gestao_leads_by_source", [{ source: "instagram", count: 42 }]);

    const result = await fetchLeadsMetricsUnscoped(
      { period: PERIOD, filter: expandFilter(filterWith([])) },
      supabase.client
    );

    expect(result.total).toBe(42);
    expect(result.by_event).toEqual([]);
    expect(result.by_source).toEqual([{ source: "instagram", count: 42 }]);
    expect(supabase.rpcCalls("dash_gestao_leads_unique_total")[0].args.p_eventos).toBeNull();
    expect(supabase.rpcCalls("dash_gestao_leads_by_event_unique")).toHaveLength(0);
  });
});
