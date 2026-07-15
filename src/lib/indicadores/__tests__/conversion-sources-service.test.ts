import {
  fetchConversionSources,
  fetchConversionSourcesUnscoped,
} from "../service/conversion-sources";
import { expandFilter } from "../filter-expansion";
import type { FilterRecord } from "@/types/indicadores";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";

const PERIOD = { startDate: "2026-06-01", endDate: "2026-06-30" };

// BRT (UTC-3) → UTC. As origens de conversão saem das vendas, cuja data é UTC.
const START_UTC = "2026-06-01T03:00:00.000Z";
const END_UTC = "2026-07-01T02:59:59.000Z";

function filterWith(produtos: string[], eventos: string[] = []): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: produtos.map((id) => ({ product_id: id, product_name: `Produto ${id}` })),
    meta_ads_terms: [],
    captacao_leads_eventos: eventos,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("fetchConversionSources", () => {
  it("manda os produtos do filtro e converte as datas de BRT para UTC", async () => {
    supabase.setRpc("get_conversion_sources", [{ source: "instagram", count: 12 }]);

    const result = await fetchConversionSources(
      { period: PERIOD, filter: expandFilter(filterWith(["111", "222"])) },
      supabase.client
    );

    expect(result).toEqual([{ source: "instagram", count: 12 }]);
    expect(supabase.rpcCalls("get_conversion_sources")[0].args).toEqual({
      p_start_date: START_UTC,
      p_end_date: END_UTC,
      p_product_ids: ["111", "222"],
    });
  });

  it("manda também os eventos quando o filtro os tem", async () => {
    await fetchConversionSources(
      { period: PERIOD, filter: expandFilter(filterWith(["111"], ["Evento A"])) },
      supabase.client
    );

    const args = supabase.rpcCalls("get_conversion_sources")[0].args;
    expect(args.p_product_ids).toEqual(["111"]);
    expect(args.p_eventos).toEqual(["Evento A"]);
  });

  it("devolve vazio quando o filtro não tem produtos Hotmart, sem consultar o banco", async () => {
    const result = await fetchConversionSources(
      { period: PERIOD, filter: expandFilter(filterWith([], ["Evento A"])) },
      supabase.client
    );

    expect(result).toEqual([]);
    expect(supabase.rpcCalls("get_conversion_sources")).toHaveLength(0);
  });

  it("propaga o erro da RPC em vez de devolver lista vazia silenciosamente", async () => {
    supabase.setRpcError("get_conversion_sources", "função inexistente");

    await expect(
      fetchConversionSources(
        { period: PERIOD, filter: expandFilter(filterWith(["111"])) },
        supabase.client
      )
    ).rejects.toThrow("função inexistente");
  });
});

describe("fetchConversionSourcesUnscoped", () => {
  it("omite p_product_ids quando o filtro não tem produto — é o caminho global que o route preserva", async () => {
    supabase.setRpc("get_conversion_sources", [{ source: "google", count: 3 }]);

    const result = await fetchConversionSourcesUnscoped(
      { period: PERIOD, filter: expandFilter(filterWith([], ["Evento A"])) },
      supabase.client
    );

    expect(result).toEqual([{ source: "google", count: 3 }]);
    expect(supabase.rpcCalls("get_conversion_sources")[0].args).toEqual({
      p_start_date: START_UTC,
      p_end_date: END_UTC,
      p_eventos: ["Evento A"],
    });
  });
});
