import type { ConversionSourceRow } from "@/types/indicadores";
import type { ExpandedFilter, Period } from "../filter-expansion";
import { brtToUtc } from "../timezone";
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
