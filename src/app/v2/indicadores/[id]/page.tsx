import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { isEventId } from "@/lib/indicadores/event-id";
import { loadEventosSeletor } from "@/lib/indicadores/seletor-eventos";
import { montarConsulta } from "@/lib/indicadores/dashboard-evento";
import { iniciarCargaDoEvento } from "@/lib/indicadores/dashboard-evento-servidor";
import { ProvedorEvento } from "@/components/v2/evento/contexto";
import { ControlesDoEvento } from "@/components/v2/evento/controles";
import { HeroSlot } from "@/components/v2/evento/hero-slot";
import { Esqueleto } from "@/components/v2/evento/bloco";
import { periodoDaUrl } from "@/components/v2/evento/periodo";
import { JornadaServidor, LeadsServidor, PlataformasServidor, ResultadoServidor } from "./blocos-servidor";

export const metadata: Metadata = { title: "Evento" };

export default async function EventoV2Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  // ID malformado nunca chega ao banco.
  if (!isEventId(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const resultado = await loadEventosSeletor(supabase);
  if (resultado.error !== undefined) {
    console.error("v2/evento: leitura dos eventos falhou", resultado.error);
    throw new Error("Falha ao ler os eventos");
  }
  const { filters } = resultado.data;
  const filter = filters.find((f) => f.id === id);
  if (!filter) notFound();

  const hoje = new Date().toISOString().slice(0, 10);
  const periodo = periodoDaUrl(await searchParams, hoje);
  const consulta = montarConsulta(filter, periodo);

  // As cinco fontes começam juntas aqui; cada bloco aguarda só as suas, dentro do próprio Suspense.
  const carga = iniciarCargaDoEvento(consulta, periodo, createSupabaseServiceClient());

  return (
    <ProvedorEvento filter={filter} filters={filters} periodoInicial={periodo} hoje={hoje}>
      <div className="mx-auto max-w-6xl space-y-8 pt-2">
        <HeroSlot nome={filter.name} status={filter.status} />
        <ControlesDoEvento />
        <section aria-label="Resultado">
          <Suspense fallback={<Esqueleto className="h-32 w-full" />}>
            <ResultadoServidor carga={carga} />
          </Suspense>
        </section>
        <Suspense fallback={<Esqueleto className="h-72 w-full" />}>
          <JornadaServidor carga={carga} />
        </Suspense>
        <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
          <PlataformasServidor carga={carga} />
        </Suspense>
        <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
          <LeadsServidor carga={carga} />
        </Suspense>
      </div>
    </ProvedorEvento>
  );
}
