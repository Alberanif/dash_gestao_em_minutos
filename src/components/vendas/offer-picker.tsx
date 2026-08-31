"use client";

import { useMemo, useState } from "react";
import type { UltimatesOfferOption } from "@/types/vendas";
import {
  OFFERLESS_LABEL,
  offerMatchesSearch,
  offerlessMatchesSearch,
} from "@/lib/vendas/cycle-offers";

// Sanfona de ofertas de UM produto do ciclo (migration 065, PRD
// docs/PRD_2026-08-04_ultimates_ofertas_do_ciclo.md, seção 4.1).
//
// Só desenha: quem carrega as opções e quem guarda a decisão é o
// CycleFormModal. A razão é o submit — `rejected_offer_codes` depende da lista
// COMPLETA que foi carregada para o produto, e um estado escondido aqui dentro
// obrigaria o modal a pedi-lo de volta por callback no momento de salvar.
//
// Recolhida por padrão: o modal é aberto por rotina (renomear ciclo, mudar
// meta) e um ciclo com muitos produtos viraria uma página de rolagem antes de
// mostrar o campo Nome.
//
// A BUSCA é do modal, não daqui. Houve um campo por sanfona; ele morreu quando
// a busca subiu para baixo da barra de produtos. Dois campos filtrando a mesma
// lista obrigariam a repetir o termo em cada produto para varrer o ciclo, que é
// justamente o trabalho que a busca deveria poupar.

export interface OfferPickerProps {
  productId: string;
  // Ofertas do produto, já na ordem da RPC (nº de vendas desc, depois nome).
  offers: UltimatesOfferOption[];
  // Vendas do produto SEM offer_code. 0 = a linha "(sem oferta)" nem existe
  // para este produto: não há venda que ela pudesse resgatar, e oferecer a
  // marcação seria uma decisão sobre nada.
  offerlessCount: number;
  selectedOfferCodes: string[];
  includeOfferless: boolean;
  // Termo CRU da busca do modal (vazio = sem busca). A normalização mora em
  // cycle-offers.ts, junto com o filtro que decide se este produto entra na
  // lista — os dois precisam concordar sobre o que casa.
  search: string;
  // Busca ativa: a sanfona abre sozinha. Ter de expandir produto por produto
  // depois de buscar devolveria o trabalho que a busca acabou de tirar.
  forceOpen: boolean;
  loading: boolean;
  loadError: boolean;
  // Produto sem nenhuma escolha — borda de erro no item e mensagem aqui.
  invalid: boolean;
  onToggleOffer: (offerCode: string) => void;
  onToggleOfferless: () => void;
  onRetry: () => void;
}

