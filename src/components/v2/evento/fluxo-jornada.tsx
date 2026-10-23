"use client";

import { useState } from "react";
import { CountUp } from "../motion/count-up";
import { durFluxo } from "../motion/variants";
import { usePerfilMovimento } from "../motion/use-perfil-movimento";
import { useVisto } from "../motion/use-visto";
import { cx, foco } from "../ui/cx";
import { fmtDecimal, fmtNum } from "./format";

export type EtapaFluxo = { label: string; value: number };
export type TaxaFluxo = { label: string; pct: number | null };

const TRACO = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Um ícone de traço fino por etapa, na ordem do funil: impressões, cliques, página, leads, vendas. */
const ICONES: Array<React.ReactNode> = [
  <g key="0">
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" {...TRACO} />
    <circle cx="12" cy="12" r="3" {...TRACO} />
  </g>,
  <path key="cursor" d="M6 3.5 18 12l-5.2 1.3L10.6 19 6 3.5Z" {...TRACO} />,
  <g key="1">
    <rect x="4" y="4" width="16" height="16" rx="2.5" {...TRACO} />
    <path d="M4 9h16M8 13h5M8 16.5h8" {...TRACO} />
  </g>,
  <g key="2">
    <circle cx="12" cy="8" r="3.5" {...TRACO} />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...TRACO} />
  </g>,
  <g key="3">
    <path d="M5.5 8h13l-1 11.5h-11L5.5 8Z" {...TRACO} />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8M9.5 13.5l2 2 3.5-3.8" {...TRACO} />
  </g>,
];

/** De onde vem cada número, na mesma ordem. */
const ORIGENS = ["Meta Ads", "Meta Ads", "Meta Ads", "Captação de leads", "Hotmart"];

function Selo({ indice }: { indice: number }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-v2-casco-alto text-v2-azul-luz ring-1 ring-inset ring-v2-azul-luz/25">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        {ICONES[indice] ?? ICONES[0]}
      </svg>
    </span>
  );
}

function Pino({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={3} className="fill-v2-casco-alto stroke-v2-azul-luz/70" strokeWidth={1.25} />;
}

/**
 * Corda entre duas etapas, com uma leve barriga caída. Sai de um pino e chega a outro: horizontal em tela larga,
 * vertical em tela estreita. Sem taxa calculável a corda fica tracejada e não se traça: só aparece.
 */
function Corda({ indice, tracejada, escurecida }: { indice: number; tracejada: boolean; escurecida: boolean }) {
  const comum = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
  } as const;
  const traco = tracejada
    ? { className: "v2-g v2-fl-corda v2-fl-corda-vazia", strokeDasharray: "3 6" }
    : { className: "v2-g v2-fl-corda", pathLength: 1, strokeDasharray: 1 };
  const estilo = { "--i": indice } as React.CSSProperties;
  const classes = cx("pointer-events-none absolute text-v2-azul-luz/60 transition-opacity duration-150", escurecida && "opacity-30");
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 72 48"
        className={cx(classes, "left-full top-1/2 hidden h-12 w-[72px] -translate-y-1/2 overflow-visible @5xl:block")}
      >
        <path d="M0 24 Q36 46 72 24" style={estilo} {...comum} {...traco} />
        <Pino x={0} y={24} />
        <Pino x={72} y={24} />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 48 56"
        className={cx(classes, "left-3 top-full block h-14 w-12 overflow-visible @5xl:hidden")}
      >
        <path d="M24 0 Q6 28 24 56" style={estilo} {...comum} {...traco} />
        <Pino x={24} y={0} />
        <Pino x={24} y={56} />
      </svg>
    </>
  );
}

