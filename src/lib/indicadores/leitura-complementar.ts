import type { FilterRecord } from "@/types/indicadores";
import { expandFromSearchParams, type Period } from "./filter-expansion";
import { listFilters, type LeituraResult } from "./leitura";
import { fetchConversionSources, fetchConversionSourcesUnscoped, fetchConversionSourcesWeekly } from "./service/conversion-sources";
import { fetchDebriefingMetrics, type DebriefingQueryProduct } from "./service/debriefing";
import { fetchEventosMetrics } from "./service/eventos-metrics";
import { fetchHotmartMetrics, fetchHotmartMetricsUnscoped, fetchHotmartMetricsWeekly } from "./service/hotmart";
import { fetchLeadsMetrics, fetchLeadsMetricsUnscoped, fetchLeadsMetricsWeekly } from "./service/leads";
import { fetchMetaCampaigns, normalizeSearch } from "./service/meta-campaigns";
import type { SupabaseLike } from "./service/types";

/**
 * Demais leituras do Indicadores: a lógica das rotas `hotmart`, `leads`,
 * `conversion-sources`, `campaigns`, `debriefing` e `eventos-metrics`, sem
 * `NextRequest`/`NextResponse`. Mesmo desenho de `leitura.ts`: a rota valida,
 * chama a função e monta a resposta HTTP.
 */

export function loadHotmartMetrics(searchParams: URLSearchParams, period: Period, supabase: SupabaseLike) {
  const filter = expandFromSearchParams(searchParams);
  const query = { period, filter };

  // Opt-in da Planilha: agrega também por semana quinta→quarta. Sem o
  // parâmetro, a resposta permanece exatamente a de sempre.
  if (searchParams.get("breakdown") === "weekly") {
    return fetchHotmartMetricsWeekly(query, supabase);
  }
  return filter.sources.hotmart ? fetchHotmartMetrics(query, supabase) : fetchHotmartMetricsUnscoped(query, supabase);
}

export function loadLeadsMetrics(searchParams: URLSearchParams, period: Period, supabase: SupabaseLike) {
  const filter = expandFromSearchParams(searchParams);
  const query = { period, filter };

  // Opt-in da Planilha: mesmo contrato de `loadHotmartMetrics`.
  if (searchParams.get("breakdown") === "weekly") {
    return fetchLeadsMetricsWeekly(query, supabase);
  }
  return filter.sources.leads ? fetchLeadsMetrics(query, supabase) : fetchLeadsMetricsUnscoped(query, supabase);
}

/** Com `breakdown=weekly` a resposta vira `{ sources, weeks }`; sem o parâmetro, segue o array de sempre. */
export function loadConversionSources(searchParams: URLSearchParams, period: Period, supabase: SupabaseLike) {
  const filter = expandFromSearchParams(searchParams);
  const query = { period, filter };

  if (searchParams.get("breakdown") === "weekly") {
    return fetchConversionSourcesWeekly(query, supabase);
  }
  return filter.sources.hotmart
    ? fetchConversionSources(query, supabase)
    : fetchConversionSourcesUnscoped(query, supabase);
}

export function loadMetaCampaigns(searchParams: URLSearchParams, period: Period, supabase: SupabaseLike) {
  const search = normalizeSearch(searchParams.get("q"));
  const filter = expandFromSearchParams(searchParams);
  return fetchMetaCampaigns({ period, filter }, supabase, search);
}

export type ParsedProducts = { ok: true; value: DebriefingQueryProduct[] } | { ok: false; error: string };

/** `products` = JSON `[{"product_id":"123","offer_codes":["abc"]}]`. offer_codes ausente/vazio = todas. */
export function parseDebriefingProducts(raw: string | null): ParsedProducts {
  if (!raw) return { ok: false, error: "products is required" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "products must be valid JSON" };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "products must be an array" };
  if (parsed.length === 0) return { ok: false, error: "products must not be empty" };

  const value: DebriefingQueryProduct[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object" || typeof item.product_id !== "string" || item.product_id.trim() === "") {
      return { ok: false, error: `products[${i}].product_id is required` };
    }
    const offerCodes = Array.isArray(item.offer_codes)
      ? item.offer_codes.filter((c): c is string => typeof c === "string")
      : [];
    value.push({
      product_id: item.product_id,
      product_name: typeof item.product_name === "string" ? item.product_name : undefined,
      offer_codes: offerCodes,
    });
  }
  return { ok: true, value };
}

export function loadDebriefingMetrics(period: Period, products: DebriefingQueryProduct[], supabase: SupabaseLike) {
  return fetchDebriefingMetrics({ startDate: period.startDate, endDate: period.endDate, products }, supabase);
}

/**
 * Métricas vitalícias de todos os filtros da conta: `{ filter_id: { leads, spend, cpl } | null }`.
 * Os filtros são lidos com o client da sessão (`userClient`) e as métricas com o de serviço, como antes.
 * Erro ao listar volta como `{ error }`, para a rota seguir respondendo 500.
 */
export async function loadEventosMetrics(
  accountId: string,
  userClient: SupabaseLike,
  serviceClient: SupabaseLike
): Promise<LeituraResult<Awaited<ReturnType<typeof fetchEventosMetrics>>>> {
  const filters = await listFilters(accountId, userClient);
  if (filters.error !== undefined) return { error: filters.error };
  return { data: await fetchEventosMetrics((filters.data ?? []) as FilterRecord[], serviceClient) };
}
