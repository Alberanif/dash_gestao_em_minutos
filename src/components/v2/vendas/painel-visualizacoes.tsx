"use client";

import { useState } from "react";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";
import type { ViewGroup } from "@/lib/vendas/views";
import { Popover, PopoverContent, PopoverTrigger, Select } from "../ui";
import { cx, foco } from "../ui/cx";

type PainelProps = {
  grupos: ViewGroup[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
  onAlternarPasta: (grupoId: string) => void;
  /** Quem edita vê o menu da pasta (renomear, deletar). */
  canEdit?: boolean;
  onRenomearPasta?: (pasta: VendasFolderRecord) => void;
  onExcluirPasta?: (pasta: VendasFolderRecord) => void;
};

function MenuDaPasta({
  grupo,
  onRenomear,
  onExcluir,
  prefixo = "",
}: {
  grupo: ViewGroup;
  /** Distingue os data-testid da lista do celular, que convive no DOM com a do painel. */
  prefixo?: string;
  onRenomear?: (pasta: VendasFolderRecord) => void;
  onExcluir?: (pasta: VendasFolderRecord) => void;
}) {
  const [aberto, setAberto] = useState(false);
  if (!grupo.folder) return null;
  const pasta = grupo.folder;
  const item = "flex h-9 w-full items-center rounded-[6px] px-3 text-left text-sm hover:bg-v2-nevoa/10";
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`folder-menu-btn-${prefixo}${grupo.id}`}
          aria-label={`Ações da pasta ${pasta.name}`}
          className={cx("inline-flex size-9 shrink-0 items-center justify-center rounded-v2-sm text-v2-nevoa/70 hover:bg-v2-nevoa/10", foco)}
        >
          <span aria-hidden="true">⋯</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1.5" data-testid={`folder-dropdown-${prefixo}${grupo.id}`}>
        <button
          type="button"
          data-testid={`folder-rename-btn-${prefixo}${grupo.id}`}
          className={cx(item, "text-v2-nevoa", foco)}
          onClick={() => {
            setAberto(false);
            onRenomear?.(pasta);
          }}
        >
          Renomear
        </button>
        <button
          type="button"
          data-testid={`folder-delete-btn-${prefixo}${grupo.id}`}
          className={cx(item, "text-v2-queda", foco)}
          onClick={() => {
            setAberto(false);
            onExcluir?.(pasta);
          }}
        >
          Deletar
        </button>
      </PopoverContent>
    </Popover>
  );
}

function contagem(n: number): string {
  return `${n} ${n === 1 ? "visualização" : "visualizações"}`;
}

/**
 * Lista de pastas e visualizações. Em telas largas é um painel ao lado do
 * dashboard; no celular vira um Select agrupado por pasta, no topo.
 * A visualização selecionada é a única com marca âmbar.
 */
export function PainelVisualizacoes({ grupos, selecionadaId, onSelecionar, onAlternarPasta, canEdit = false, onRenomearPasta, onExcluirPasta }: PainelProps) {
  const pastasGerenciaveis = canEdit ? grupos.filter((g) => g.folder) : [];
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
        {pastasGerenciaveis.length > 0 && (
          <ul aria-label="Pastas" className="mt-3 flex flex-col gap-1">
            {pastasGerenciaveis.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 pl-1 text-sm text-v2-nevoa/75">
                <span className="truncate">{g.name}</span>
                <MenuDaPasta grupo={g} prefixo="movel-" onRenomear={onRenomearPasta} onExcluir={onExcluirPasta} />
              </li>
            ))}
          </ul>
        )}
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
              {canEdit && <MenuDaPasta grupo={g} onRenomear={onRenomearPasta} onExcluir={onExcluirPasta} />}
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
