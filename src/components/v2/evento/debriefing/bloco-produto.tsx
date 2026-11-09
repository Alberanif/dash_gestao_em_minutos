import React from "react";
import type { DebriefingProductMetrics } from "@/lib/indicadores/service/debriefing";
import { cx } from "../../ui/cx";
import { fmtBRL, fmtNum } from "./formatar";

const NUM = "tabular-nums text-right";
// Profundidade alternada, sem linhas de grade: pares no casco, ímpares um degrau acima.
const fundoLinha = (i: number) => (i % 2 === 1 ? "bg-v2-casco-alto/60" : "bg-transparent");

function rotuloVendas(n: number) {
  return `${fmtNum(n)} ${n === 1 ? "venda" : "vendas"}`;
}

/**
 * Bloco de um produto no Debriefing: cabeçalho (nome, vendas, faturamento) e ofertas na ordem recebida.
 * Desktop: tabela com `th scope`. Celular (< 640 px): lista, sem rolagem horizontal.
 * Puramente visual: não calcula nada, só mostra o que a V1 já mostra.
 */
export function BlocoProduto({
  produto,
  semCabecalho = false,
}: {
  produto: DebriefingProductMetrics;
  /** Com um produto só, o bloco não repete o cabeçalho. */
  semCabecalho?: boolean;
}) {
  const titulo = `Ofertas de ${produto.product_name}`;
  const ofertas = produto.offers_breakdown;
  return (
    <section
      aria-label={semCabecalho ? titulo : undefined}
      aria-labelledby={semCabecalho ? undefined : `bloco-produto-${produto.product_id}`}
      data-testid="bloco-produto"
      className="min-w-0 rounded-v2-md bg-v2-casco p-4 shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/25 sm:p-5"
    >
      {semCabecalho ? null : (
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3
            id={`bloco-produto-${produto.product_id}`}
            className="min-w-0 break-words text-base font-semibold text-v2-nevoa"
          >
            {produto.product_name}
          </h3>
          <p className="tabular-nums text-sm text-v2-nevoa" data-testid="produto-totais">
            {rotuloVendas(produto.total_sales)} · {fmtBRL(produto.total_revenue_brl)}
          </p>
        </header>
      )}

      {ofertas.length === 0 ? (
        <p className="text-sm text-[var(--v2-texto-mudo)]">Nenhuma oferta com vendas no período.</p>
      ) : (
        <>
          <table className="hidden w-full border-collapse text-sm sm:table">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="text-xs text-[var(--v2-texto-mudo)]">
                <th scope="col" className="px-3 py-2 text-left font-medium">Oferta</th>
                <th scope="col" className={cx("px-3 py-2 font-medium", NUM)}>Vendas</th>
                <th scope="col" className={cx("px-3 py-2 font-medium", NUM)}>Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map((o, i) => (
                <tr key={o.offer_code} className={cx("text-v2-nevoa", fundoLinha(i))}>
                  <th scope="row" className="rounded-l-v2-sm px-3 py-2.5 text-left font-normal">{o.offer_name}</th>
                  <td className={cx("px-3 py-2.5", NUM)}>{fmtNum(o.sales_count)}</td>
                  <td className={cx("rounded-r-v2-sm px-3 py-2.5", NUM)}>{fmtBRL(o.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="m-0 list-none p-0 sm:hidden" aria-label={titulo}>
            {ofertas.map((o, i) => (
              <li key={o.offer_code} className={cx("rounded-v2-sm px-3 py-2.5 text-v2-nevoa", fundoLinha(i))}>
                <p className="break-words text-sm">{o.offer_name}</p>
                <p className="mt-0.5 tabular-nums text-xs text-[var(--v2-texto-mudo)]">
                  {rotuloVendas(o.sales_count)} · {fmtBRL(o.revenue)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Um bloco por produto, na ordem recebida; com um produto só, sem cabeçalho repetido. */
export function BlocosProdutos({ products }: { products: DebriefingProductMetrics[] }) {
  return (
    <div className="flex flex-col gap-4">
      {products.map((p) => (
        <BlocoProduto key={p.product_id} produto={p} semCabecalho={products.length === 1} />
      ))}
    </div>
  );
}
