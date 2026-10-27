"use client";

import { useRef } from "react";
import { cx, foco } from "../ui/cx";

export type OpcaoSegmentada<V extends string> = { value: V; label: string };

/**
 * Seletor segmentado com o papel ARIA de abas (tablist/tab), setas, Home e End.
 * Existe no lugar do Tabs do Radix só nesta rota: ele sozinho custa ~9 KB gzip e
 * a rota do evento está colada no orçamento de 180 KB. Mesmo visual do TabsList.
 * `valor` nulo (período personalizado) deixa nenhuma aba marcada e a primeira focável.
 */
export function Segmentado<V extends string>({
  valor,
  onChange,
  opcoes,
  rotulo,
  idPainel,
  vidro,
  plataforma,
}: {
  valor: V | null;
  onChange: (v: V) => void;
  opcoes: OpcaoSegmentada<V>[];
  rotulo: string;
  /** Quando as abas controlam um painel, o id dele (aria-controls). */
  idPainel?: string;
  /** Sobre a barra de vidro do herói: fundo escuro translúcido e a aba ativa em azul-luz. */
  vidro?: boolean;
  /** Aba ativa na cor da plataforma (var(--plat) do ancestral .v2-plat). */
  plataforma?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = Math.max(
    0,
    opcoes.findIndex((o) => o.value === valor),
  );

  function aoTeclar(e: React.KeyboardEvent, i: number) {
    const ultimo = opcoes.length - 1;
    const proximo =
      e.key === "ArrowRight" ? (i === ultimo ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? ultimo : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? ultimo
      : null;
    if (proximo === null) return;
    e.preventDefault();
    refs.current[proximo]?.focus();
    onChange(opcoes[proximo].value);
  }

  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className={cx(
        "inline-flex max-w-full flex-wrap gap-1 rounded-v2-sm p-1 ring-1 ring-inset ring-v2-azul-luz/15",
        vidro ? "bg-v2-abismo/40" : "bg-v2-casco",
      )}
    >
      {opcoes.map((o, i) => {
        const ativa = o.value === valor;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={ativa}
            aria-controls={idPainel}
            tabIndex={i === atual ? 0 : -1}
            data-state={ativa ? "active" : "inactive"}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={cx(
              "h-8 shrink-0 rounded-[6px] px-3 text-sm text-v2-nevoa/70",
              plataforma
                ? "v2-plat-aba"
                : vidro
                ? "data-[state=active]:bg-v2-azul-luz/15 data-[state=active]:text-v2-azul-luz data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-v2-azul-luz/35"
                : "data-[state=active]:bg-v2-casco-alto data-[state=active]:text-v2-nevoa data-[state=active]:shadow-v2-1",              foco,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
