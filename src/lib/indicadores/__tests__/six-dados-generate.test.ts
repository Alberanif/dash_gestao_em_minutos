import { generateSixDadosForFilter } from "../service/six-dados-generate";
import { makeFakeSupabase, type FakeSupabase } from "./fake-supabase";
import type { AiReportKpiSnapshot, FilterRecord } from "@/types/indicadores";

const ACCOUNT_ID = "acc-1";
const FILTER_ID = "f-1";
const NOW = new Date("2026-07-16T12:00:00Z");

/** Snapshot mínimo válido — o formato exato é irrelevante para o lock. */
const SNAPSHOT: AiReportKpiSnapshot = {
  lifetime: {
    roas: null,
    revenueBrl: null,
    leads: null,
    cpl: null,
    spend: null,
    sales: null,
    startDate: "2020-01-01",
    endDate: "2026-07-16",
  },
  last7d: {
    roas: null,
    revenueBrl: null,
    leads: null,
    cpl: null,
    spend: null,
    sales: null,
    startDate: "2026-07-09",
    endDate: "2026-07-16",
  },
};

function setFilters(supabase: FakeSupabase, filters: FilterRecord[]): void {
  supabase.setRows("dash_gestao_filters", filters as unknown as Record<string, unknown>[]);
}

function makeFilter(overrides: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: FILTER_ID,
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

function makeReportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    filter_id: FILTER_ID,
    report_text: "Narrativa anterior.",
    kpi_snapshot: SNAPSHOT,
    generated_at: "2026-07-16T11:30:00Z",
    generating_at: null,
    created_at: "2026-07-16T11:30:00Z",
    updated_at: "2026-07-16T11:30:00Z",
    ...overrides,
  };
}

/** Gerador fake injetável — conta chamadas para provar que o LLM roda 1×. */
function makeGenerator(reportText = "Resumo novo gerado.") {
  let calls = 0;
  const generate = async (evento: FilterRecord) => {
    calls++;
    void evento;
    return { reportText, kpiSnapshot: SNAPSHOT };
  };
  return { generate, calls: () => calls };
}

const noopSleep = async () => {};
const clock = () => NOW;

type FakeClient = FakeSupabase["client"];

/**
 * Envolve o client fake para simular um straggler: no exato instante em que o
 * código tenta a aquisição ATÔMICA do lock (`.update({ generating_at: <iso> })`,
 * a única statement com essa forma — payload de 1 chave, valor não-nulo — o
 * resto do fluxo usa `generating_at: null` na limpeza ou várias chaves na
 * escrita final), `onAcquireAttempt` roda de forma síncrona ANTES da query real.
 * Isso reproduz "outro processo venceu, gerou e liberou o lock" entre o passo 2
 * (idempotência) e o passo 4 (aquisição do lock) desta execução — sem precisar
 * de um segundo processo real rodando em paralelo.
 */
function withLockAcquireHook(
  supabase: FakeSupabase,
  table: string,
  onAcquireAttempt: () => void
): FakeClient {
  let triggered = false;
  return {
    ...supabase.client,
    from(t: string) {
      const builder = supabase.client.from(t);
      if (t !== table) return builder;
      return {
        ...builder,
        update(patch: Record<string, unknown>) {
          const keys = Object.keys(patch);
          const isLockAcquire =
            !triggered && keys.length === 1 && keys[0] === "generating_at" && patch.generating_at !== null;
          if (isLockAcquire) {
            triggered = true;
            onAcquireAttempt();
          }
          return builder.update(patch);
        },
      };
    },
  };
}

