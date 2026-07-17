import type { ConversionSourceRow, ConversionSourcesWithWeeks } from "@/types/indicadores";
import type { ExpandedFilter, Period } from "../filter-expansion";
import { brtToUtc } from "../timezone";
import { partitionWeeks } from "../week-partition";
import type { SupabaseLike } from "./types";

export interface ConversionSourcesQuery {
  period: Period;
  filter: ExpandedFilter;
}

/**
 * Origens de conversão das vendas Hotmart (`sck`/UTM registrado na venda). É a
 * resposta para "de onde vieram minhas vendas?" — o card existe na tela desde
 * sempre, mas o agente o ignorava por completo.
 *
 * Ausência de produto no filtro é ausência de vendas no escopo: devolve vazio
 * sem consultar, em vez das origens de todas as vendas da conta.
 */
export async function fetchConversionSources(
  { period, filter }: ConversionSourcesQuery,
  supabase: SupabaseLike
): Promise<ConversionSourceRow[]> {
  if (!filter.sources.hotmart) return [];

  return query(period, filter.productIds, filter.eventos, supabase);
}

/**
 * Variante da Planilha: origens do período mais a contagem por origem por
 * semana quinta→quarta, via a mesma RPC com as datas de cada semana. Toda
 * semana lista a união das origens do período; origem sem venda na semana sai
 * com 0 (a linha existe na planilha, a célula é 0).
 */
export async function fetchConversionSourcesWeekly(
  { period, filter }: ConversionSourcesQuery,
  supabase: SupabaseLike
): Promise<ConversionSourcesWithWeeks> {
  const weeks = partitionWeeks(period.startDate, period.endDate);

  if (!filter.sources.hotmart) {
    return { sources: [], weeks: weeks.map((week) => ({ ...week, sources: [] })) };
  }

  const [aggregate, ...weekly] = await Promise.all([
    query(period, filter.productIds, filter.eventos, supabase),
    ...weeks.map((week) =>
      query(
        { startDate: week.startDate, endDate: week.endDate },
        filter.productIds,
        filter.eventos,
        supabase
      )
    ),
  ]);

  const sourceUnion = [...aggregate.map((s) => s.source)];
  for (const slice of weekly) {
    for (const { source } of slice) {
      if (!sourceUnion.includes(source)) sourceUnion.push(source);
    }
  }

  return {
    sources: aggregate,
    weeks: weeks.map((week, i) => ({
      ...week,
      sources: sourceUnion.map((source) => ({
        source,
        count: weekly[i].find((s) => s.source === source)?.count ?? 0,
      })),
    })),
  };
}

/**
 * Caminho legado sem escopo de produto, preservado para que o route handler
 * continue respondendo idêntico quando chamado sem `product_ids[]`. Nenhuma tool
 * do agente usa este caminho — é aqui que moram os dados globais.
 */
export async function fetchConversionSourcesUnscoped(
  { period, filter }: ConversionSourcesQuery,
  supabase: SupabaseLike
): Promise<ConversionSourceRow[]> {
  return query(period, filter.productIds, filter.eventos, supabase);
}

async function query(
  period: Period,
  productIds: string[],
  eventos: string[],
  supabase: SupabaseLike
): Promise<ConversionSourceRow[]> {
  const { data, error } = await supabase.rpc("get_conversion_sources", {
    p_start_date: brtToUtc(period.startDate, false),
    p_end_date: brtToUtc(period.endDate, true),
    ...(productIds.length > 0 ? { p_product_ids: productIds } : {}),
    ...(eventos.length > 0 ? { p_eventos: eventos } : {}),
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConversionSourceRow[];
}
