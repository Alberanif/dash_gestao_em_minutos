"use client";

import { useMemo } from "react";
import { m } from "motion/react";
import { cx, foco } from "../ui/cx";
import { useReducedMotion } from "../motion/use-reduced-motion";
import { dur, easeSaida } from "../motion/variants";
import { caminhoBarra, formatarCompacto, formatarValor, yDomain } from "./geometry";
import { COR, corSerie } from "./palette";
import { escalaBanda, escalaLinear } from "./scales";
import { CamadaAnimada, EstadoVazio, TabelaDados, TooltipGrafico } from "./parts";
import { useItemAtivo, useLarguraMedida } from "./use-chart";

export type DadoBarra = { id: string; label: string; value: number };

export type BarChartProps = {
  titulo: string;
  data: ReadonlyArray<DadoBarra>;
  /** Colunas (padrão) ou barras horizontais, melhores para nomes longos. */
  orientacao?: "vertical" | "horizontal";
  /** Altura em colunas. Em barras horizontais a altura cresce com o número de barras. */
  altura?: number;
  formatarValor?: (n: number) => string;
  /** Índice da série na paleta. Padrão: 0 (azul IGT). Barras nominais usam todas a mesma cor. */
  serie?: number;
  animKey?: string;
  className?: string;
};

const ESPESSURA_MAX = 24;
const RAIO = 4;
const MARGEM = { topo: 16, direita: 16, base: 28, esquerda: 40 };

/** Colunas ou barras de uma única série nominal. Ponta arredondada no dado, base reta, no máximo 24px. */
export function BarChart({
  titulo,
  data,
  orientacao = "vertical",
  altura,
  formatarValor: formatarRotulo = formatarCompacto,
  serie = 0,
  animKey,
  className,
}: BarChartProps) {
  const { ref, largura } = useLarguraMedida<HTMLDivElement>();
  const limpos = useMemo(() => data.filter((d) => Number.isFinite(d.value)), [data]);
  const horizontal = orientacao === "horizontal";
  const alt = altura ?? (horizontal ? Math.max(120, limpos.length * 36 + MARGEM.topo + MARGEM.base) : 240);

  return (
    <div ref={ref} className={className}>
      {limpos.length === 0 ? (
        <EstadoVazio titulo="Sem dados no período" dica="Ajuste o período ou os filtros." altura={alt} />
      ) : largura > 0 ? (
        <BarrasInternas
          titulo={titulo}
          dados={limpos}
          horizontal={horizontal}
          largura={largura}
          altura={alt}
          formatar={formatarRotulo}
          cor={corSerie(serie)}
          animKey={animKey ?? limpos.map((d) => `${d.id}:${d.value}`).join("|")}
        />
      ) : (
        <div style={{ height: alt }} />
      )}
    </div>
  );
}

