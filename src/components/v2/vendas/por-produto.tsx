"use client";

import { useState } from "react";
import type { VendasViewOfferRow } from "@/types/vendas";
import { groupOffersByProduct, sumSales } from "@/lib/vendas/views";
import { Surface } from "../ui";
import { cx, foco } from "../ui/cx";

const fmtInt = (n: number) => Intl.NumberFormat("pt-BR").format(n);
const plural = (n: number, um: string, varios: string) => `${fmtInt(n)} ${n === 1 ? um : varios}`;

/**
 * Vendas e reembolsos por produto da visualização, cada produto expansível para as suas ofertas.
 * O subtotal do produto é a soma das ofertas. Oferta sem venda coletada continua na lista, com a marca.
 */
export function PorProduto({ offers }: { offers: VendasViewOfferRow[] }) {
  const grupos = groupOffersByProduct(offers);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  return (
    <section aria-labelledby="vendas-por-produto" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id="vendas-por-produto" className="text-base font-semibold text-v2-nevoa">
          Por produto
        </h3>
        <span className="text-sm text-v2-nevoa/65">Total nos produtos: {fmtInt(sumSales(offers))}</span>
      </div>
      <Surface className="p-0">
        <ul data-testid="view-products-list" className="divide-y divide-v2-azul-luz/10">
          {grupos.map((g) => {
            const aberto = Boolean(abertos[g.product_id]);
            const idPainel = `view-product-${g.product_id}-offers`;
            return (
              <li key={g.product_id} data-testid={`view-product-${g.product_id}`}>
                <button
                  type="button"
                  data-testid={`view-product-${g.product_id}-toggle`}
                  aria-expanded={aberto}
                  aria-controls={idPainel}
                  onClick={() => setAbertos((o) => ({ ...o, [g.product_id]: !o[g.product_id] }))}
                  className={cx("flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left", foco)}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className={cx("shrink-0 text-[10px] text-v2-nevoa/60 transition-transform duration-[120ms]", aberto && "rotate-90")}
                    >
                      ▶
                    </span>
                    <span className="min-w-0 text-sm font-medium text-v2-nevoa [overflow-wrap:anywhere]">
                      {g.product_name}
                      <span className="ml-2 text-xs font-normal text-v2-nevoa/60">{plural(g.offers.length, "oferta", "ofertas")}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <strong data-testid={`view-product-${g.product_id}-sales`} className="text-base font-semibold text-v2-nevoa">
                      {fmtInt(g.sales)}
                    </strong>
                    <span data-testid={`view-product-${g.product_id}-refunded`} className="block text-xs text-v2-nevoa/60">
                      {plural(g.refunded, "reembolsada", "reembolsadas")}
                    </span>
                  </span>
                </button>
                {aberto && (
                  <ul id={idPainel} data-testid={idPainel} className="mb-2 ml-9 mr-4 divide-y divide-v2-azul-luz/10 border-t border-v2-azul-luz/10">
                    {g.offers.map((o) => {
                      const nenhuma = o.sales === 0 && o.refunded === 0;
                      return (
                        <li
                          key={o.offer_code}
                          data-testid={`view-offer-${o.offer_code}`}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <span className="min-w-0 text-sm text-v2-nevoa [overflow-wrap:anywhere]">
                            {o.offer_name ? `${o.offer_name}, ` : ""}
                            <code className="text-v2-nevoa/70">{o.offer_code}</code>
                            {nenhuma && (
                              <span data-testid={`view-offer-${o.offer_code}-empty`} className="ml-2 text-xs text-v2-nevoa/60">
                                0 vendas coletadas
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-right">
                            <strong data-testid={`view-offer-${o.offer_code}-sales`} className="text-sm font-semibold text-v2-nevoa">
                              {fmtInt(o.sales)}
                            </strong>
                            {o.refunded > 0 && (
                              <span className="block text-xs text-v2-nevoa/60">{plural(o.refunded, "reembolsada", "reembolsadas")}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Surface>
    </section>
  );
}
