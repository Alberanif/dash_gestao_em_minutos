"use client";

import { useState } from "react";
import type { VendasViewOfferRow } from "@/types/vendas";
import { groupOffersByProduct } from "@/lib/vendas/views";

const fmtInt = (n: number) => Intl.NumberFormat("pt-BR").format(n);

const plural = (n: number, one: string, many: string) => `${fmtInt(n)} ${n === 1 ? one : many}`;

/**
 * Lista de produtos da visualização, cada um expansível para as suas ofertas.
 * Consome as linhas de `view_offers`; o subtotal do produto é a soma das
 * ofertas. Oferta com 0 vendas continua aparecendo.
 */
export function ProductsList({ offers }: { offers: VendasViewOfferRow[] }) {
  const groups = groupOffersByProduct(offers);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <ul data-testid="view-products-list" style={{ listStyle: "none", margin: 0, padding: 0, background: "var(--surface)", border: "1px solid var(--border-vis)", borderRadius: 11 }}>
      {groups.map((g) => {
        const isOpen = !!open[g.product_id];
        const panelId = `view-product-${g.product_id}-offers`;
        return (
          <li key={g.product_id} data-testid={`view-product-${g.product_id}`} style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              type="button"
              data-testid={`view-product-${g.product_id}-toggle`}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen((o) => ({ ...o, [g.product_id]: !o[g.product_id] }))}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}
            >
              <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 10, color: "var(--text-3)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                  ▶
                </span>
                <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>
                  {g.product_name}
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: "var(--text-3)" }}>{plural(g.offers.length, "oferta", "ofertas")}</span>
                </span>
              </span>
              <span style={{ textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                <strong data-testid={`view-product-${g.product_id}-sales`} style={{ fontSize: 15, color: "var(--text-strong)" }}>
                  {fmtInt(g.sales)}
                </strong>
                <span data-testid={`view-product-${g.product_id}-refunded`} style={{ display: "block", fontSize: 11, color: "var(--text-3)" }}>
                  {plural(g.refunded, "reembolsada", "reembolsadas")}
                </span>
              </span>
            </button>
            {isOpen && (
              <ul id={panelId} data-testid={panelId} style={{ listStyle: "none", margin: 0, padding: "0 16px 8px 34px" }}>
                {g.offers.map((o) => {
                  const none = o.sales === 0 && o.refunded === 0;
                  return (
                    <li
                      key={o.offer_code}
                      data-testid={`view-offer-${o.offer_code}`}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--border)" }}
                    >
                      <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 13, color: "var(--text)" }}>
                        {o.offer_name ? `${o.offer_name} · ` : ""}
                        <code>{o.offer_code}</code>
                        {none && (
                          <span data-testid={`view-offer-${o.offer_code}-empty`} style={{ marginLeft: 8, fontSize: 11, color: "var(--text-3)" }}>
                            0 vendas coletadas
                          </span>
                        )}
                      </span>
                      <span style={{ textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                        <strong data-testid={`view-offer-${o.offer_code}-sales`} style={{ fontSize: 14, color: "var(--text-strong)" }}>
                          {fmtInt(o.sales)}
                        </strong>
                        {o.refunded > 0 && (
                          <span style={{ display: "block", fontSize: 11, color: "var(--text-3)" }}>{plural(o.refunded, "reembolsada", "reembolsadas")}</span>
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
  );
}
