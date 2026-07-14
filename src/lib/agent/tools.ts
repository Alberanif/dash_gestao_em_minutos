import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { ExpandedFilter, Period } from "@/lib/indicadores/filter-expansion";
import type { SupabaseLike } from "@/lib/indicadores/service/types";
import { fetchHotmartMetrics } from "@/lib/indicadores/service/hotmart";

/**
 * O escopo é fechado por closure no servidor, no momento em que as tools são
 * construídas. O modelo enxerga apenas o intervalo de datas: é *impossível* ele
 * consultar fora do filtro ativo, mesmo alucinando um parâmetro.
 */
export interface AgentScope {
  filter: ExpandedFilter;
  supabase: SupabaseLike;
}

const periodSchema = z.object({
  startDate: z.string().describe("Data inicial no formato YYYY-MM-DD"),
  endDate: z.string().describe("Data final no formato YYYY-MM-DD"),
});

export async function buildPeriodSummary(
  period: Period,
  scope: AgentScope
): Promise<Record<string, unknown>> {
  const hotmart = await fetchHotmartMetrics({ period, filter: scope.filter }, scope.supabase);

  return {
    period,
    sources: scope.filter.sources,
    hotmart,
  };
}

export function buildAgentTools(scope: AgentScope): DynamicStructuredTool[] {
  return [
    new DynamicStructuredTool({
      name: "getPeriodSummary",
      description:
        "Retorna os números do período no escopo do filtro ativo: receita e vendas Hotmart, " +
        "quebra por produto, e quais fontes de dados estão configuradas. " +
        "O filtro ativo já é aplicado automaticamente — informe apenas o intervalo de datas. " +
        "Para comparar dois períodos, chame esta tool duas vezes.",
      schema: periodSchema,
      func: async ({ startDate, endDate }) => {
        const summary = await buildPeriodSummary({ startDate, endDate }, scope);
        return JSON.stringify(summary);
      },
    }),
  ];
}
