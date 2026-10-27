"use client";

import { useMemo } from "react";
import { cx, foco } from "../ui/cx";
import { etapasFunil, formatarPercentual, formatarValor, passoFunil } from "./geometry";
import { COR, corFunil } from "./palette";
import { CamadaAnimada, EstadoVazio, TabelaDados, TooltipGrafico } from "./parts";
import { useItemAtivo, useLarguraMedida } from "./use-chart";

export type EtapaDoFunil = { id: string; label: string; value: number };

export type FunnelChartProps = {
  titulo: string;
  etapas: ReadonlyArray<EtapaDoFunil>;
  formatarValor?: (n: number) => string;
  animKey?: string;
  className?: string;
};

const LINHA_TEXTO = 20;
const ALTURA_ETAPA = 28;
const ESPACO = 14;
const PISO = 0.04; // etapa zerada ainda aparece como um filete
const LARG_CHAR = 6.4; // largura média de um caractere a 12px, para truncar sem medir o DOM
const FOLGA = 12; // respiro mínimo entre o nome e o valor

function truncar(texto: string, maxPx: number): string {
  const max = Math.floor(maxPx / LARG_CHAR);
  if (texto.length <= max) return texto;
  if (max <= 1) return "";
  return `${texto.slice(0, max - 1).trimEnd()}…`;
}

/** Funil de conversão: largura proporcional à primeira etapa, rampa ordinal de um tom, conversão por etapa. */
export function FunnelChart({ titulo, etapas, formatarValor: fmt = formatarValor, animKey, className }: FunnelChartProps) {
  const { ref, largura } = useLarguraMedida<HTMLDivElement>();
  const validas = useMemo(() => etapas.filter((e) => Number.isFinite(e.value) && e.value >= 0), [etapas]);
  const altura = validas.length * (LINHA_TEXTO + ALTURA_ETAPA + ESPACO) - ESPACO;
  const vazio = validas.length === 0 || validas[0].value === 0;

  return (
    <div ref={ref} className={className}>
      {vazio ? (
        <EstadoVazio titulo="Sem dados no período" dica="Ajuste o período ou os filtros." altura={160} />
      ) : largura > 0 ? (
        <FunilInterno
          titulo={titulo}
          etapas={validas}
          largura={largura}
          altura={altura}
          fmt={fmt}
          animKey={animKey ?? validas.map((e) => `${e.id}:${e.value}`).join("|")}
        />
      ) : (
        <div style={{ height: altura }} />
      )}
    </div>
  );
}

function FunilInterno({
  titulo,
  etapas,
  largura,
  altura,
  fmt,
  animKey,
}: {
  titulo: string;
  etapas: ReadonlyArray<EtapaDoFunil>;
  largura: number;
  altura: number;
  fmt: (n: number) => string;
  animKey: string;
}) {
  const { ativo, setAtivo, handlers } = useItemAtivo(etapas.length);
  const conv = useMemo(() => etapasFunil(etapas.map((e) => e.value)), [etapas]);
  const centro = largura / 2;
  const larg = conv.map((c) => Math.max(PISO, c.pctDoTotal) * largura);

  const textoAtivo =
    ativo !== null
      ? `${etapas[ativo].label}: ${fmt(etapas[ativo].value)}, ${formatarPercentual(conv[ativo].pctDoTotal)} do total` +
        (conv[ativo].pctDaAnterior !== null ? `, ${formatarPercentual(conv[ativo].pctDaAnterior!)} da etapa anterior` : "")
      : "";

  return (
    <div className="relative">
      <div
        role="group"
        aria-roledescription="funil"
        aria-label={`${titulo}. Use as setas para percorrer as etapas.`}
        tabIndex={0}
        className={cx("relative rounded-v2-sm", foco)}
        {...handlers}
      >
        <svg width={largura} height={altura} aria-hidden="true" className="block overflow-visible">
          <CamadaAnimada animKey={animKey}>
            {etapas.map((e, i) => {
              const topo = i * (LINHA_TEXTO + ALTURA_ETAPA + ESPACO);
              const y0 = topo + LINHA_TEXTO;
              const y1 = y0 + ALTURA_ETAPA;
              const wTopo = larg[i];
              // Cada etapa afunila até a largura da próxima; a última afunila um pouco.
              const wBase = i < etapas.length - 1 ? larg[i + 1] : wTopo * 0.85;
              const pontos = [
                [centro - wTopo / 2, y0],
                [centro + wTopo / 2, y0],
                [centro + wBase / 2, y1],
                [centro - wBase / 2, y1],
              ]
                .map((p) => p.join(","))
                .join(" ");
              const pct = conv[i].pctDaAnterior !== null ? formatarPercentual(conv[i].pctDaAnterior!) : null;
              const base = fmt(e.value);
              // Em tela estreita o "da anterior" cai e fica só o percentual; o nome ganha o resto da linha.
              const completo = pct ? `${base} · ${pct} da anterior` : base;
              const curto = pct ? `${base} · ${pct}` : base;
              const direita = largura - completo.length * LARG_CHAR >= largura * 0.5 ? completo : curto;
              const maxNome = largura - direita.length * LARG_CHAR - FOLGA;
              return (
                <g key={e.id}>
                  <text x={0} y={topo + 13} fontSize={12} fill={COR.texto}>
                    <title>{e.label}</title>
                    {truncar(e.label, maxNome)}
                  </text>
                  <text x={largura} y={topo + 13} fontSize={12} textAnchor="end" fill={COR.textoMudo}>
                    {direita}
                  </text>
                  <polygon
                    points={pontos}
                    fill={corFunil(passoFunil(i, etapas.length))}
                    className="v2-g v2-g-cresce v2-g-centro transition-opacity duration-150"
                    style={{ "--i": i, opacity: ativo === null || ativo === i ? 1 : 0.5 } as React.CSSProperties}
                  />
                  <rect
                    x={0}
                    y={topo}
                    width={largura}
                    height={LINHA_TEXTO + ALTURA_ETAPA}
                    fill="transparent"
                    onPointerEnter={() => setAtivo(i)}
                    onPointerDown={() => setAtivo(i)}
                    onPointerLeave={() => setAtivo(null)}
                  />
                </g>
              );
            })}
          </CamadaAnimada>
        </svg>
        {ativo !== null ? (
          <TooltipGrafico
            x={centro + larg[ativo] / 2}
            y={ativo * (LINHA_TEXTO + ALTURA_ETAPA + ESPACO) + LINHA_TEXTO}
            larguraContainer={largura}
            titulo={etapas[ativo].label}
            linhas={[
              { cor: corFunil(passoFunil(ativo, etapas.length)), rotulo: "etapa", valor: fmt(etapas[ativo].value) },
              { cor: COR.eixo, rotulo: "do total", valor: formatarPercentual(conv[ativo].pctDoTotal) },
            ]}
          />
        ) : null}
        <div aria-live="polite" className="sr-only">
          {textoAtivo}
        </div>
        <TabelaDados
          legenda={titulo}
          colunas={["Etapa", "Valor", "Do total", "Da etapa anterior"]}
          linhas={etapas.map((e, i) => [
            e.label,
            fmt(e.value),
            formatarPercentual(conv[i].pctDoTotal),
            conv[i].pctDaAnterior === null ? "-" : formatarPercentual(conv[i].pctDaAnterior!),
          ])}
        />
      </div>
    </div>
  );
}
