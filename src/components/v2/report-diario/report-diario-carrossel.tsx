"use client";

import { useId, type CSSProperties } from "react";
import type { ReportFunil } from "@/lib/indicadores/report-diario-tipos";
import { corDado } from "../cor";
import { useVisto } from "../motion/use-visto";
import { cx } from "../ui/cx";
import { ReportDiarioCard } from "./report-diario-card";

export type ItemReport = {
  id: string;
  nome: string;
  /** Dashboard do evento. */
  href: string;
  /** null = a consulta deste funil falhou. */
  funil: ReportFunil | null;
};

type Props = {
  itens: ItemReport[];
  titulo?: string;
};

const COMUM = { fill: "none", strokeWidth: 1.5, strokeLinecap: "round" } as const;

function Pino({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3} className="fill-v2-casco-alto" stroke={corDado("lead")} strokeWidth={1.5} />;
}

/**
 * Corda entre dois cards, com uma leve barriga caída (a mesma da Jornada): horizontal em tela larga,
 * vertical em tela estreita. Só liga os funis; não carrega número.
 */
function Corda({ indice, idBase }: { indice: number; idBase: string }) {
  const idH = `${idBase}-h${indice}`;
  const idV = `${idBase}-v${indice}`;
  const estilo = { "--i": indice } as CSSProperties;
  const classes = "pointer-events-none absolute text-v2-azul-luz/60 overflow-visible";
  const gradiente = (id: string, vertical: boolean) => (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 0}>
        <stop offset="0" stopColor={corDado("lead")} />
        <stop offset="1" stopColor={corDado("custo")} />
      </linearGradient>
    </defs>
  );
  const traco = (id: string) => ({ className: "v2-g v2-fl-corda", pathLength: 1, strokeDasharray: 1, stroke: `url(#${id})` });
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 72 48" className={cx(classes, "left-full top-1/2 hidden h-12 w-[72px] -translate-y-1/2 @3xl:block")}>
        {gradiente(idH, false)}
        <path d="M0 24 Q36 46 72 24" style={estilo} {...COMUM} {...traco(idH)} />
        <Pino x={0} y={24} />
        <Pino x={72} y={24} />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 48 56" className={cx(classes, "left-3 top-full block h-14 w-12 @3xl:hidden")}>
        {gradiente(idV, true)}
        <path d="M24 0 Q6 28 24 56" style={estilo} {...COMUM} {...traco(idV)} />
        <Pino x={24} y={0} />
        <Pino x={24} y={56} />
      </svg>
    </>
  );
}

/**
 * Report Diário: um card por funil ativo, todos do mesmo tamanho e ligados por cordas, como a Jornada.
 * Os cards entram em sequência e as cordas se traçam quando a seção fica visível.
 */
export function ReportDiarioCarrossel({ itens, titulo = "Report diário" }: Props) {
  const { ref, visto } = useVisto<HTMLDivElement>();
  const idBase = `v2-report-${useId().replace(/:/g, "")}`;
  if (itens.length === 0) return null;
  const ultimo = itens.length - 1;

  return (
    <section aria-labelledby="report-diario-titulo" className="@container space-y-4">
      <div>
        <h2 id="report-diario-titulo" className="text-2xl font-light tracking-tight">
          {titulo}
        </h2>
        <p className="mt-1 text-sm text-v2-nevoa/60">Do início de cada ação até hoje.</p>
      </div>

      <div ref={ref} data-gate="" data-visto={visto ? "" : undefined}>
        <ol className="flex flex-col gap-14 @3xl:flex-row @3xl:items-stretch @3xl:gap-[72px]">
          {itens.map((it, i) => (
            <li
              key={it.id}
              style={{ "--i": i } as CSSProperties}
              className="v2-g v2-fl-card relative min-w-0 @3xl:max-w-sm @3xl:flex-1"
            >
              <ReportDiarioCard funil={it.funil} nome={it.nome} href={it.href} />
              {i < ultimo ? <Corda idBase={idBase} indice={i} /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
