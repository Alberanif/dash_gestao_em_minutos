import type { DailyPoint, FilterRecord, GlobalMetrics } from "@/types/indicadores";
import { expandFromSearchParams, type Period } from "./filter-expansion";
import { fetchDailySeries } from "./service/daily";
import {
  fetchMetaMetrics,
  fetchMetaMetricsUnscoped,
  fetchMetaMetricsWeekly,
} from "./service/meta";
import type { SupabaseLike } from "./service/types";

/**
 * Leitura principal do Indicadores: a lógica das rotas `daily`, `metrics` e
 * `filters`, sem `NextRequest`/`NextResponse`. Rotas e páginas chamam estas
 * funções; quem monta a resposta HTTP (status, JSON) continua sendo a rota.
 * Em `listFilters`/`createFilter` o erro de banco volta como `{ error }`, sem
 * lançar, para a rota seguir respondendo 500 com a mesma mensagem de antes.
 */

export type LeituraResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/** Período lido de `start_date`/`end_date`; `null` quando falta algum. */
export function readPeriod(searchParams: URLSearchParams): Period | null {
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  if (!startDate || !endDate) return null;
  return { startDate, endDate };
}

export function loadDailySeries(
  searchParams: URLSearchParams,
  period: Period,
  supabase: SupabaseLike
): Promise<DailyPoint[]> {
  const filter = expandFromSearchParams(searchParams);
  return fetchDailySeries({ period, filter }, supabase);
}

/** Resposta de `metrics`: o agregado global ou, com `breakdown=weekly`, a visão semanal. */
export async function loadMetaMetrics(
  searchParams: URLSearchParams,
  period: Period,
  supabase: SupabaseLike
): Promise<GlobalMetrics | Awaited<ReturnType<typeof fetchMetaMetricsWeekly>>> {
  const filter = expandFromSearchParams(searchParams);
  const query = { period, filter };

  // Opt-in da Planilha: agrega também por semana quinta→quarta. Sem o
  // parâmetro, a resposta permanece exatamente a de sempre.
  if (searchParams.get("breakdown") === "weekly") {
    return fetchMetaMetricsWeekly(query, supabase);
  }
  return filter.sources.meta
    ? fetchMetaMetrics(query, supabase)
    : fetchMetaMetricsUnscoped(query, supabase);
}

export async function listFilters(accountId: string, supabase: SupabaseLike): Promise<LeituraResult<FilterRecord[]>> {
  const { data, error } = await supabase
    .from("dash_gestao_filters")
    .select("*")
    .eq("account_id", accountId)
    .order("name", { ascending: true });

  if (error) return { error: error.message };
  return { data: data as FilterRecord[] };
}

export interface NewFilterInput {
  account_id: string;
  name: string;
  hotmart_products: unknown[];
  main_hotmart_product: unknown;
  debriefing_offer_codes: unknown;
  /** Já validado pela rota; `undefined` mantém a coluna fora do insert. */
  debriefing_products: unknown;
  meta_ads_terms: string[];
  captacao_leads_eventos: string[];
}

export async function createFilter(input: NewFilterInput, supabase: SupabaseLike): Promise<LeituraResult<FilterRecord>> {
  const { data, error } = await supabase
    .from("dash_gestao_filters")
    .insert({
      account_id: input.account_id,
      name: input.name,
      hotmart_products: input.hotmart_products,
      main_hotmart_product: input.main_hotmart_product,
      debriefing_offer_codes: input.debriefing_offer_codes,
      ...(input.debriefing_products !== undefined ? { debriefing_products: input.debriefing_products } : {}),
      meta_ads_terms: input.meta_ads_terms,
      captacao_leads_eventos: input.captacao_leads_eventos,
      status: "ativo",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as FilterRecord };
}
