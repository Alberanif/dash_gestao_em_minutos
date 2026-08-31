import { ChatOpenAI } from "@langchain/openai";
import type { AiReportKpiBlock, AiReportKpiSnapshot, FilterRecord } from "@/types/indicadores";
import { expandFilter, type Period } from "@/lib/indicadores/filter-expansion";
import { fetchPeriodSummary, type PeriodSummary } from "@/lib/indicadores/service/period-summary";
import type { SupabaseLike } from "@/lib/indicadores/service/types";
import { LIFETIME_START } from "@/lib/indicadores/service/eventos-metrics";
import { todayInSaoPaulo } from "@/lib/agent/prompt";
import { resolveAgentModel } from "@/lib/agent/model";
import { dateSubtractDays } from "@/lib/date-utils";
import { buildSixDadosPrompt } from "./prompt";

/**
 * Geração é um parágrafo, não um relatório: um teto de tokens baixo evita
 * que o modelo divague, e mantém o custo de até 24 gerações/dia por Evento
 * (ver PRD, seção "Riscos") previsível.
 */
const MAX_TOKENS = 400;

/**
 * Teto defensivo por geração — bem abaixo do timeout do agente de chat
 * (60s para uma conversa com várias tools): aqui é uma chamada só.
 */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Contrato mínimo que este módulo precisa do modelo: uma chamada, com o
 * prompt inteiro como entrada, devolvendo o texto gerado. Isolar essa
 * superfície (em vez de exigir um `ChatOpenAI` de verdade) é o que permite
 * injetar um fake nos testes sem mockar o módulo `@langchain/openai` inteiro.
 */
export interface SixDadosModelResponse {
  content: unknown;
}

export interface SixDadosModel {
  invoke(input: string): Promise<SixDadosModelResponse>;
}

export interface GenerateSixDadosReportDeps {
  supabase: SupabaseLike;
  /** Injetável para teste; em produção usa o mesmo modelo do agente de chat. */
  model?: SixDadosModel;
  /** Injetável para teste; em produção é `new Date()` (momento da geração). */
  now?: Date;
}

export interface SixDadosReportResult {
  reportText: string;
  kpiSnapshot: AiReportKpiSnapshot;
}

function buildDefaultModel(): SixDadosModel {
  return new ChatOpenAI({
    model: resolveAgentModel(process.env),
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens: MAX_TOKENS,
    timeout: REQUEST_TIMEOUT_MS,
  });
}

/** `AIMessage.content` pode ser string ou uma lista de partes; o card só exibe texto. */
function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String((part as { text: unknown }).text)
          : ""
      )
      .join("")
      .trim();
  }

  return "";
}

/**
 * Bloco de KPIs a partir do PeriodSummary da camada de serviço — mesma regra
 * de `eventos-metrics.ts` (fonte não configurada ⇒ `null`, nunca 0; CPL só
 * quando spend e leads>0 estão disponíveis). Reusar a regra em vez de
 * reimplementá-la é o que garante que o card bate com o resto do produto
 * (RF-6/critério 7 do PRD).
 */
function toKpiBlock(summary: PeriodSummary): AiReportKpiBlock {
  const spend = summary.sources.meta ? summary.meta.meta_spend : null;
  const leads = summary.sources.leads ? summary.leads.total : null;
  const cpl = spend !== null && leads !== null && leads > 0 ? spend / leads : null;

  return {
    roas: summary.derived.roas,
    revenueBrl: summary.sources.hotmart ? summary.hotmart.total_revenue : null,
    leads,
    cpl,
    spend,
    sales: summary.sources.hotmart ? summary.hotmart.total_sales : null,
    startDate: summary.period.startDate,
    endDate: summary.period.endDate,
  };
}

/**
 * Núcleo de IA do Six Dados: gera a narrativa de um Evento com uma única
 * chamada ao modelo, números já resolvidos no prompt (sem ReAct, sem tools,
 * sem streaming — ver PRD seção 5.2). O agente de chat (`graph.ts`) não é
 * tocado por este módulo.
 */
export async function generateSixDadosReport(
  evento: FilterRecord,
  deps: GenerateSixDadosReportDeps
): Promise<SixDadosReportResult> {
  const { supabase, now = new Date() } = deps;
  const filter = expandFilter(evento);

  const today = todayInSaoPaulo(now);
  const lifetimePeriod: Period = { startDate: LIFETIME_START, endDate: today };
  const last7dPeriod: Period = { startDate: dateSubtractDays(today, 7), endDate: today };

  const [lifetimeSummary, last7dSummary] = await Promise.all([
    fetchPeriodSummary({ period: lifetimePeriod, filter }, supabase),
    fetchPeriodSummary({ period: last7dPeriod, filter }, supabase),
  ]);

  const kpiSnapshot: AiReportKpiSnapshot = {
    lifetime: toKpiBlock(lifetimeSummary),
    last7d: toKpiBlock(last7dSummary),
  };

  const prompt = buildSixDadosPrompt({
    eventoName: evento.name,
    lifetime: kpiSnapshot.lifetime,
    last7d: kpiSnapshot.last7d,
  });

  const model = deps.model ?? buildDefaultModel();
  const response = await model.invoke(prompt);
  const reportText = extractText(response.content);

  return { reportText, kpiSnapshot };
}
