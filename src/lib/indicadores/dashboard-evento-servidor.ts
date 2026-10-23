import { loadDailySeries, loadMetaMetrics } from "./leitura";
import { loadConversionSources, loadHotmartMetrics, loadLeadsMetrics } from "./leitura-complementar";
import type { SupabaseLike } from "./service/types";
import type { Period } from "./filter-expansion";
import {
  ZERADOS,
  fonteConfigurada,
  paramsDaFonte,
  type Consulta,
  type DadosDasFontes,
  type Fonte,
  type FonteId,
} from "./dashboard-evento";

/** Lado do servidor do dashboard do evento: lê as fontes direto de `leitura*`, sem passar pelas rotas HTTP. */

type Carregadores = { [K in FonteId]: (sp: URLSearchParams, period: Period, supabase: SupabaseLike) => Promise<unknown> };

const CARREGADORES: Carregadores = {
  meta: (sp, period, supabase) => loadMetaMetrics(sp, period, supabase),
  hotmart: (sp, period, supabase) => Promise.resolve(loadHotmartMetrics(sp, period, supabase)),
  leads: (sp, period, supabase) => Promise.resolve(loadLeadsMetrics(sp, period, supabase)),
  daily: (sp, period, supabase) => loadDailySeries(sp, period, supabase),
  sources: (sp, period, supabase) => Promise.resolve(loadConversionSources(sp, period, supabase)),
};

/**
 * Carrega uma fonte no servidor. Fonte não configurada devolve o zero sem consulta;
 * falha devolve `null` (o bloco refaz pelo cliente) em vez de derrubar a página.
 */
export async function carregarFonte<K extends FonteId>(
  fonte: K,
  consulta: Consulta,
  period: Period,
  supabase: SupabaseLike,
): Promise<Fonte<DadosDasFontes[K]> | null> {
  if (!fonteConfigurada(consulta.expanded, fonte)) {
    return { data: ZERADOS[fonte] as DadosDasFontes[K], chave: consulta.chave };
  }
  try {
    const sp = new URLSearchParams(paramsDaFonte(consulta, fonte).slice(1));
    const data = (await CARREGADORES[fonte](sp, period, supabase)) as DadosDasFontes[K];
    return { data, chave: consulta.chave };
  } catch {
    return null;
  }
}

/** Uma promessa por fonte, todas disparadas juntas; cada bloco aguarda só as suas. */
export function iniciarCargaDoEvento(consulta: Consulta, period: Period, supabase: SupabaseLike) {
  return {
    meta: carregarFonte("meta", consulta, period, supabase),
    hotmart: carregarFonte("hotmart", consulta, period, supabase),
    leads: carregarFonte("leads", consulta, period, supabase),
    daily: carregarFonte("daily", consulta, period, supabase),
    sources: carregarFonte("sources", consulta, period, supabase),
  };
}

export type CargaDoEvento = ReturnType<typeof iniciarCargaDoEvento>;

