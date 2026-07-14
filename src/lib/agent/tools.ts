import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { ExpandedFilter, Period } from "@/lib/indicadores/filter-expansion";
import type { SupabaseLike } from "@/lib/indicadores/service/types";
import { fetchPeriodSummary, type PeriodSummary } from "@/lib/indicadores/service/period-summary";

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

/**
 * Adapter fino sobre a camada de serviço: o mesmo código que alimenta os cards
 * da tela alimenta o agente. Enquanto houvesse dois caminhos de leitura, eles
 * podiam divergir — e divergiam.
 */
export async function buildPeriodSummary(
  period: Period,
  scope: AgentScope
): Promise<PeriodSummary> {
  return fetchPeriodSummary({ period, filter: scope.filter }, scope.supabase);
}

export function buildAgentTools(scope: AgentScope): DynamicStructuredTool[] {
  return [
    new DynamicStructuredTool({
      name: "getPeriodSummary",
      description:
        "Retorna TODOS os números do período no escopo do filtro ativo, numa única chamada: " +
        "`meta` (investimento, leads, impressões, cliques, CPL, CPM, CTR), " +
        "`hotmart` (receita, vendas e a quebra por produto em `products`), " +
        "`leads` (total, `by_event` e `by_source`), " +
        "`conversionSources` (de onde vieram as vendas), " +
        "`derived` (roas, cpa, conversionRate — já calculados; NUNCA os recalcule) e " +
        "`sources` (quais fontes o filtro configura). " +
        "Um valor `null` em `derived` significa INDISPONÍVEL (ex.: investimento zero), nunca zero. " +
        "Uma fonte `false` em `sources` significa NÃO CONFIGURADA no filtro: declare isso ao " +
        "usuário em vez de reportar os zeros daquela seção como desempenho. " +
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