/** Selo da taxa de conversão, pendurado no meio da corda. */
function Taxa({ indice, taxa, escurecida }: { indice: number; taxa: TaxaFluxo; escurecida: boolean }) {
  const texto = taxa.pct === null ? "—" : `${fmtDecimal(taxa.pct, 2)}%`;
  return (
    <span
      aria-hidden="true"
      title={taxa.label}
      style={{ "--i": indice } as React.CSSProperties}
      className="v2-g v2-fl-taxa absolute left-9 top-[calc(100%+28px)] z-10 -translate-x-1/2 -translate-y-1/2 @5xl:left-[calc(100%+36px)] @5xl:top-1/2"
    >
      <span
        className={cx(
          "block whitespace-nowrap rounded-full bg-v2-abismo px-2 py-0.5 text-[11px] font-medium tabular-nums text-v2-nevoa/85 ring-1 ring-inset ring-v2-azul-luz/30 transition-opacity duration-150",
          escurecida && "opacity-30",
        )}
      >
        {texto}
      </span>
    </span>
  );
}

/**
 * Jornada de conversão como um fluxo: um card por etapa, ligados por cordas que levam a taxa de conversão.
 * Entra em sequência, da primeira à última etapa, quando fica visível; a última recebe o ponto âmbar.
 * Passar o mouse ou focar um card destaca o card e as duas cordas vizinhas.
 */
export function FluxoJornada({ etapas, taxas, className }: { etapas: ReadonlyArray<EtapaFluxo>; taxas: ReadonlyArray<TaxaFluxo>; className?: string }) {
  const { ref, visto } = useVisto<HTMLDivElement>();
  const perfil = usePerfilMovimento();
  const [ativo, setAtivo] = useState<number | null>(null);
  const passo = perfil === "curto" ? durFluxo.passoCurto : durFluxo.passo;
  const ultima = etapas.length - 1;

  return (
    <div ref={ref} data-gate="" data-visto={visto ? "" : undefined} className={className}>
      <ol className="flex flex-col gap-14 @5xl:flex-row @5xl:items-stretch @5xl:gap-[72px]">
        {etapas.map((etapa, i) => {
          const taxa = i > 0 ? taxas[i - 1] : undefined;
          const escurecido = ativo !== null && ativo !== i;
          // A corda i liga a etapa i à seguinte: acende com qualquer uma das duas.
          const cordaEscura = ativo !== null && ativo !== i && ativo !== i + 1;
          return (
            <li
              key={i}
              tabIndex={0}
              style={{ "--i": i } as React.CSSProperties}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              className={cx("v2-g v2-fl-card relative min-w-0 rounded-v2-md @5xl:flex-1", foco)}
            >
              <div
                className={cx(
                  "flex h-full items-center gap-3 rounded-v2-md bg-v2-casco p-4 shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15 transition-opacity duration-150 @5xl:flex-col @5xl:items-start @5xl:gap-3",
                  escurecido && "opacity-45",
                )}
              >
                <Selo indice={i} />
                <div className="min-w-0">
                  <p className="text-xs text-v2-nevoa/70">{etapa.label}</p>
                  <p className="mt-0.5 truncate text-xl font-semibold tabular-nums tracking-tight">
                    <CountUp value={etapa.value} format={fmtNum} atraso={i * passo} />
                  </p>
                  <p className="mt-1 truncate text-[11px] text-v2-nevoa/50">{ORIGENS[i]}</p>
                </div>
                {taxa ? (
                  <span className="sr-only">
                    {taxa.label}: {taxa.pct === null ? "sem taxa calculável" : `${fmtDecimal(taxa.pct, 2)}%`}
                  </span>
                ) : null}
              </div>
              {i === ultima ? (
                <span aria-hidden="true" className="absolute right-3 top-3 size-2" style={{ "--i": i } as React.CSSProperties}>
                  <span className="v2-g v2-g-ponto v2-fl-ponto absolute inset-0 rounded-full bg-v2-ponto shadow-v2-brilho-ponto" />
                  <span className="v2-g v2-g-pulso v2-fl-pulso absolute inset-0 rounded-full border border-v2-ponto" />
                </span>
              ) : null}
              {i < ultima ? (
                <>
                  <Corda indice={i} tracejada={taxas[i]?.pct === null || taxas[i] === undefined} escurecida={cordaEscura} />
                  {taxas[i] ? <Taxa indice={i} taxa={taxas[i]} escurecida={cordaEscura} /> : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
