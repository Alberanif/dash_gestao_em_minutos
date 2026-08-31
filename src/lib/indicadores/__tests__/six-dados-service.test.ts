import { listSixDados } from "../service/six-dados";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";
import type { FilterRecord } from "@/types/indicadores";

const ACCOUNT_ID = "acc-1";
const NOW = new Date("2026-07-16T12:00:00Z");

/** FilterRecord não tem index signature; o fake espera Record<string, unknown>. */
function setFilters(supabase: FakeSupabase, filters: FilterRecord[]): void {
  supabase.setRows("dash_gestao_filters", filters as unknown as Record<string, unknown>[]);
}

function makeFilter(overrides: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "f-1",
    account_id: ACCOUNT_ID,
    name: "Evento",
    hotmart_products: [],
    meta_ads_terms: ["PC Ao Vivo"],
    captacao_leads_eventos: ["PC_AO_VIVO_2026"],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    filter_id: "f-1",
    report_text: "Narrativa de teste.",
    kpi_snapshot: { lifetime: null, last7d: null },
    generated_at: "2026-07-16T11:30:00Z", // 30 min antes de NOW
    generating_at: null,
    created_at: "2026-07-16T11:30:00Z",
    updated_at: "2026-07-16T11:30:00Z",
    ...overrides,
  };
}

describe("listSixDados", () => {
  it("lista apenas filtros status = 'ativo', na ordem da tela (nome asc)", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [
      makeFilter({ id: "f-z", name: "Zebra", status: "ativo" }),
      makeFilter({ id: "f-a", name: "Abelha", status: "ativo" }),
      makeFilter({ id: "f-fin", name: "Finalizado Evento", status: "finalizado" }),
      makeFilter({ id: "f-canc", name: "Cancelado Evento", status: "cancelado" }),
    ]);
    supabase.setRows("dash_gestao_ai_reports", []);

    const items = await listSixDados(ACCOUNT_ID, supabase.client, NOW);

    expect(items.map((i) => i.filterId)).toEqual(["f-a", "f-z"]);
    expect(items.map((i) => i.name)).toEqual(["Abelha", "Zebra"]);
  });

  it("sem relatório para o filtro ⇒ report: null, stale: true", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter({ id: "f-1" })]);
    supabase.setRows("dash_gestao_ai_reports", []);

    const items = await listSixDados(ACCOUNT_ID, supabase.client, NOW);

    expect(items).toEqual([
      { filterId: "f-1", name: "Evento", report: null, stale: true },
    ]);
  });

  it("stale: false quando generated_at < 1h atrás e filtro não editado depois", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [
      makeFilter({ id: "f-1", updated_at: "2026-01-01T00:00:00Z" }),
    ]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReport({ filter_id: "f-1", generated_at: "2026-07-16T11:30:00Z" }), // 30 min
    ]);

    const items = await listSixDados(ACCOUNT_ID, supabase.client, NOW);

    expect(items[0].stale).toBe(false);
    expect(items[0].report).toEqual({
      text: "Narrativa de teste.",
      kpiSnapshot: { lifetime: null, last7d: null },
      generatedAt: "2026-07-16T11:30:00Z",
    });
  });

  it("stale: true quando generated_at > 1h atrás (TTL vencido)", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [
      makeFilter({ id: "f-1", updated_at: "2026-01-01T00:00:00Z" }),
    ]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReport({ filter_id: "f-1", generated_at: "2026-07-16T10:00:00Z" }), // 2h antes
    ]);

    const items = await listSixDados(ACCOUNT_ID, supabase.client, NOW);

    expect(items[0].stale).toBe(true);
  });

  it("stale: true quando filters.updated_at > generated_at (filtro editado após geração)", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [
      makeFilter({ id: "f-1", updated_at: "2026-07-16T11:45:00Z" }), // depois da geração
    ]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReport({ filter_id: "f-1", generated_at: "2026-07-16T11:30:00Z" }), // 30 min, dentro do TTL
    ]);

    const items = await listSixDados(ACCOUNT_ID, supabase.client, NOW);

    expect(items[0].stale).toBe(true);
  });

  it("relatório com generated_at null (nunca concluído) é stale e não é exposto", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter({ id: "f-1" })]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReport({ filter_id: "f-1", generated_at: null, generating_at: NOW.toISOString() }),
    ]);

    const items = await listSixDados(ACCOUNT_ID, supabase.client, NOW);

    expect(items[0].report).toBeNull();
    expect(items[0].stale).toBe(true);
  });

  it("não faz nenhuma chamada de rede fora do supabase injetado (sem LLM)", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() => {
      throw new Error("fetch não deveria ser chamado por listSixDados");
    });
    try {
      const supabase = makeFakeSupabase();
      setFilters(supabase, [makeFilter({ id: "f-1" })]);
      supabase.setRows("dash_gestao_ai_reports", []);

      await listSixDados(ACCOUNT_ID, supabase.client, NOW);

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
