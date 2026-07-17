import type { GlobalLeadsMetrics, GlobalLeadsMetricsWithWeeks } from "@/types/indicadores";
import type { ExpandedFilter, Period } from "../filter-expansion";
import { partitionWeeks } from "../week-partition";
import type { SupabaseLike } from "./types";

export const ZEROED_LEADS: GlobalLeadsMetrics = { total: 0, by_event: [], by_source: [] };

export interface LeadsQuery {
  period: Period;
  filter: ExpandedFilter;
}

type EventRow = { evento: string; count: number };
type SourceRow = { source: string; count: number };
type RpcResult<T> = { data: T | null; error: { message: string } | null };

/**
 * Captação de leads no escopo do filtro. O escopo de leads é *só* o evento: o
 * endpoint nunca filtrou por produto nem por termo de campanha, e mudar isso
 * aqui faria o agente divergir do card da tela.
 *
 * Datas cruas de propósito — as RPCs de leads recebem a data BRT, ao contrário
 * das vendas Hotmart, que são consultadas em UTC.
 */
export async function fetchLeadsMetrics(
  { period, filter }: LeadsQuery,
  supabase: SupabaseLike
): Promise<GlobalLeadsMetrics> {
  if (!filter.sources.leads) return { ...ZEROED_LEADS, by_event: [], by_source: [] };

  return query(period, filter.eventos, supabase);
}

/**
 * Variante da Planilha: agregado do período mais leads por origem por semana
 * quinta→quarta. Cada semana consulta as mesmas RPCs com as datas da semana —
 * o corte é do banco, com a mesma lógica de contagem do agregado. Toda semana
 * lista a união das origens do período; origem sem leads na semana sai com 0
 * (a linha existe na planilha, a célula é 0).
 */
export async function fetchLeadsMetricsWeekly(
  { period, filter }: LeadsQuery,
  supabase: SupabaseLike
): Promise<GlobalLeadsMetricsWithWeeks> {
  const weeks = partitionWeeks(period.startDate, period.endDate);

  if (!filter.sources.leads) {
    return {
      ...ZEROED_LEADS,
      by_event: [],
      by_source: [],
      weeks: weeks.map((week) => ({ ...week, total: 0, by_source: [] })),
    };
  }

  const [aggregate, ...weekly] = await Promise.all([
    query(period, filter.eventos, supabase),
    ...weeks.map((week) =>
      weekSlice({ startDate: week.startDate, endDate: week.endDate }, filter.eventos, supabase)
    ),
  ]);

  const sourceUnion = [...aggregate.by_source.map((s) => s.source)];
  for (const slice of weekly) {
    for (const { source } of slice.by_source) {
      if (!sourceUnion.includes(source)) sourceUnion.push(source);
    }
  }

  return {
    ...aggregate,
    weeks: weeks.map((week, i) => ({
      ...week,
      total: weekly[i].total,
      by_source: sourceUnion.map((source) => ({
        source,
        count: weekly[i].by_source.find((s) => s.source === source)?.count ?? 0,
      })),
    })),
  };
}

async function weekSlice(
  period: Period,
  eventos: string[],
  supabase: SupabaseLike
): Promise<{ total: number; by_source: SourceRow[] }> {
  const args = {
    p_start_date: period.startDate,
    p_end_date: period.endDate,
    p_eventos: eventos,
  };

  const [totalResult, sourceResult] = await Promise.all([
    supabase.rpc("dash_gestao_leads_unique_total", args) as Promise<RpcResult<number>>,
    supabase.rpc("dash_gestao_leads_by_source", args) as Promise<RpcResult<SourceRow[]>>,
  ]);

  if (totalResult.error) throw new Error(totalResult.error.message);
  if (sourceResult.error) throw new Error(sourceResult.error.message);

  return {
    total: Number(totalResult.data ?? 0),
    by_source: (sourceResult.data ?? []).map((r) => ({ source: r.source, count: Number(r.count) })),
  };
}

/**
 * Caminho legado sem escopo de evento, preservado para que o route handler
 * continue respondendo idêntico quando chamado sem `eventos[]`. Nenhuma tool do
 * agente usa este caminho — é aqui que moram os dados globais.
 */
export async function fetchLeadsMetricsUnscoped(
  { period }: LeadsQuery,
  supabase: SupabaseLike
): Promise<GlobalLeadsMetrics> {
  return query(period, null, supabase);
}

async function query(
  period: Period,
  eventos: string[] | null,
  supabase: SupabaseLike
): Promise<GlobalLeadsMetrics> {
  const args = {
    p_start_date: period.startDate,
    p_end_date: period.endDate,
    p_eventos: eventos,
  };

  const [totalResult, byEventResult, sourceResult] = await Promise.all([
    supabase.rpc("dash_gestao_leads_unique_total", args) as Promise<RpcResult<number>>,
    eventos
      ? (supabase.rpc("dash_gestao_leads_by_event_unique", args) as Promise<RpcResult<EventRow[]>>)
      : Promise.resolve<RpcResult<EventRow[]>>({ data: [], error: null }),
    supabase.rpc("dash_gestao_leads_by_source", args) as Promise<RpcResult<SourceRow[]>>,
  ]);

  if (totalResult.error) throw new Error(totalResult.error.message);
  if (byEventResult.error) throw new Error(byEventResult.error.message);
  if (sourceResult.error) throw new Error(sourceResult.error.message);

  return {
    total: Number(totalResult.data ?? 0),
    by_event: (byEventResult.data ?? [])
      .filter((r) => r.count > 0)
      .map((r) => ({ evento: r.evento, count: Number(r.count) })),
    by_source: (sourceResult.data ?? []).map((r) => ({ source: r.source, count: Number(r.count) })),
  };
}
