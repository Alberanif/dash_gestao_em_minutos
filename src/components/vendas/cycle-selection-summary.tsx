"use client";

import { OFFERLESS_LABEL } from "@/lib/vendas/cycle-offers";

// O que o ciclo vai acompanhar, em lista: o produto numa linha e, indentadas
// sob ele, as ofertas escolhidas dele.
//
// Substituiu DOIS textos corridos que condensavam produto e oferta na mesma
// linha ("Selecionados: A, B (2)" e "Produto: Oferta · Oferta · Oferta"). Com
// dois produtos e cinco ofertas já não dava para dizer qual oferta era de quem
// — e é justamente esse pareamento que a allowlist da 065 tornou a decisão
// central do ciclo.
//
// Presentational: nenhuma decisão mora aqui. Tirar a marca do produto e clicar
// no × de uma oferta chamam os MESMOS toggles da sanfona, para que a escolha
// feita nos dois lugares seja a mesma escrita — inclusive a conversão de
// oferta desmarcada em recusa registrada, no submit.

export interface SummaryOffer {
  // null = a linha "(sem oferta)": decisão sobre a venda que não tem
  // offer_code, não uma oferta de verdade.
  offerCode: string | null;
  label: string;
  // null enquanto as ofertas do produto não chegaram. Exibir 0 aqui afirmaria
  // que a oferta escolhida não tem venda nenhuma, que é diferente de não saber.
  salesCount: number | null;
}

export interface SummaryProduct {
  productId: string;
  productName: string;
  offers: SummaryOffer[];
}

export interface CycleSelectionSummaryProps {
  products: SummaryProduct[];
  testId: string;
  // Ciclo encerrado: mesma lista, sem checkbox e sem ×. Trocar produto ou
  // oferta reescreveria todos os números de um histórico fechado.
  readOnly?: boolean;
  onRemoveProduct?: (productId: string) => void;
  onRemoveOffer?: (productId: string, offerCode: string | null) => void;
}

export function CycleSelectionSummary({
  products,
  testId,
  readOnly = false,
  onRemoveProduct,
  onRemoveOffer,
}: CycleSelectionSummaryProps) {
  return (
    <div className="ult-selection" data-testid={testId}>
      <p className="ult-selection-head">
        {products.length} {products.length === 1 ? "produto" : "produtos"} no ciclo
      </p>

      <ul className="ult-selection-list">
        {products.map((product) => (
          <li key={product.productId} className="ult-selection-item">
            {readOnly ? (
              <div className="ult-selection-product">
                <span className="ult-selection-name">{product.productName}</span>
                <span className="ult-selection-id">{product.productId}</span>
              </div>
            ) : (
              // A checkbox vem marcada porque só produto escolhido aparece na
              // lista: desmarcar é o gesto de tirar do ciclo. O <label> em
              // volta faz o nome inteiro ser alvo de clique.
              <label className="ult-selection-product">
                <input
                  type="checkbox"
                  checked
                  onChange={() => onRemoveProduct?.(product.productId)}
                  aria-label={`Remover ${product.productName} do ciclo`}
                  data-testid={`cycle-form-selected-product-${product.productId}`}
                />
                <span className="ult-selection-name">{product.productName}</span>
                <span className="ult-selection-id">{product.productId}</span>
              </label>
            )}

            {product.offers.length === 0 ? (
              // Produto sem oferta é o estado que trava o salvar. Dizer isso na
              // própria linha evita a caça ao produto culpado que a mensagem de
              // erro do rodapé, sozinha, obrigaria.
              <p
                className="ult-selection-empty"
                data-testid={`cycle-form-selected-empty-${product.productId}`}
              >
                Nenhuma oferta escolhida
              </p>
            ) : (
              <ul className="ult-selection-offers">
                {product.offers.map((offer) => (
                  <li
                    key={offer.offerCode ?? OFFERLESS_LABEL}
                    className="ult-selection-offer"
                    data-testid={`cycle-form-selected-offer-${product.productId}-${offer.offerCode ?? "offerless"}`}
                  >
                    <span className="ult-selection-offer-name">{offer.label}</span>
                    {offer.salesCount !== null && (
                      <span className="ult-selection-offer-count">{offer.salesCount}</span>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        className="ult-selection-remove"
                        onClick={() => onRemoveOffer?.(product.productId, offer.offerCode)}
                        // O rótulo acessível nomeia produto E oferta: numa lista
                        // com o mesmo nome de oferta em dois produtos, "Remover
                        // Cortesia" sozinho não diz qual das duas sai.
                        aria-label={`Remover a oferta ${offer.label} de ${product.productName}`}
                        title="Remover esta oferta do ciclo"
                        data-testid={`cycle-form-selected-offer-remove-${product.productId}-${offer.offerCode ?? "offerless"}`}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