describe("generateSixDadosForFilter", () => {
  it("seam 1: relatório válido ⇒ devolve o existente e NÃO chama o gerador", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter({ updated_at: "2026-01-01T00:00:00Z" })]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReportRow({ generated_at: "2026-07-16T11:30:00Z" }), // 30 min atrás, válido
    ]);
    const gen = makeGenerator();

    const outcome = await generateSixDadosForFilter(FILTER_ID, {
      supabase: supabase.client,
      generate: gen.generate,
      now: clock,
      sleep: noopSleep,
    });

    expect(gen.calls()).toBe(0);
    expect(outcome.status).toBe("cached");
    expect(outcome.status === "cached" && outcome.item.report?.text).toBe("Narrativa anterior.");
    expect(outcome.status === "cached" && outcome.item.stale).toBe(false);
  });

  it("seam 2: relatório vencido ⇒ adquire lock, gera 1×, faz upsert com texto+snapshot+generated_at e limpa generating_at", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter()]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReportRow({ generated_at: "2026-07-16T10:00:00Z" }), // 2h atrás, vencido
    ]);
    const gen = makeGenerator("Resumo fresquinho.");

    const outcome = await generateSixDadosForFilter(FILTER_ID, {
      supabase: supabase.client,
      generate: gen.generate,
      now: clock,
      sleep: noopSleep,
    });

    expect(gen.calls()).toBe(1);
    expect(outcome.status).toBe("generated");
    expect(outcome.status === "generated" && outcome.item.report?.text).toBe("Resumo fresquinho.");

    const row = supabase.getRows("dash_gestao_ai_reports")[0];
    expect(row.report_text).toBe("Resumo fresquinho.");
    expect(row.kpi_snapshot).toEqual(SNAPSHOT);
    expect(row.generated_at).toBe(NOW.toISOString());
    expect(row.generating_at).toBeNull();
  });

  it("seam 2b: sem linha prévia ⇒ semeia a linha, gera e persiste", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter()]);
    supabase.setRows("dash_gestao_ai_reports", []);
    const gen = makeGenerator("Primeiro resumo.");

    const outcome = await generateSixDadosForFilter(FILTER_ID, {
      supabase: supabase.client,
      generate: gen.generate,
      now: clock,
      sleep: noopSleep,
    });

    expect(gen.calls()).toBe(1);
    expect(outcome.status).toBe("generated");
    const rows = supabase.getRows("dash_gestao_ai_reports");
    expect(rows).toHaveLength(1);
    expect(rows[0].filter_id).toBe(FILTER_ID);
    expect(rows[0].report_text).toBe("Primeiro resumo.");
    expect(rows[0].generating_at).toBeNull();
  });

  it("seam 3: corrida ⇒ gerador chamado exatamente 1× e o perdedor devolve o resultado do vencedor", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter()]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReportRow({ generated_at: "2026-07-16T10:00:00Z" }), // vencido
    ]);
    const gen = makeGenerator("Resumo do vencedor.");

    const deps = {
      supabase: supabase.client,
      generate: gen.generate,
      now: clock,
      sleep: noopSleep,
    };

    const [a, b] = await Promise.all([
      generateSixDadosForFilter(FILTER_ID, deps),
      generateSixDadosForFilter(FILTER_ID, deps),
    ]);

    expect(gen.calls()).toBe(1);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["generated", "waited"]);
    const texts = [a, b].map((o) =>
      o.status === "generated" || o.status === "waited" ? o.item.report?.text : null
    );
    expect(texts).toEqual(["Resumo do vencedor.", "Resumo do vencedor."]);
  });

  it("seam 4: lock expirado (> ~2min) é roubado e a geração prossegue", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter()]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReportRow({
        generated_at: null,
        // lock preso 3 min atrás (> 2 min ⇒ roubável)
        generating_at: "2026-07-16T11:57:00Z",
      }),
    ]);
    const gen = makeGenerator("Resumo após roubo do lock.");

    const outcome = await generateSixDadosForFilter(FILTER_ID, {
      supabase: supabase.client,
      generate: gen.generate,
      now: clock,
      sleep: noopSleep,
    });

    expect(gen.calls()).toBe(1);
    expect(outcome.status).toBe("generated");
    const row = supabase.getRows("dash_gestao_ai_reports")[0];
    expect(row.generating_at).toBeNull();
    expect(row.report_text).toBe("Resumo após roubo do lock.");
  });

  it("seam 5: gerador lança ⇒ lock limpo, erro propagado e relatório anterior intacto", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter()]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReportRow({
        report_text: "Relatório anterior bom.",
        generated_at: "2026-07-16T10:00:00Z", // vencido ⇒ tenta regenerar
      }),
    ]);
    const failing = async () => {
      throw new Error("LLM indisponível");
    };

    await expect(
      generateSixDadosForFilter(FILTER_ID, {
        supabase: supabase.client,
        generate: failing,
        now: clock,
        sleep: noopSleep,
      })
    ).rejects.toThrow("LLM indisponível");

    const row = supabase.getRows("dash_gestao_ai_reports")[0];
    expect(row.generating_at).toBeNull(); // lock limpo
    expect(row.report_text).toBe("Relatório anterior bom."); // não corrompido
    expect(row.generated_at).toBe("2026-07-16T10:00:00Z"); // preservado
  });

  it("seam 3b: perdedor com lock preso (vencedor nunca libera) desiste em ~30s de poll, não nos ~2min do TTL", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter()]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReportRow({
        generated_at: null, // nunca gerado ⇒ stale, entra na disputa do lock
        // lock adquirido há 10s — bem dentro do TTL de ~2min, nunca expira
        // durante o teste (o relógio fica congelado em NOW) e o "vencedor"
        // nunca libera o lock (simula uma invocação travada/derrubada).
        generating_at: "2026-07-16T11:59:50Z",
      }),
    ]);
    const gen = makeGenerator();

    let sleepCalls = 0;
    const countedSleep = async (ms: number) => {
      sleepCalls++;
      void ms;
    };

    const outcome = await generateSixDadosForFilter(FILTER_ID, {
      supabase: supabase.client,
      generate: gen.generate,
      now: clock,
      sleep: countedSleep,
    });

    // Nunca deveria gerar: esta execução é sempre o perdedor (o lock nunca fica livre).
    expect(gen.calls()).toBe(0);
    expect(outcome.status).toBe("waited");

    // Orçamento de poll do perdedor: ~30s / 500ms = 60 tentativas — bem abaixo
    // das 240 (~2min) que o TTL do lock sozinho permitiria. Serverless não pode
    // ficar bloqueado 2min numa invocação.
    const POLL_INTERVAL_MS = 500;
    const MAX_WAIT_MS = 30_000;
    expect(sleepCalls).toBe(MAX_WAIT_MS / POLL_INTERVAL_MS);
    expect(sleepCalls * POLL_INTERVAL_MS).toBeLessThanOrEqual(MAX_WAIT_MS);
  });

  it("seam 6a: filtro inexistente ⇒ not_found sem tocar no lock nem gerar", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, []);
    supabase.setRows("dash_gestao_ai_reports", []);
    const gen = makeGenerator();

    const outcome = await generateSixDadosForFilter(FILTER_ID, {
      supabase: supabase.client,
      generate: gen.generate,
      now: clock,
      sleep: noopSleep,
    });

    expect(outcome.status).toBe("not_found");
    expect(gen.calls()).toBe(0);
  });

  it("seam 6b: filtro não-ativo ⇒ not_active sem gerar", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter({ status: "finalizado" })]);
    supabase.setRows("dash_gestao_ai_reports", []);
    const gen = makeGenerator();

    const outcome = await generateSixDadosForFilter(FILTER_ID, {
      supabase: supabase.client,
      generate: gen.generate,
      now: clock,
      sleep: noopSleep,
    });

    expect(outcome.status).toBe("not_active");
    expect(gen.calls()).toBe(0);
  });

  it("seam 7: straggler entre a checagem de idempotência e a aquisição do lock ⇒ re-checa após vencer o lock e NÃO gera de novo", async () => {
    const supabase = makeFakeSupabase();
    setFilters(supabase, [makeFilter()]);
    supabase.setRows("dash_gestao_ai_reports", [
      makeReportRow({ generated_at: "2026-07-16T10:00:00Z" }), // vencido no passo 2 (idempotência)
    ]);
    const gen = makeGenerator("Resumo indevido (não deveria ser chamado).");

    // No instante em que esta execução tenta adquirir o lock (passo 4), simula
    // que outro processo já venceu a corrida, gerou e liberou o lock — a linha
    // fica fresca ANTES do UPDATE de aquisição rodar.
    const client = withLockAcquireHook(supabase, "dash_gestao_ai_reports", () => {
      const row = supabase.getRows("dash_gestao_ai_reports")[0];
      Object.assign(row, {
        report_text: "Resumo do vencedor da corrida.",
        kpi_snapshot: SNAPSHOT,
        generated_at: NOW.toISOString(),
        generating_at: null,
      });
    });

    const outcome = await generateSixDadosForFilter(FILTER_ID, {
      supabase: client,
      generate: gen.generate,
      now: clock,
      sleep: noopSleep,
    });

    expect(gen.calls()).toBe(0); // straggler NÃO deve chamar o LLM de novo — relatório já estava fresco
    expect(outcome.status).toBe("cached");
    expect(outcome.status === "cached" && outcome.item.report?.text).toBe(
      "Resumo do vencedor da corrida."
    );
    expect(outcome.status === "cached" && outcome.item.stale).toBe(false);

    const row = supabase.getRows("dash_gestao_ai_reports")[0];
    expect(row.generating_at).toBeNull(); // lock liberado, não fica preso
    expect(row.report_text).toBe("Resumo do vencedor da corrida."); // não sobrescrito
  });
});
