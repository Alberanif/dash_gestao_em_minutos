"use client";

import type { DebriefingProduct } from "@/types/indicadores";
import { toggleProductSelection } from "@/lib/indicadores/debriefing-selection";
import { cx, foco } from "../../ui/cx";

const chip =
  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm ring-1 ring-inset";
const repouso = "bg-v2-casco text-v2-nevoa/80 ring-v2-azul-luz/20 hover:ring-v2-azul-luz/45";
// Âmbar (--v2-ponto) é a cor do foco do momento: aqui, só o chip selecionado.
const selecionado = "bg-v2-ponto/15 text-v2-ponto ring-v2-ponto/60";

/**
 * Fileira de chips dos produtos principais. Vazio = "Todos"; multisseleção; marcar todos volta a vazio
 * (`toggleProductSelection`). Some com 1 produto. Quebra linha no desktop e rola na horizontal no celular.
 */
export function SeletorProdutos({
  produtos,
  selecionados,
  onChange,
}: {
  produtos: DebriefingProduct[];
  /** Ids selecionados; vazio = Todos. */
  selecionados: string[];
  onChange: (ids: string[]) => void;
}) {
  if (produtos.length <= 1) return null;
  const todos = produtos.map((p) => p.product_id);

  return (
    <div
      role="group"
      aria-label="Produtos"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 @xl:flex-wrap @xl:overflow-visible"
    >
      <button
        type="button"
        aria-pressed={selecionados.length === 0}
        onClick={() => onChange([])}
        className={cx(chip, selecionados.length === 0 ? selecionado : repouso, foco)}
      >
        Todos
      </button>
      {produtos.map((p) => {
        const ativo = selecionados.includes(p.product_id);
        return (
          <button
            key={p.product_id}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(toggleProductSelection(selecionados, p.product_id, todos))}
            className={cx(chip, "max-w-[22rem] truncate", ativo ? selecionado : repouso, foco)}
          >
            {p.product_name}
          </button>
        );
      })}
    </div>
  );
}
