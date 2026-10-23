"use client";

import { useId, useState } from "react";
import { CountUp } from "../motion/count-up";
import { durFluxo } from "../motion/variants";
import { usePerfilMovimento } from "../motion/use-perfil-movimento";
import { useVisto } from "../motion/use-visto";
import { corDado } from "../cor";
import { cx, foco } from "../ui/cx";
import { ETAPAS } from "./dados";
import { fmtDecimal, fmtNum } from "./format";
import { SeloIcone } from "./icones";

const corDaEtapa = (i: number) => corDado(ETAPAS[i]?.dado ?? "alcance");

export type EtapaFluxo = { label: string; value: number };
export type TaxaFluxo = { label: string; pct: number | null };

/** De onde vem cada número, na mesma ordem. */
const ORIGENS = ["Meta Ads", "Meta Ads", "Meta Ads", "Captação de leads", "Hotmart"];

function Pino({ x, y, cor }: { x: number; y: number; cor: string }) {
  return <circle cx={x} cy={y} r={3} className="fill-v2-casco-alto" stroke={cor} strokeWidth={1.5} />;
}

/**
 * Corda entre duas etapas, com uma leve barriga caída. Sai de um pino e chega a outro: horizontal em tela larga,
 * vertical em tela estreita. Sem taxa calculável a corda fica tracejada e não se traça: só aparece.
 */
function Corda({ indice, tracejada, escurecida, idBase }: { indice: number; tracejada: boolean; escurecida: boolean; idBase: string }) {
  const de = corDaEtapa(indice);
  const para = corDaEtapa(indice + 1);
  const idH = `${idBase}-h${indice}`;
  const idV = `${idBase}-v${indice}`;
  const comum = {
    fill: "none",
    strokeWidth: 1.5,
    strokeLinecap: "round",
  } as const;
  // A corda leva a cor da etapa de saída até a da chegada. Sem taxa, fica tracejada e neutra.
  const traco = (id: string) =>
    tracejada
      ? { className: "v2-g v2-fl-corda v2-fl-corda-vazia", strokeDasharray: "3 6", stroke: "currentColor" }
      : { className: "v2-g v2-fl-corda", pathLength: 1, strokeDasharray: 1, stroke: `url(#${id})` };
  const estilo = { "--i": indice } as React.CSSProperties;
  const classes = cx("pointer-events-none absolute text-v2-azul-luz/60 transition-opacity duration-150", escurecida && "opacity-30");
  const gradiente = (id: string, vertical: boolean) => (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 0}>
        <stop offset="0" stopColor={de} />
        <stop offset="1" stopColor={para} />
      </linearGradient>
    </defs>
  );
  const pino = tracejada ? ["var(--v2-azul-luz)", "var(--v2-azul-luz)"] : [de, para];
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 72 48"
        className={cx(classes, "left-full top-1/2 hidden h-12 w-[72px] -translate-y-1/2 overflow-visible @5xl:block")}
      >
        {gradiente(idH, false)}
        <path d="M0 24 Q36 46 72 24" style={estilo} {...comum} {...traco(idH)} />
        <Pino x={0} y={24} cor={pino[0]} />
        <Pino x={72} y={24} cor={pino[1]} />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 48 56"
        className={cx(classes, "left-3 top-full block h-14 w-12 overflow-visible @5xl:hidden")}
      >
        {gradiente(idV, true)}
        <path d="M24 0 Q6 28 24 56" style={estilo} {...comum} {...traco(idV)} />
        <Pino x={24} y={0} cor={pino[0]} />
        <Pino x={24} y={56} cor={pino[1]} />
      </svg>
    </>
  );
}

/** Selo da taxa de conversão, pendurado no meio da corda. */
function Taxa({ indice, taxa, escurecida }: { indice: number; taxa: TaxaFluxo; escurecida: boolean }) {
  const cor = corDaEtapa(indice + 1);
  const texto = taxa.pct === null ? "—" : `${fmtDecimal(taxa.pct, 2)}%`;
  return (
    <span
      aria-hidden="true"
      title={taxa.label}
      style={{ "--i": indice } as React.CSSProperties}
      className="v2-g v2-fl-taxa absolute left-9 top-[calc(100%+28px)] z-10 -translate-x-1/2 -translate-y-1/2 @5xl:left-[calc(100%+36px)] @5xl:top-1/2"
    >
      <span
        style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} ${taxa.pct === null ? 20 : 55}%, transparent)` }}
        className={cx(
          "block whitespace-nowrap rounded-full bg-v2-abismo px-2 py-0.5 text-[11px] font-medium tabular-nums text-v2-nevoa transition-opacity duration-150",
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
  const idBase = `v2-corda-${useId().replace(/:/g, "")}`;

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
                  "relative flex h-full items-center gap-3 overflow-hidden rounded-v2-md bg-v2-casco p-4 shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15 transition-opacity duration-150 @5xl:flex-col @5xl:items-start @5xl:gap-3",
                  escurecido && "opacity-45",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx("pointer-events-none absolute inset-0 rounded-v2-md transition-opacity duration-150", ativo === i ? "opacity-100" : "opacity-0")}
                  style={{ boxShadow: `inset 0 0 42px color-mix(in srgb, ${corDaEtapa(i)} 20%, transparent)` }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ background: `linear-gradient(90deg, ${corDaEtapa(i)}, transparent 85%)` }}
                />
                <SeloIcone nome={ETAPAS[i]?.icone ?? "impressoes"} dado={ETAPAS[i]?.dado ?? "alcance"} />
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
                  <Corda idBase={idBase} indice={i} tracejada={taxas[i]?.pct === null || taxas[i] === undefined} escurecida={cordaEscura} />
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
