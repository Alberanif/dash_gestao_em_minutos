import type { FilterRecord } from "@/types/indicadores";

/**
 * Única definição de "o que um filtro significa" no sistema. Consumida pela
 * tela de indicadores e pelas tools do agente — enquanto houver duas cópias
 * dessa lógica, elas podem divergir, e foi essa divergência que deixou o
 * agente responder com dados globais enquanto a tela mostrava o filtro.
 */
export interface ExpandedFilter {
  metaTerms: string[];
  productIds: string[];
  eventos: string[];
  offerCode: string | null;
  sources: ConfiguredSources;
}

export interface ConfiguredSources {
  meta: boolean;
  hotmart: boolean;
  leads: boolean;
}

export interface Period {
  startDate: string;
  endDate: string;
}

function nonBlank(values: readonly string[] | null | undefined): string[] {
  return (values ?? []).filter((v) => v.trim() !== "");
}

export function expandFilter(
  filter: FilterRecord | null,
  offerCode: string | null = null
): ExpandedFilter {
  // Ausência de filtro é escopo vazio, não escopo global: o dashboard nem
  // carrega sem filtro ativo, e "sem filtro" jamais deve virar "todos os dados".
  const metaTerms = nonBlank(filter?.meta_ads_terms);
  const productIds = nonBlank(filter?.hotmart_products?.map((p) => p.product_id));
  const eventos = nonBlank(filter?.captacao_leads_eventos);
  const normalizedOffer = offerCode?.trim() ? offerCode.trim() : null;

  return {
    metaTerms,
    productIds,
    eventos,
    offerCode: normalizedOffer,
    sources: {
      meta: metaTerms.length > 0,
      hotmart: productIds.length > 0,
      leads: eventos.length > 0,
    },
  };
}

/**
 * Traduz o filtro expandido para os nomes de parâmetro que os endpoints de
 * indicadores realmente leem. Nunca emite `filter_id`: esse parâmetro não é
 * lido por endpoint nenhum e era descartado em silêncio.
 */
export function toSearchParams(expanded: ExpandedFilter, period: Period): URLSearchParams {
  const params = new URLSearchParams();
  params.set("start_date", period.startDate);
  params.set("end_date", period.endDate);
  expanded.metaTerms.forEach((t) => params.append("meta_terms[]", t));
  expanded.productIds.forEach((id) => params.append("product_ids[]", id));
  expanded.eventos.forEach((e) => params.append("eventos[]", e));
  if (expanded.offerCode) params.set("offer_code", expanded.offerCode);
  return params;
}

/**
 * Expansão a partir dos parâmetros já serializados — usada pelos route
 * handlers, que recebem o filtro pela query string em vez do registro.
 */
export function expandFromSearchParams(searchParams: URLSearchParams): ExpandedFilter {
  const metaTerms = nonBlank(searchParams.getAll("meta_terms[]"));
  const productIds = nonBlank(searchParams.getAll("product_ids[]"));
  const eventos = nonBlank(searchParams.getAll("eventos[]"));
  const offerCode = searchParams.get("offer_code")?.trim() || null;

  return {
    metaTerms,
    productIds,
    eventos,
    offerCode,
    sources: {
      meta: metaTerms.length > 0,
      hotmart: productIds.length > 0,
      leads: eventos.length > 0,
    },
  };
}
