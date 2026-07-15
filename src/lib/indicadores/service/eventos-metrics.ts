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

  const entries = await Promise.all(
    filters.map(async (record): Promise<[string, EventoMetrics | null]> => {
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
      } catch {
        return [record.id, null];
      }
    })
  );

  return Object.fromEntries(entries);
}