function BarrasInternas({
  titulo,
  dados,
  horizontal,
  largura,
  altura,
  formatar,
  cor,
  animKey,
}: {
  titulo: string;
  dados: ReadonlyArray<DadoBarra>;
  horizontal: boolean;
  largura: number;
  altura: number;
  formatar: (n: number) => string;
  cor: string;
  animKey: string;
}) {
  const reduced = useReducedMotion();
  const { ativo, setAtivo, handlers } = useItemAtivo(dados.length);

  const esq = horizontal ? Math.min(150, Math.max(70, Math.round(largura * 0.3))) : MARGEM.esquerda;
  const areaW = Math.max(0, largura - esq - MARGEM.direita);
  const areaH = Math.max(0, altura - MARGEM.topo - MARGEM.base);

  const valorScale = useMemo(
    () =>
      escalaLinear(yDomain(dados.map((d) => d.value)), horizontal ? [0, areaW] : [areaH, 0], { nice: true }),
    [dados, horizontal, areaW, areaH],
  );
  const bandScale = useMemo(
    () =>
      escalaBanda(
        dados.map((d) => d.id),
        horizontal ? [0, areaH] : [0, areaW],
        0.35,
      ),
    [dados, horizontal, areaW, areaH],
  );
  const ticks = valorScale.ticks(4);
  const zero = valorScale(0);
  const passo = bandScale.step();
  const rotuloLargura = Math.max(...dados.map((d) => d.label.length)) * 6.4;
  const saltoRotulos = horizontal ? 1 : Math.max(1, Math.ceil(rotuloLargura / passo));
  const rotularValor = dados.length <= 8;

  const barras = dados.map((d, i) => {
    const espessura = Math.min(bandScale.bandwidth(), ESPESSURA_MAX);
    const inicio = (bandScale(d.id) ?? 0) + (bandScale.bandwidth() - espessura) / 2;
    const v = valorScale(d.value);
    if (horizontal) {
      const x = Math.min(zero, v);
      const w = Math.abs(v - zero);
      return { d, i, x, y: inicio, w, h: espessura, ponta: (d.value >= 0 ? "direita" : "esquerda") as "direita" | "esquerda" };
    }
    const y = Math.min(zero, v);
    const h = Math.abs(v - zero);
    return { d, i, x: inicio, y, w: espessura, h, ponta: (d.value >= 0 ? "topo" : "base") as "topo" | "base" };
  });

  const b = ativo !== null ? barras[ativo] : null;

  return (
    <div className="relative">
      <div
        role="group"
        aria-roledescription={horizontal ? "gráfico de barras" : "gráfico de colunas"}
        aria-label={`${titulo}. Use as setas para percorrer os valores.`}
        tabIndex={0}
        className={cx("relative rounded-v2-sm", foco)}
        {...handlers}
      >
        <svg width={largura} height={altura} aria-hidden="true" className="block overflow-visible">
          <g transform={`translate(${esq} ${MARGEM.topo})`}>
            {ticks.map((t) => {
              const p = valorScale(t);
              return (
                <g key={t}>
                  {horizontal ? (
                    <line x1={p} x2={p} y1={0} y2={areaH} stroke={COR.grade} />
                  ) : (
                    <line x1={0} x2={areaW} y1={p} y2={p} stroke={COR.grade} />
                  )}
                  {horizontal ? (
                    <text x={p} y={areaH + 18} textAnchor="middle" fontSize={11} fill={COR.textoMudo}>
                      {formatar(t)}
                    </text>
                  ) : (
                    <text x={-8} y={p} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={COR.textoMudo}>
                      {formatar(t)}
                    </text>
                  )}
                </g>
              );
            })}
            {horizontal ? (
              <line x1={zero} x2={zero} y1={0} y2={areaH} stroke={COR.eixo} />
            ) : (
              <line x1={0} x2={areaW} y1={zero} y2={zero} stroke={COR.eixo} />
            )}
            {dados.map((d, i) => {
              if (i % saltoRotulos !== 0) return null;
              const centro = (bandScale(d.id) ?? 0) + bandScale.bandwidth() / 2;
              return horizontal ? (
                <text key={d.id} x={-8} y={centro} textAnchor="end" dominantBaseline="middle" fontSize={12} fill={COR.texto}>
                  {d.label}
                </text>
              ) : (
                <text key={d.id} x={centro} y={areaH + 18} textAnchor="middle" fontSize={11} fill={COR.textoMudo}>
                  {d.label}
                </text>
              );
            })}
            <CamadaAnimada animKey={animKey}>
              {barras.map(({ d, i, x, y, w, h, ponta }) => (
                <g key={d.id}>
                  <m.path
                    d={caminhoBarra(x, y, w, h, RAIO, ponta)}
                    fill={cor}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: horizontal ? "left" : "bottom",
                      opacity: ativo === null || ativo === i ? 1 : 0.5,
                    }}
                    initial={reduced ? false : horizontal ? { scaleX: 0 } : { scaleY: 0 }}
                    animate={horizontal ? { scaleX: 1 } : { scaleY: 1 }}
                    transition={{ duration: dur.lenta, ease: easeSaida, delay: reduced ? 0 : Math.min(i * 0.025, 0.3) }}
                  />
                  {rotularValor ? (
                    <text
                      x={horizontal ? x + w + 6 : x + w / 2}
                      y={horizontal ? y + h / 2 : y - 6}
                      textAnchor={horizontal ? "start" : "middle"}
                      dominantBaseline={horizontal ? "middle" : "auto"}
                      fontSize={11}
                      fill={COR.texto}
                    >
                      {formatar(d.value)}
                    </text>
                  ) : null}
                </g>
              ))}
            </CamadaAnimada>
            {/* Alvo de ponteiro maior que a barra: a faixa inteira da categoria. */}
            {dados.map((d, i) => (
              <rect
                key={d.id}
                x={horizontal ? 0 : bandScale(d.id)}
                y={horizontal ? bandScale(d.id) : 0}
                width={horizontal ? areaW : bandScale.bandwidth()}
                height={horizontal ? bandScale.bandwidth() : areaH}
                fill="transparent"
                onPointerEnter={() => setAtivo(i)}
                onPointerDown={() => setAtivo(i)}
                onPointerLeave={() => setAtivo(null)}
              />
            ))}
          </g>
        </svg>
        {b ? (
          <TooltipGrafico
            x={esq + (horizontal ? b.x + b.w : b.x + b.w / 2)}
            y={MARGEM.topo + (horizontal ? b.y : b.y - 8)}
            larguraContainer={largura}
            titulo={b.d.label}
            linhas={[{ cor, rotulo: titulo, valor: formatarValor(b.d.value) }]}
          />
        ) : null}
        <div aria-live="polite" className="sr-only">
          {b ? `${b.d.label}: ${formatarValor(b.d.value)}` : ""}
        </div>
        <TabelaDados legenda={titulo} colunas={["Categoria", "Valor"]} linhas={dados.map((d) => [d.label, formatarValor(d.value)])} />
      </div>
    </div>
  );
}
