// Dash Ultimates — as três perguntas que a allowlist de ofertas cria
// (migration 065, PRD docs/PRD_2026-08-04_ultimates_ofertas_do_ciclo.md).
//
// Módulo puro, sem I/O: é consumido pela tela (estado bloqueado, faixa de
// aviso, validação do form) E pelas rotas de criação/edição, e as duas precisam
// responder IGUAL. A invariante também é repetida dentro das RPCs — nenhuma
// destas funções é o que garante a regra no banco.

import type {
  UltimatesCycleProductRef,
  UltimatesCycleProductSelection,
  UltimatesOfferOption,
  UltimatesOfferlessOption,
} from "@/types/vendas";

// Um produto está CONFIGURADO quando alguém decidiu incluir ao menos uma coisa
// dele: uma oferta real ou a venda sem oferta.
//
// Recusar TODAS as ofertas não configura o produto — de propósito. Um produto
// no ciclo do qual nada conta é indistinguível de um produto que não deveria
// estar no ciclo, e a segunda leitura é sempre a correta.
export function isProductConfigured(
  product: Pick<UltimatesCycleProductRef, "offer_codes" | "include_offerless">
): boolean {
  return product.offer_codes.length > 0 || product.include_offerless === true;
}

export function unconfiguredProducts<
  T extends Pick<UltimatesCycleProductRef, "offer_codes" | "include_offerless">,
>(products: T[]): T[] {
  return products.filter((product) => !isProductConfigured(product));
}

// Um ciclo SEM produto nenhum não é "configurado": é um ciclo que a validação
// de produtos já recusa desde a 061. Devolver true aqui faria o dashboard
// tentar renderizar números de um universo vazio em vez de mostrar o estado
// que explica o que falta.
export function isCycleConfigured(
  products: Pick<UltimatesCycleProductRef, "offer_codes" | "include_offerless">[]
): boolean {
  return products.length > 0 && products.every(isProductConfigured);
}

// A mesma invariante, do lado de quem escreve. Devolve os product_ids sem
// escolha — vazio significa "pode salvar".
export function unconfiguredSelection(
  selection: UltimatesCycleProductSelection[]
): string[] {
  return selection.filter((item) => !isProductConfigured(item)).map((item) => item.product_id);
}

// Oferta que existe no produto e sobre a qual NINGUÉM decidiu nada: nem
// escolhida, nem recusada. É o único caso que alerta.
//
// Uma oferta recusada de propósito (rejected_offer_codes) não aparece aqui, e
// essa é a razão de rejected existir: sem a distinção, toda cortesia desmarcada
// alertaria para sempre, e um aviso que sempre grita para de ser lido — que é
// exatamente a falha silenciosa que a allowlist deveria evitar.
export interface PendingOffer {
  product_id: string;
  // null = a linha "(sem oferta)" daquele produto, que também é uma decisão
  // pendente quando existe venda sem offer_code e include_offerless é null.
  offer_code: string | null;
  offer_name: string | null;
  sales_count: number;
}

export function pendingOffers(
  products: UltimatesCycleProductRef[],
  options: UltimatesOfferOption[],
  offerless: UltimatesOfferlessOption[]
): PendingOffer[] {
  const byProduct = new Map(products.map((product) => [product.product_id, product]));
  const pending: PendingOffer[] = [];

  for (const option of options) {
    const product = byProduct.get(option.product_id);
    // Oferta de produto que não está no ciclo não é pendência de ninguém.
    if (!product) continue;
    if (product.offer_codes.includes(option.offer_code)) continue;
    if (product.rejected_offer_codes.includes(option.offer_code)) continue;
    pending.push({
      product_id: option.product_id,
      offer_code: option.offer_code,
      offer_name: option.offer_name,
      sales_count: option.sales_count,
    });
  }

  for (const row of offerless) {
    const product = byProduct.get(row.product_id);
    if (!product) continue;
    if (product.include_offerless !== null) continue;
    // Produto sem venda sem-oferta não vem na lista; o guard é contra uma linha
    // com contagem 0 que só geraria um aviso sobre nada.
    if (row.sales_count <= 0) continue;
    pending.push({
      product_id: row.product_id,
      offer_code: null,
      offer_name: null,
      sales_count: row.sales_count,
    });
  }

  return pending;
}

// Total de vendas represadas nas pendências — o número que a faixa de aviso
// mostra. Somar na tela seria repetir a regra em dois lugares.
export function pendingSalesCount(pending: PendingOffer[]): number {
  return pending.reduce((total, item) => total + item.sales_count, 0);
}

// Rótulo da linha fixa da sanfona. Mora aqui, e não só no componente, porque a
// busca de ofertas precisa casar contra o MESMO texto que a tela exibe — um
// literal duplicado deixaria "sem oferta" achar a linha num lugar e não no
// outro.
export const OFFERLESS_LABEL = "(sem oferta)";

// Casamento da busca de ofertas. Está no módulo puro porque DOIS lados
// dependem dele e precisam concordar: a sanfona decide quais linhas exibir, e o
// formulário decide quais produtos continuam na lista. Se divergirem, aparece
// produto sem nenhuma linha visível — ou some produto que tinha resultado.
//
// Recebem o termo CRU e normalizam por dentro de propósito: um dos dois
// esquecer o trim/lower é justamente a divergência que se quer evitar.
export function offerMatchesSearch(
  offer: Pick<UltimatesOfferOption, "offer_code" | "offer_name">,
  search: string
): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;
  return (
    offer.offer_name.toLowerCase().includes(needle) ||
    offer.offer_code.toLowerCase().includes(needle)
  );
}

export function offerlessMatchesSearch(search: string): boolean {
  const needle = search.trim().toLowerCase();
  return needle === "" || OFFERLESS_LABEL.includes(needle);
}
