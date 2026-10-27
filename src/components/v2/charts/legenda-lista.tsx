"use client";

import { cx } from "../ui/cx";

export type ItemLegendaLista = {
  id: string;
  label: string;
  cor: string;
  /** Parte do todo, de 0 a 1. */
  parte: number;
  percentual: string;
  quantidade: string;
};

/**
 * Legenda em lista: uma linha por item, com chave de cor, nome truncado, barrinha de proporção
 * e percentual + quantidade alinhados à direita. Decorativa para leitores de tela (a tabela cobre).
 * Passar o mouse numa linha ativa o item correspondente no gráfico.
 */
export function LegendaLista({
  itens,
  ativo,
  onAtivo,
  className,
}: {
  itens: ReadonlyArray<ItemLegendaLista>;
  ativo: number | null;
  onAtivo: (i: number | null) => void;
  className?: string;
}) {
  return (
    <ul aria-hidden="true" className={cx("m-0 min-w-0 list-none space-y-2.5 p-0 text-xs text-v2-nevoa/80", className)}>
      {itens.map((it, i) => (
        <li
          key={it.id}
          title={it.label}
          onPointerEnter={() => onAtivo(i)}
          onPointerLeave={() => onAtivo(null)}
          className="min-w-0 transition-opacity duration-150"
          style={{ opacity: ativo === null || ativo === i ? 1 : 0.5 }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.cor }} />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <span className="shrink-0 text-right font-semibold tabular-nums text-v2-nevoa">{it.percentual}</span>
            <span className="w-14 shrink-0 text-right tabular-nums text-v2-nevoa/70">{it.quantidade}</span>
          </div>
          <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-v2-nevoa/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(1, it.parte)) * 100}%`, background: it.cor }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
