import { Suspense } from "react";
import type { Metadata } from "next";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadEventosSeletor } from "@/lib/indicadores/seletor-eventos";
import { fetchEventosMetrics, type EventosMetricsMap } from "@/lib/indicadores/service/eventos-metrics";
import { EventosLista } from "@/components/v2/eventos/eventos-lista";
import { EventosErro, EventosVazio, MetricasSkeleton } from "@/components/v2/eventos/estados";
import { MetricasEvento } from "./metricas-evento";

export const metadata: Metadata = { title: "Eventos" };

export default async function EventosV2Page() {
  const supabase = await createSupabaseServerClient();
  const resultado = await loadEventosSeletor(supabase);

  if (resultado.error !== undefined) {
    console.error("v2/eventos: leitura dos eventos falhou", resultado.error);
    return <EventosErro />;
  }

  const { filters } = resultado.data;
  if (filters.length === 0) return <EventosVazio />;

  // As consultas de métricas são pesadas: a promessa não é aguardada aqui. Cada
  // cartão a aguarda dentro do próprio Suspense, e a lista aparece antes dela.
  const mapa: Promise<EventosMetricsMap> = fetchEventosMetrics(filters, createSupabaseServiceClient()).catch(
    (error) => {
      console.error("v2/eventos: métricas falharam", error);
      return {};
    },
  );

  const metricas = Object.fromEntries(
    filters.map((filter) => [
      filter.id,
      <Suspense key={filter.id} fallback={<MetricasSkeleton />}>
        <MetricasEvento id={filter.id} mapa={mapa} />
      </Suspense>,
    ]),
  );

  return <EventosLista filters={filters} metricas={metricas} />;
}
