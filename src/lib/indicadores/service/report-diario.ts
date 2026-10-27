import type { FilterRecord } from "@/types/indicadores";
import { expandFilter, type ExpandedFilter, type Period } from "../filter-expansion";
import type { ReportDiarioMapa, ReportFunil, ReportJanela } from "../report-diario-tipos";
import { LIFETIME_START } from "./eventos-metrics";
import { fetchMetaMetrics } from "./meta";
import { fetchLeadsMetrics } from "./leads";
import { fetchHotmartMetrics } from "./hotmart";
import type { SupabaseLike } from "./types";

// Cada funil dispara até 4 consultas simultâneas (1 Meta + 3 RPCs de leads, ou 1 Meta + vendas).
// Lote menor que o de eventos-metrics para o mesmo teto de pool.
const BATCH_SIZE = 2;

/** Data de "hoje" em BRT (UTC-3), independente do fuso do servidor. */
export function hojeBrt(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function leadsDoFunil(
  record: FilterRecord,
  filter: ExpandedFilter,
  period: Period,
  supabase: SupabaseLike
): Promise<number | null> {
  if (record.is_organic) {
    return filter.sources.leads ? (await fetchLeadsMetrics({ period, filter }, supabase)).total : null;
  }
  if (!filter.sources.hotmart) return null;
  return (await fetchHotmartMetrics({ period, filter }, supabase)).total_sales;
}

export async function fetchReportDiario(
  filters: FilterRecord[],
  supabase: SupabaseLike,
  hoje: string = hojeBrt()
): Promise<ReportDiarioMapa> {
  const period = { startDate: LIFETIME_START, endDate: hoje };

  async function funilFor(record: FilterRecord): Promise<[string, ReportFunil | null]> {
    try {
      const filter = expandFilter(record);

      // Orgânico conta os registros de leads; os demais contam as vendas do produto de captura.
      // Sem produto de captura configurado não há número: leads fica null, sem recorrer aos registros.
      const [meta, leadsTotal] = await Promise.all([
        filter.sources.meta ? fetchMetaMetrics({ period, filter }, supabase) : null,
        leadsDoFunil(record, filter, period, supabase),
      ]);
      const spend = meta ? meta.meta_spend : null;
      const leads = leadsTotal;
      const cpl = spend !== null && leads !== null && leads > 0 ? spend / leads : null;
      const periodo: ReportJanela = { leads, spend, cpl };
      return [record.id, { id: record.id, nome: record.name, periodo }];
    } catch (error) {
      console.error(`report-diario: funil ${record.id} falhou`, error);
      return [record.id, null];
    }
  }

  const ativos = filters.filter((f) => f.status === "ativo");
  const entries: Array<[string, ReportFunil | null]> = [];
  for (let i = 0; i < ativos.length; i += BATCH_SIZE) {
    entries.push(...(await Promise.all(ativos.slice(i, i + BATCH_SIZE).map(funilFor))));
  }
  return Object.fromEntries(entries);
}