export function OfferPicker({
  productId,
  offers,
  offerlessCount,
  selectedOfferCodes,
  includeOfferless,
  search,
  forceOpen,
  loading,
  loadError,
  invalid,
  onToggleOffer,
  onToggleOfferless,
  onRetry,
}: OfferPickerProps) {
  const [open, setOpen] = useState(false);
  const buscando = search.trim() !== "";
  // `open` continua sendo a preferência do gestor e sobrevive à busca: limpar o
  // termo devolve cada sanfona ao estado em que ele a deixou.
  const aberta = open || forceOpen;

  const temOfferless = offerlessCount > 0;
  // Contadores do cabeçalho são do PRODUTO, não do resultado da busca: é o
  // número que ele leva para o salvar.
  const total = offers.length + (temOfferless ? 1 : 0);
  const escolhidas = selectedOfferCodes.length + (includeOfferless ? 1 : 0);

  // Oferta MARCADA nunca some pela busca, ainda que não case com o termo:
  // esconder o que está contando faria o contador do cabeçalho discordar da
  // lista, e desmarcar por engano custaria linha de roster (PRD 3.5).
  const visiveis = useMemo(() => {
    if (!buscando) return offers;
    return offers.filter(
      (offer) =>
        selectedOfferCodes.includes(offer.offer_code) || offerMatchesSearch(offer, search)
    );
  }, [offers, search, buscando, selectedOfferCodes]);

  // Mesma regra da linha fixa: some na busca que não a nomeia, a não ser que
  // esteja marcada.
  const mostrarOfferless =
    temOfferless && (!buscando || includeOfferless || offerlessMatchesSearch(search));

  return (
    <div
      data-testid={`cycle-form-offers-${productId}`}
      style={{ padding: "6px 0 2px 10px", display: "flex", flexDirection: "column", gap: 6 }}
    >
      {loading && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Carregando ofertas...</p>
      )}

      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p
            data-testid={`cycle-form-offers-load-error-${productId}`}
            style={{ fontSize: 11, color: "var(--color-danger)", margin: 0 }}
          >
            Não foi possível carregar as ofertas.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={onRetry}
            data-testid={`cycle-form-offers-retry-${productId}`}
            style={{ fontSize: 11, padding: "3px 8px" }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* Sob busca o cabeçalho vira texto: a sanfona está aberta porque o
              termo a abriu, e um botão que não recolhe nada seria um clique
              morto. Sem busca ele volta a ser o controle de sempre. */}
          {forceOpen ? (
            <p
              data-testid={`cycle-form-offers-count-${productId}`}
              style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}
            >
              {escolhidas} de {total} {total === 1 ? "oferta" : "ofertas"}
            </p>
          ) : (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              data-testid={`cycle-form-offers-toggle-${productId}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 12,
                fontFamily: "inherit",
                color: "var(--text-muted)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span aria-hidden="true">{open ? "▾" : "▸"}</span>
              <span>
                {escolhidas} de {total} {total === 1 ? "oferta" : "ofertas"}
              </span>
            </button>
          )}

          {/* Mensagem visível mesmo com a sanfona recolhida: é o que explica a
              borda de erro do item sem obrigar a abrir tudo para descobrir. */}
          {invalid && (
            <p
              data-testid={`cycle-form-offers-error-${productId}`}
              style={{ fontSize: 11, color: "var(--color-danger)", margin: 0 }}
            >
              Selecione ao menos 1 oferta.
            </p>
          )}

          {aberta && total === 0 && (
            <p
              data-testid={`cycle-form-offers-empty-${productId}`}
              style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}
            >
              Nenhuma oferta cadastrada para este produto. Rode o sync em{" "}
              <code>/api/hotmart/sync-products</code> e reabra este modal.
            </p>
          )}

          {aberta && total > 0 && (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                maxHeight: 180,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {visiveis.map((offer) => {
                const marcada = selectedOfferCodes.includes(offer.offer_code);
                return (
                  <li key={offer.offer_code}>
                    <OfferRow
                      testId={`cycle-form-offer-${productId}-${offer.offer_code}`}
                      label={offer.offer_name}
                      count={offer.sales_count}
                      selected={marcada}
                      onClick={() => onToggleOffer(offer.offer_code)}
                    />
                  </li>
                );
              })}

              {/* Linha fixa, sempre no fim: é decisão sobre a venda que
                  NÃO tem oferta (PRD 3.3), não uma oferta a mais. Só
                  aparece para produto que tem venda nessa condição — sem
                  isso ela seria uma pergunta sobre um conjunto vazio. */}
              {mostrarOfferless && (
                <li>
                  <OfferRow
                    testId={`cycle-form-offerless-${productId}`}
                    label={OFFERLESS_LABEL}
                    count={offerlessCount}
                    selected={includeOfferless}
                    onClick={onToggleOfferless}
                  />
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// Linha de oferta. `minWidth: 0` + ellipsis no nome e `flexShrink: 0` na
// contagem: no celular o nome longo empurrava o número para fora do botão —
// mesma classe de estouro que os KPIs tiveram com o NBSP do Intl.
function OfferRow({
  testId,
  label,
  count,
  selected,
  onClick,
}: {
  testId: string;
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={selected ? "btn-primary" : "btn-secondary"}
      data-testid={testId}
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        fontSize: 12,
        padding: "5px 9px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {selected ? "✓" : "☐"} {label}
      </span>
      <span style={{ opacity: 0.7, flexShrink: 0 }}>{count}</span>
    </button>
  );
}
