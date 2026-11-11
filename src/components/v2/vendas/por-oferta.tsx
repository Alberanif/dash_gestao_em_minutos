import type { VendasViewOfferRow } from "@/types/vendas";
import { sumSales } from "@/lib/vendas/views";
import { Surface } from "../ui";

const fmtInt = (n: number) => Intl.NumberFormat("pt-BR").format(n);

/** Vendas e reembolsos por oferta da visualização. Oferta sem venda coletada continua na lista, com a marca. */
export function PorOferta({ offers }: { offers: VendasViewOfferRow[] }) {
  return (
    <section aria-labelledby="vendas-por-oferta" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id="vendas-por-oferta" className="text-base font-semibold text-v2-nevoa">
          Por oferta
        </h3>
        <span className="text-sm text-v2-nevoa/65">Total nas ofertas: {fmtInt(sumSales(offers))}</span>
      </div>
      <Surface className="p-0">
        <ul data-testid="view-offers-list" className="divide-y divide-v2-azul-luz/10">
          {offers.map((o) => {
            const nenhuma = o.sales === 0 && o.refunded === 0;
            return (
              <li
                key={o.offer_code}
                data-testid={`view-offer-${o.offer_code}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
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
                  <strong
                    data-testid={`view-offer-${o.offer_code}-sales`}
                    className="text-base font-semibold text-v2-nevoa"
                  >
                    {fmtInt(o.sales)}
                  </strong>
                  {o.refunded > 0 && (
                    <span className="block text-xs text-v2-nevoa/60">
                      {fmtInt(o.refunded)} reembolsada{o.refunded === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Surface>
    </section>
  );
}
