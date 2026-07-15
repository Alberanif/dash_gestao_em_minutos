import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { ExpandedFilter, Period } from "@/lib/indicadores/filter-expansion";
import type { SupabaseLike } from "@/lib/indicadores/service/types";
import { fetchDailySeries } from "@/lib/indicadores/service/daily";
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

/**
 * Série dia a dia do período. Vive numa tool separada do resumo de propósito: o
 * payload cresce com o número de dias e só serve para tendência — embuti-lo em
 * todo resumo encareceria as perguntas que nem olham para a curva.
 */
export async function buildDailySeries(
  period: Period,
  scope: AgentScope
): Promise<Record<string, unknown>> {
  const series = await fetchDailySeries({ period, filter: scope.filter }, scope.supabase);

  return {
    period,
    sources: scope.filter.sources,
    series,
  };
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
    new DynamicStructuredTool({
      name: "getDailySeries",
      description:
        "Retorna a série dia a dia do período: investimento, leads e CPL do Meta Ads, " +
        "vendas Hotmart e captações de leads em cada data. " +
        "Use para análise de tendência — em que dia a curva virou, onde o CPL disparou, " +
        "se o resultado veio concentrado num dia ou distribuído. " +
        "Para o total do período, use getPeriodSummary: esta tool devolve um ponto por dia " +
        "e não serve para responder sobre o agregado. " +
        "O filtro ativo já é aplicado automaticamente — informe apenas o intervalo de datas.",
      schema: periodSchema,
      func: async ({ startDate, endDate }) => {
        const daily = await buildDailySeries({ startDate, endDate }, scope);
        return JSON.stringify(daily);
      },
    }),
  ];
}
