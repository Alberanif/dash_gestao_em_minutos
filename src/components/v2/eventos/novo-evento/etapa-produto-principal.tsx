"use client";

import { useCallback, useState } from "react";
import { Button, Selo } from "../../ui";
import { cx, foco } from "../../ui/cx";
import { offersBadgeLabel } from "@/components/indicadores/filter-modal";
import type { HotmartOffer } from "@/components/indicadores/offers-drawer";
import { BuscaProduto } from "./busca-produto";
import type { PropsEtapa } from "./estado";
import { OfertasPainel } from "./ofertas-painel";

export function EtapaProdutoPrincipal({ estado, atualizar }: PropsEtapa) {
  const [painelDe, setPainelDe] = useState<string | null>(null);
  // Cache de ofertas por produto: vive na etapa, então reabrir o painel não refaz o fetch.
  const [cache, setCache] = useState<Record<string, HotmartOffer[]>>({});

  const guardarOfertas = useCallback((productId: string, ofertas: HotmartOffer[]) => {
    setCache((c) => ({ ...c, [productId]: ofertas }));
  }, []);

  const produtos = estado.produtosPrincipais;
  const noPainel = produtos.find((p) => p.product_id === painelDe) ?? null;

  function mudarOfertas(productId: string, codigos: string[]) {
    atualizar({
      produtosPrincipais: produtos.map((p) => (p.product_id === productId ? { ...p, offer_codes: codigos } : p)),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-v2-nevoa">Produto principal</h3>
        <p className="text-sm text-v2-nevoa/70">
          O produto vendido no evento alimenta o Debriefing. Esta etapa é opcional, mas sem produto principal o
          Debriefing fica vazio.
        </p>
      </header>

      <BuscaProduto
        rotulo="Produto principal (Debriefing)"
        excluidos={produtos.map((p) => p.product_id)}
        onEscolher={(p) =>
          atualizar({
            produtosPrincipais: [...produtos, { product_id: p.product_id, product_name: p.product_name, offer_codes: [] }],
          })
        }
      />

      {produtos.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Produtos principais escolhidos">
          {produtos.map((p) => (
            <li
              key={p.product_id}
              className="flex flex-col gap-3 rounded-v2-md bg-v2-casco-alto p-4 shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="break-words text-sm font-medium text-v2-nevoa">{p.product_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-v2-nevoa/55">#{p.product_id}</span>
                  <Selo tom={p.offer_codes.length === 0 ? "neutro" : "info"}>{offersBadgeLabel(p.offer_codes)}</Selo>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variante="secundario"
                  className="h-11"
                  aria-label={`Escolher ofertas de ${p.product_name}`}
                  onClick={() => setPainelDe(p.product_id)}
                >
                  Escolher ofertas
                </Button>
                <button
                  type="button"
                  aria-label={`Remover ${p.product_name}`}
                  onClick={() => atualizar({ produtosPrincipais: produtos.filter((x) => x.product_id !== p.product_id) })}
                  className={cx(
                    "flex h-11 w-11 items-center justify-center rounded-v2-sm text-v2-nevoa/70 hover:text-v2-nevoa",
                    foco,
                  )}
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {noPainel && (
        <OfertasPainel
          productId={noPainel.product_id}
          productName={noPainel.product_name}
          selecionadas={noPainel.offer_codes}
          emCache={cache[noPainel.product_id]}
          onCarregadas={guardarOfertas}
          onMudar={(codigos) => mudarOfertas(noPainel.product_id, codigos)}
          onFechar={() => setPainelDe(null)}
        />
      )}
    </div>
  );
}
