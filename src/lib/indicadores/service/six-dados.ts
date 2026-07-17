import type { AiReportKpiSnapshot, AiReportRecord, FilterRecord } from "@/types/indicadores";
import type { SupabaseLike } from "./types";

/**
 * Leitura da seção Six Dados (RF-3/RF-6 do PRD): lista Eventos ativos + o
 * relatório de IA em cache de cada um, com a flag `stale` calculada aqui.
 * Nunca chama o LLM — puramente leitura de `dash_gestao_filters` +
 * `dash_gestao_ai_reports`, via cliente Supabase injetado (testável com fake).
 */

/** Relatório vencido após 1h — mesmo TTL do RF-3. */
const STALE_TTL_MS = 60 * 60 * 1000;

export interface SixDadosReport {
  text: string | null;
  kpiSnapshot: AiReportKpiSnapshot | null;
  generatedAt: string;
}

export interface SixDadosItem {
  filterId: string;
  name: string;
  report: SixDadosReport | null;
  stale: boolean;
}

/** Reuse canonical AiReportRecord type via Pick — avoids silent drift. */
type AiReportRow = Pick<AiReportRecord, "filter_id" | "report_text" | "kpi_snapshot" | "generated_at">;

/**
 * RF-3: vencido quando `generated_at` tem mais de 1h, ou quando o filtro foi
 * editado depois da geração. `generated_at` ausente/inválido também é stale
 * (relatório inexistente ou nunca concluído).
 */
function isStale(filter: FilterRecord, report: AiReportRow | undefined, now: Date): boolean {
  if (!report?.generated_at) return true;

  const generatedAt = new Date(report.generated_at).getTime();
  if (Number.isNaN(generatedAt)) return true;
  if (now.getTime() - generatedAt > STALE_TTL_MS) return true;

  const updatedAt = new Date(filter.updated_at).getTime();
  if (!Number.isNaN(updatedAt) && updatedAt > generatedAt) return true;

  return false;
}

export async function listSixDados(
  accountId: string,
  supabase: SupabaseLike,
  now: Date = new Date()
): Promise<SixDadosItem[]> {
  const { data: filterRows, error: filtersError } = await supabase
    .from("dash_gestao_filters")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "ativo");

  if (filtersError) throw new Error(filtersError.message);

  // Mesma ordenação da tela de Eventos (rota `filters`: .order("name", { ascending: true })).
  const filters = ((filterRows ?? []) as FilterRecord[])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  if (filters.length === 0) return [];

  const { data: reportRows, error: reportsError } = await supabase
    .from("dash_gestao_ai_reports")
    .select("*")
    .in(
      "filter_id",
      filters.map((f) => f.id)
    );

  if (reportsError) throw new Error(reportsError.message);

  const reportByFilterId = new Map<string, AiReportRow>();
  for (const row of (reportRows ?? []) as AiReportRow[]) {
    reportByFilterId.set(row.filter_id, row);
  }

  return filters.map((filter) => {
    const report = reportByFilterId.get(filter.id);
    const hasCompletedReport = !!report?.generated_at;

    return {
      filterId: filter.id,
      name: filter.name,
      report: hasCompletedReport
        ? {
            text: report!.report_text,
            kpiSnapshot: report!.kpi_snapshot,
            generatedAt: report!.generated_at as string,
          }
        : null,
      stale: isStale(filter, report, now),
    };
  });
}
