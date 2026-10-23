"use client";

import { useMemo } from "react";
import { LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { useVisto } from "../motion/use-visto";
import { formatarPercentual, formatarValor, xDomain, type XY } from "./geometry";
import { COR } from "./palette";
import { escalaLinear } from "./scales";

export type SparklineProps = {
  /** Valores em ordem cronológica. */
  valores: ReadonlyArray<number>;
  largura?: number;
  altura?: number;
  /** Complemento do nome acessível, por exemplo "Receita". */
  rotulo?: string;
  /** Cor da métrica (token CSS). Padrão: azul IGT. */
  cor?: string;
  className?: string;
};

const PAD = 5; // folga para o ponto e o anel não serem cortados

/**
 * Tendência em miniatura para tile de KPI: sem eixos nem tooltip, com nome acessível que resume
 * início, fim e variação. O último ponto é o âmbar.
 */
export function Sparkline({ valores, largura = 96, altura = 28, rotulo = "Tendência", cor = "var(--v2-azul-igt)", className }: SparklineProps) {
  const { ref, visto } = useVisto<SVGSVGElement>();
  const pontos = useMemo<XY[]>(
    () => valores.flatMap((v, i) => (Number.isFinite(v) ? [{ x: i, y: v }] : [])),
    [valores],
  );

  const escalas = useMemo(() => {
    // Sem zero forçado: a linha mostra a forma da tendência, não a magnitude.
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pontos) {
      if (p.y < lo) lo = p.y;
      if (p.y > hi) hi = p.y;
    }
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    return {
      x: escalaLinear(xDomain(pontos.map((p) => p.x), 1), [PAD, largura - PAD]),
      y: escalaLinear([lo, hi], [altura - PAD, PAD]),
    };
  }, [pontos, largura, altura]);

  if (pontos.length === 0) {
    return <span role="img" aria-label={`${rotulo}: sem dados`} className={className} style={{ display: "inline-block", width: largura, height: altura }} />;
  }

  const primeiro = pontos[0].y;
  const ultimo = pontos[pontos.length - 1];
  const nome =
    pontos.length === 1
      ? `${rotulo}: ${formatarValor(ultimo.y)}`
      : `${rotulo}: de ${formatarValor(primeiro)} para ${formatarValor(ultimo.y)}` +
        (primeiro !== 0 ? ` (${formatarPercentual((ultimo.y - primeiro) / Math.abs(primeiro))})` : "");

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={nome}
      width={largura}
      height={altura}
      className={className}
      style={{ overflow: "visible" }}
      data-gate=""
      data-visto={visto ? "" : undefined}
    >
      {pontos.length > 1 ? (
        <g className="v2-g v2-g-traco">
          <LinePath<XY>
            data={pontos}
            x={(d) => escalas.x(d.x)}
            y={(d) => escalas.y(d.y)}
            curve={curveMonotoneX}
            stroke={cor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}
      <circle
        className="v2-g v2-g-ponto"
        data-ponto-vivo=""
        cx={escalas.x(ultimo.x)}
        cy={escalas.y(ultimo.y)}
        r={3.5}
        fill={COR.ponto}
        stroke={COR.superficie}
        strokeWidth={2}
        style={{ filter: COR.brilhoPonto }}
      />
    </svg>
  );
}
