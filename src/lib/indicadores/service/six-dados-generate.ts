import type { AiReportRecord, FilterRecord } from "@/types/indicadores";
import {
  generateSixDadosReport,
  type GenerateSixDadosReportDeps,
  type SixDadosModel,
  type SixDadosReportResult,
} from "@/lib/agent/six-dados/report";
import type { SupabaseLike } from "./types";
import { isStale, type SixDadosItem, type SixDadosReport } from "./six-dados";

/**
 * Geração sob demanda do Six Dados (PRD seção 5.3, RF-5). Regenera o relatório
 * de UM Evento com garantia de que gerações concorrentes não duplicam a chamada
 * ao LLM: o lock `generating_at` é adquirido por um UPDATE condicional atômico
 * (uma única statement) — a corrida é resolvida pelo Postgres, não pelo Node.
 *
 * Toda a I/O entra por injeção (`supabase`, `generate`, `now`, `sleep`) para os
 * testes exercitarem o lock/idempotência sem tocar no banco nem no LLM.
 */

/** Lock considerado expirado após ~2 min (geração travada não trava o Evento). */
const LOCK_TTL_MS = 2 * 60 * 1000;

/** Intervalo entre polls do perdedor da corrida enquanto espera o vencedor. */
const POLL_INTERVAL_MS = 500;

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface SixDadosGenerateDeps {
  supabase: SupabaseLike;
  /**
   * Núcleo de geração (#105). Injetável para os testes não chamarem o LLM;
   * em produção usa `generateSixDadosReport`.
   */
  generate?: (
    evento: FilterRecord,
    deps: GenerateSixDadosReportDeps
  ) => Promise<SixDadosReportResult>;
  /** Repassado ao gerador em produção; nos testes o gerador fake o ignora. */
  model?: SixDadosModel;
  /** Relógio injetável (default `() => new Date()`) para testes determinísticos. */
  now?: () => Date;
  /** Sleep injetável (default `setTimeout`) para o poll do perdedor ser rápido. */
  sleep?: (ms: number) => Promise<void>;
}

export type SixDadosGenerateOutcome =
  | { status: "not_found" }
  | { status: "not_active" }
  /** Cache ainda válido (RF-3) — idempotente, gerador não é chamado. */
  | { status: "cached"; item: SixDadosItem }
  /** Este processo venceu o lock e gerou o relatório. */
  | { status: "generated"; item: SixDadosItem }
  /** Perdedor da corrida — devolve o resultado do vencedor. */
  | { status: "waited"; item: SixDadosItem };

async function readReport(
  supabase: SupabaseLike,
  filterId: string
): Promise<AiReportRecord | undefined> {
  const { data, error } = await supabase
    .from("dash_gestao_ai_reports")
    .select("*")
    .eq("filter_id", filterId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? undefined) as AiReportRecord | undefined;
}

function toReport(report: AiReportRecord | undefined): SixDadosReport | null {
  if (!report?.generated_at) return null;
  return {
    text: report.report_text,
    kpiSnapshot: report.kpi_snapshot,
    generatedAt: report.generated_at,
  };
}

function toItem(filter: FilterRecord, report: AiReportRecord | undefined, now: Date): SixDadosItem {
  return {
    filterId: filter.id,
    name: filter.name,
    report: toReport(report),
    stale: isStale(filter, report, now),
  };
}

/**
 * Perdedor da corrida: aguarda o vencedor terminar (poll de `generating_at`
 * limpo) ou o lock expirar, e então devolve o relatório vigente. Limitado por
 * `maxAttempts` derivado do TTL — nunca faz loop infinito.
 */
async function waitForWinner(
  supabase: SupabaseLike,
  filter: FilterRecord,
  clock: () => Date,
  sleep: (ms: number) => Promise<void>
): Promise<SixDadosItem> {
  const maxAttempts = Math.ceil(LOCK_TTL_MS / POLL_INTERVAL_MS);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const report = await readReport(supabase, filter.id);
    if (!report?.generating_at) {
      // Vencedor terminou (ou liberou o lock após falhar): devolve o vigente.
      return toItem(filter, report, clock());
    }
    const lockAge = clock().getTime() - new Date(report.generating_at).getTime();
    if (lockAge > LOCK_TTL_MS) break; // lock preso/expirado — desiste (próxima request rouba)
    await sleep(POLL_INTERVAL_MS);
  }
  return toItem(filter, await readReport(supabase, filter.id), clock());
}

