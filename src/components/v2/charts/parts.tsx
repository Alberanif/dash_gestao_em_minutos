"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { fadeRise, instantaneo } from "../motion/variants";
import { useReducedMotion } from "../motion/use-reduced-motion";

/** Troca de série ou de filtro: o conteúdo anterior sai e o novo entra, só com opacity e translateY. */
export function CamadaAnimada({ animKey, children }: { animKey: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  // LazyMotion aqui: o gráfico funciona em qualquer tela, sem depender de um provedor acima (sem ele o `m.g` fica em opacity 0).
  // O chunk do gráfico já é sob demanda, então as features não pesam no JS inicial.
  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait" initial>
        <m.g
          key={animKey}
          variants={reduced ? instantaneo : fadeRise}
          initial="oculto"
          animate="visivel"
          exit="saindo"
        >
          {children}
        </m.g>
      </AnimatePresence>
    </LazyMotion>
  );
}

export type LinhaTooltip = { cor: string; rotulo: string; valor: string };

/**
 * Tooltip de um gráfico. Posicionado só por transform. O valor lidera (forte) e o nome vem depois;
 * a chave de cada linha é um traço curto da cor da série, não uma caixa.
 */
export function TooltipGrafico({
  x,
  y,
  larguraContainer,
  titulo,
  linhas,
}: {
  x: number;
  y: number;
  larguraContainer: number;
  titulo: string;
  linhas: ReadonlyArray<LinhaTooltip>;
}) {
  const L = 176;
  const aEsquerda = x + 12 + L > larguraContainer;
  const dx = aEsquerda ? x - 12 - L : x + 12;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-10 rounded-v2-sm bg-v2-casco-alto p-2.5 text-xs shadow-v2-2 ring-1 ring-inset ring-v2-azul-luz/20"
      style={{ width: L, transform: `translate(${Math.max(0, dx)}px, ${Math.max(0, y)}px)` }}
    >
      <p className="mb-1.5 text-v2-nevoa/70">{titulo}</p>
      <ul className="space-y-1">
        {linhas.map((l, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: l.cor }} />
            <span className="text-sm font-semibold text-v2-nevoa">{l.valor}</span>
            <span className="truncate text-v2-nevoa/70">{l.rotulo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legenda com chave igual à marca (traço para linha, quadrado para barra), texto sempre em tinta neutra. */
export function Legenda({
  itens,
  forma = "traco",
}: {
  itens: ReadonlyArray<{ cor: string; rotulo: string }>;
  forma?: "traco" | "quadrado";
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-v2-nevoa/80">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-1.5">
          <span
            className={forma === "traco" ? "h-0.5 w-3 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"}
            style={{ background: i.cor }}
          />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}

/** Estado vazio com direção: diz o que aconteceu e o que fazer. */
export function EstadoVazio({ titulo, dica, altura }: { titulo: string; dica?: string; altura: number }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-1 rounded-v2-sm text-center ring-1 ring-inset ring-v2-azul-luz/10"
      style={{ minHeight: altura }}
    >
      <p className="text-sm text-v2-nevoa/80">{titulo}</p>
      {dica ? <p className="text-xs text-v2-nevoa/60">{dica}</p> : null}
    </div>
  );
}

/** Visão em tabela para leitor de tela: todo valor do gráfico chega sem depender do mouse. */
export function TabelaDados({
  legenda,
  colunas,
  linhas,
}: {
  legenda: string;
  colunas: ReadonlyArray<string>;
  linhas: ReadonlyArray<ReadonlyArray<string>>;
}) {
  // O sr-only vai num div: em <table> o conteúdo ignora a largura de 1px e alarga a rolagem da página no celular.
  return (
    <div className="sr-only">
      <table>
        <caption>{legenda}</caption>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>
              {l.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
