import type { EventosMetricsMap } from "@/lib/indicadores/service/eventos-metrics";
import { MetricasCelulas } from "@/components/v2/eventos/metricas-celulas";

/**
 * Métricas de um evento, lidas de uma promessa única compartilhada pela página:
 * cada cartão entra em streaming quando o lote termina, sem bloquear a lista.
 */
export async function MetricasEvento({ id, mapa }: { id: string; mapa: Promise<EventosMetricsMap> }) {
  const metricas = await mapa;
  return <MetricasCelulas metrics={metricas[id]} />;
}