export async function generateSixDadosForFilter(
  filterId: string,
  deps: SixDadosGenerateDeps
): Promise<SixDadosGenerateOutcome> {
  const { supabase } = deps;
  const generate = deps.generate ?? generateSixDadosReport;
  const clock = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;

  // 1. Carrega o filtro e valida existência + status ativo (antes de qualquer lock).
  const { data: filterRow, error: filterErr } = await supabase
    .from("dash_gestao_filters")
    .select("*")
    .eq("id", filterId)
    .maybeSingle();
  if (filterErr) throw new Error(filterErr.message);
  if (!filterRow) return { status: "not_found" };
  const filter = filterRow as FilterRecord;
  if (filter.status !== "ativo") return { status: "not_active" };

  // 2. Idempotência (RF-3): relatório ainda válido ⇒ devolve sem gerar.
  const existing = await readReport(supabase, filterId);
  if (!isStale(filter, existing, clock())) {
    return { status: "cached", item: toItem(filter, existing, clock()) };
  }

  // 3. Garante a linha (a aquisição do lock é um UPDATE — não pega nada se a
  //    linha não existir). on-conflict-do-nothing preserva um relatório vigente.
  await supabase
    .from("dash_gestao_ai_reports")
    .upsert({ filter_id: filterId }, { onConflict: "filter_id", ignoreDuplicates: true });

  // 4. Aquisição ATÔMICA do lock: uma única statement condicional. Só o primeiro
  //    a ver `generating_at` nulo/expirado vence; o Postgres serializa a corrida.
  const lockedAtIso = clock().toISOString();
  const expiryIso = new Date(clock().getTime() - LOCK_TTL_MS).toISOString();
  const { data: locked, error: lockErr } = await supabase
    .from("dash_gestao_ai_reports")
    .update({ generating_at: lockedAtIso })
    .eq("filter_id", filterId)
    .or(`generating_at.is.null,generating_at.lt.${expiryIso}`)
    .select();
  if (lockErr) throw new Error(lockErr.message);
  const wonLock = Array.isArray(locked) && locked.length > 0;

  // 5. Perdedor: aguarda o vencedor e devolve o resultado dele.
  if (!wonLock) {
    const item = await waitForWinner(supabase, filter, clock, sleep);
    return { status: "waited", item };
  }

  // 6. Vencedor do lock: re-checa a validade ANTES de gerar. Entre o check de
  //    idempotência (passo 2) e a aquisição do lock (passo 4) outro processo pode
  //    ter vencido a corrida, gerado e liberado o lock (straggler) — sem este
  //    re-check geraríamos de novo o mesmo Evento já fresco, uma 2ª chamada ao
  //    LLM que viola RF-5/critério 6. Mesmo `clock()` do check original.
  const freshCheck = await readReport(supabase, filterId);
  if (!isStale(filter, freshCheck, clock())) {
    await supabase
      .from("dash_gestao_ai_reports")
      .update({ generating_at: null })
      .eq("filter_id", filterId);
    return { status: "cached", item: toItem(filter, freshCheck, clock()) };
  }

  // 7. Gera e persiste. Falha limpa o lock sem corromper o anterior.
  try {
    const result = await generate(filter, { supabase, model: deps.model, now: clock() });
    const generatedAtIso = clock().toISOString();
    const { error: writeErr } = await supabase
      .from("dash_gestao_ai_reports")
      .update({
        report_text: result.reportText,
        kpi_snapshot: result.kpiSnapshot,
        generated_at: generatedAtIso,
        generating_at: null,
      })
      .eq("filter_id", filterId);
    if (writeErr) throw new Error(writeErr.message);

    return {
      status: "generated",
      item: {
        filterId: filter.id,
        name: filter.name,
        report: {
          text: result.reportText,
          kpiSnapshot: result.kpiSnapshot,
          generatedAt: generatedAtIso,
        },
        stale: false,
      },
    };
  } catch (err) {
    // Limpa só o lock — report_text/kpi_snapshot/generated_at anteriores ficam intactos.
    await supabase
      .from("dash_gestao_ai_reports")
      .update({ generating_at: null })
      .eq("filter_id", filterId);
    throw err;
  }
}
