"use client";

import type { VendasViewRecord } from "@/types/vendas";
import type { ViewGroup } from "@/lib/vendas/views";
import { Select } from "../ui";
import { cx, foco } from "../ui/cx";

type PainelProps = {
  grupos: ViewGroup[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
  onAlternarPasta: (grupoId: string) => void;
};

function contagem(n: number): string {
  return `${n} ${n === 1 ? "visualização" : "visualizações"}`;
}

/**
 * Lista de pastas e visualizações. Em telas largas é um painel ao lado do
 * dashboard; no celular vira um Select agrupado por pasta, no topo.
 * A visualização selecionada é a única com marca âmbar.
 */
export function PainelVisualizacoes({ grupos, selecionadaId, onSelecionar, onAlternarPasta }: PainelProps) {
  const opcoes = grupos.flatMap((g) =>
    g.items.map((v: VendasViewRecord) => ({ value: v.id, label: v.name, grupo: g.name })),
  );

  return (
    <div data-testid="vendas-view-selector">
      <div className="md:hidden">
        <Select
          aria-label="Visualização"
          value={selecionadaId ?? undefined}
          onValueChange={onSelecionar}
          opcoes={opcoes}
          placeholder="Escolha uma visualização"
        />
      </div>

      <nav aria-label="Visualizações" className="hidden flex-col gap-4 md:flex">
        {grupos.map((g) => (
          <section key={g.id} data-testid={`folder-section-${g.id}`} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                data-testid={`folder-toggle-btn-${g.id}`}
                aria-expanded={g.isExpanded}
                aria-controls={`pasta-${g.id}`}
                onClick={() => onAlternarPasta(g.id)}
                className={cx(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-v2-sm px-2 py-1.5 text-left text-sm font-semibold text-v2-nevoa",
                  foco,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx("shrink-0 text-v2-nevoa/55 transition-transform duration-[120ms]", g.isExpanded && "rotate-90")}
                >
                  ▸
                </span>
                <span className="truncate">{g.name}</span>
                <span className="shrink-0 text-xs font-normal text-v2-nevoa/55">{contagem(g.items.length)}</span>
              </button>
            </div>

            {g.isExpanded && (
              <ul id={`pasta-${g.id}`} className="flex flex-col gap-0.5 pl-3">
                {g.items.length === 0 ? (
                  <li className="px-3 py-1.5 text-xs text-v2-nevoa/55">Nenhuma visualização nesta pasta</li>
                ) : (
                  g.items.map((v) => {
                    const ativa = v.id === selecionadaId;
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          data-testid={`vendas-view-option-${v.id}`}
                          aria-pressed={ativa}
                          onClick={() => onSelecionar(v.id)}
                          className={cx(
                            "w-full truncate rounded-v2-sm border-l-2 px-3 py-2 text-left text-sm",
                            ativa
                              ? "border-v2-ponto bg-v2-casco-alto font-medium text-v2-nevoa"
                              : "border-transparent text-v2-nevoa/75 hover:bg-v2-nevoa/5",
                            foco,
                          )}
                        >
                          {v.name}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </section>
        ))}
      </nav>
    </div>
  );
}
