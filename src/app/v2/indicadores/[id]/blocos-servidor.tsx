import type { CargaDoEvento } from "@/lib/indicadores/dashboard-evento-servidor";
import { BlocoJornada } from "@/components/v2/evento/bloco-jornada";
import { BlocoLeads } from "@/components/v2/evento/bloco-leads";
import { BlocoPlataformas } from "@/components/v2/evento/bloco-plataformas";
import { BlocoResultado } from "@/components/v2/evento/bloco-resultado";

/**
 * Um componente de servidor por bloco: cada um aguarda só as fontes que usa e entra em
 * streaming quando elas chegam, sem esperar os outros. A fonte que falhou chega como
 * `null` e o bloco refaz a consulta pelo cliente.
 */

export async function ResultadoServidor({ carga }: { carga: CargaDoEvento }) {
  const [meta, hotmart] = await Promise.all([carga.meta, carga.hotmart]);
  return <BlocoResultado meta={meta} hotmart={hotmart} />;
}

export async function JornadaServidor({ carga }: { carga: CargaDoEvento }) {
  const [meta, hotmart, leads] = await Promise.all([carga.meta, carga.hotmart, carga.leads]);
  return <BlocoJornada meta={meta} hotmart={hotmart} leads={leads} />;
}

export async function PlataformasServidor({ carga }: { carga: CargaDoEvento }) {
  const [meta, hotmart, daily, sources] = await Promise.all([carga.meta, carga.hotmart, carga.daily, carga.sources]);
  return <BlocoPlataformas meta={meta} hotmart={hotmart} daily={daily} sources={sources} />;
}

export async function LeadsServidor({ carga }: { carga: CargaDoEvento }) {
  const [leads, daily] = await Promise.all([carga.leads, carga.daily]);
  return <BlocoLeads leads={leads} daily={daily} />;
}
