import type { FilterRecord } from "@/types/indicadores";
import { today } from "@/lib/date-utils";
import { expandFilter } from "../filter-expansion";
import { fetchMetaMetrics } from "./meta";
import { fetchLeadsMetrics } from "./leads";
import type { SupabaseLike } from "./types";

/**
 * Métricas vitalícias dos cards da tela Eventos. Mesma semântica dos KPIs do
 * dashboard: leads deduplicados da captação e investimento Meta Ads pelos
 * termos do filtro. CPL = spend/leads (null quando leads = 0 ou fonte ausente).
 */
export const LIFETIME_START = "2020-01-01";

// Cada filtro dispara até 4 consultas pesadas em paralelo (1 Meta + 3 RPCs de
// leads, todas vitalícias). Sem teto, uma conta com dezenas de filtros satura
// o pool do banco num único carregamento da tela.
const BATCH_SIZE = 5;

export interface EventoMetrics {
  leads: number | null;
  spend: number | null;
  cpl: number | null;
}

/** null no valor do mapa = métricas daquele filtro falharam (degradação por filtro). */
export type EventosMetricsMap = Record<string, EventoMetrics | null>;

export async function fetchEventosMetrics(
  filters: FilterRecord[],
  supabase: SupabaseLike,
  endDate: string = today()
): Promise<EventosMetricsMap> {
  const period = { startDate: LIFETIME_START, endDate };

  async function metricsFor(record: FilterRecord): Promise<[string, EventoMetrics | null]> {
    try {
      const filter = expandFilter(record);
      const [meta, leadsMetrics] = await Promise.all([
        filter.sources.meta ? fetchMetaMetrics({ period, filter }, supabase) : null,
        filter.sources.leads ? fetchLeadsMetrics({ period, filter }, supabase) : null,
      ]);

      const spend = meta ? meta.meta_spend : null;
      const leads = leadsMetrics ? leadsMetrics.total : null;
      const cpl = spend !== null && leads !== null && leads > 0 ? spend / leads : null;
      return [record.id, { leads, spend, cpl }];
    } catch (error) {
      // null degrada só este card; sem log, a falha fica indistinguível de "sem dados".
      console.error(`eventos-metrics: métricas do filtro ${record.id} falharam`, error);
      return [record.id, null];
    }
  }

  const entries: Array<[string, EventoMetrics | null]> = [];
  for (let i = 0; i < filters.length; i += BATCH_SIZE) {
    entries.push(...(await Promise.all(filters.slice(i, i + BATCH_SIZE).map(metricsFor))));
  }

  return Object.fromEntries(entries);
}
