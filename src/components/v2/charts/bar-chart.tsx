"use client";

import { useId, useMemo } from "react";
import { cx, foco } from "../ui/cx";
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
  /** Cor da métrica (token CSS). Quando passada, vale mais que `serie`. */
  cor?: string;
  animKey?: string;
  className?: string;
};

const ESPESSURA_MAX = 24;
const RAIO = 4;
const MARGEM = { topo: 16, direita: 16, base: 28, esquerda: 48 };
const LARG_CHAR = 6.4; // largura média de um caractere a 11-12px, para truncar sem medir o DOM
const LINHA_H = 46; // barras horizontais: 20 de texto + 6 de respiro + 10 de barra + 10 de folga
const BARRA_H = 10;
const BARRA_Y = 26;

/** Corta o texto com reticências para caber em `maxPx`. */
function truncar(texto: string, maxPx: number): string {
  const max = Math.floor(maxPx / LARG_CHAR);
  if (texto.length <= max) return texto;
  if (max <= 1) return "";
  return `${texto.slice(0, max - 1).trimEnd()}…`;
}

/** Colunas ou barras de uma única série nominal. Ponta arredondada no dado, base reta, no máximo 24px. */
export function BarChart({
  titulo,
  data,
  orientacao = "vertical",
  altura,
  formatarValor: formatarRotulo = formatarCompacto,
  serie = 0,
  cor,
  animKey,
  className,
}: BarChartProps) {
  const { ref, largura } = useLarguraMedida<HTMLDivElement>();
  const limpos = useMemo(() => data.filter((d) => Number.isFinite(d.value)), [data]);
  const horizontal = orientacao === "horizontal";
  const alt = horizontal ? Math.max(120, limpos.length * LINHA_H) : (altura ?? 240);

  return (
    <div ref={ref} className={className}>
      {limpos.length === 0 ? (
        <EstadoVazio titulo="Sem dados no período" dica="Ajuste o período ou os filtros." altura={alt} />
      ) : largura > 0 ? (
        horizontal ? (
          <BarrasHorizontais
            titulo={titulo}
            dados={limpos}
            largura={largura}
            formatar={formatarRotulo}
            cor={cor ?? corSerie(serie)}
            animKey={animKey ?? limpos.map((d) => `${d.id}:${d.value}`).join("|")}
          />
        ) : (
          <BarrasInternas
            titulo={titulo}
            dados={limpos}
            largura={largura}
            altura={alt}
            formatar={formatarRotulo}
            cor={cor ?? corSerie(serie)}
            animKey={animKey ?? limpos.map((d) => `${d.id}:${d.value}`).join("|")}
          />
        )
      ) : (
        <div style={{ height: alt }} />
      )}
    </div>
  );
}

const estiloAtraso = (i: number, passo: number) => ({ "--i": i * passo }) as React.CSSProperties;

/** Gradiente do pé (mais fraco) até a ponta, onde está o dado. Cada barra usa a própria caixa. */
export function GradienteBarra({ id, cor, horizontal }: { id: string; cor: string; horizontal: boolean }) {
  return (
    <defs>
      <linearGradient id={id} x1={0} y1={horizontal ? 0 : 1} x2={horizontal ? 1 : 0} y2={0}>
        <stop offset="0" stopColor={cor} stopOpacity={0.45} />
        <stop offset="1" stopColor={cor} stopOpacity={1} />
      </linearGradient>
    </defs>
  );
}

/**
 * Barras horizontais: cada item é uma linha com o nome à esquerda (truncado), o valor à direita
 * e, logo abaixo, a barra em largura total do container. Texto em HTML (nunca vaza); barras num SVG por baixo.
 */
function BarrasHorizontais({
  titulo,
  dados,
  largura,
  formatar,
  cor,
  animKey,
}: {
  titulo: string;
  dados: ReadonlyArray<DadoBarra>;
  largura: number;
  formatar: (n: number) => string;
  cor: string;
  animKey: string;
}) {
  const passoEscalona = Math.min(1, 10 / dados.length);
  const { ativo, setAtivo, handlers } = useItemAtivo(dados.length);
  const idGrad = `v2-barra-${useId().replace(/:/g, "")}`;
  const altura = dados.length * LINHA_H;

  const valorScale = useMemo(
    () => escalaLinear(yDomain(dados.map((d) => d.value)), [0, largura], { nice: true }),
    [dados, largura],
  );
  const zero = valorScale(0);

  const barras = dados.map((d, i) => {
    const v = valorScale(d.value);
    return {
      d,
      i,
      x: Math.min(zero, v),
      y: i * LINHA_H + BARRA_Y,
      w: Math.abs(v - zero),
      ponta: (d.value >= 0 ? "direita" : "esquerda") as "direita" | "esquerda",
    };
  });
  const b = ativo !== null ? barras[ativo] : null;

  return (
    <div className="relative min-w-0">
      <div
        role="group"
        aria-roledescription="gráfico de barras"
        aria-label={`${titulo}. Use as setas para percorrer os valores.`}
        tabIndex={0}
        className={cx("relative min-w-0 rounded-v2-sm", foco)}
        {...handlers}
      >
        <svg width={largura} height={altura} aria-hidden="true" className="absolute left-0 top-0 block">
          <GradienteBarra id={idGrad} cor={cor} horizontal />
          <CamadaAnimada animKey={animKey}>
            {barras.map(({ d, i, x, y, w, ponta }) => (
              <path
                key={d.id}
                d={caminhoBarra(x, y, w, BARRA_H, RAIO, ponta)}
                fill={`url(#${idGrad})`}
                className="v2-g v2-g-cresce"
                style={
                  {
                    "--i": i * passoEscalona,
                    opacity: ativo === null || ativo === i ? 1 : 0.5,
                    // Barra negativa nasce do zero, que fica no lado oposto ao da positiva.
                    ...(d.value < 0 ? { transformOrigin: "right" } : null),
                  } as React.CSSProperties
                }
              />
            ))}
          </CamadaAnimada>
        </svg>
        <ul className="relative m-0 list-none p-0" style={{ height: altura }}>
          {dados.map((d, i) => (
            <li
              key={d.id}
              className="flex min-w-0 items-start justify-between gap-3 text-v2-nevoa"
              style={{ height: LINHA_H, opacity: ativo === null || ativo === i ? 1 : 0.5 }}
              onPointerEnter={() => setAtivo(i)}
              onPointerDown={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
            >
              <span title={d.label} className="min-w-0 flex-1 truncate pt-0.5 text-xs leading-[18px]">
                {d.label}
              </span>
              <span className="shrink-0 pt-0.5 text-xs leading-[18px] text-v2-nevoa/80">{formatar(d.value)}</span>
            </li>
          ))}
        </ul>
        {b ? (
          <TooltipGrafico
            x={b.x + b.w}
            y={b.i * LINHA_H}
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

function BarrasInternas({
  titulo,
  dados,
  largura,
  altura,
  formatar,
  cor,
  animKey,
}: {
  titulo: string;
  dados: ReadonlyArray<DadoBarra>;
  largura: number;
  altura: number;
  formatar: (n: number) => string;
  cor: string;
  animKey: string;
}) {
  // Escalonamento de 60 ms por barra, limitado a 600 ms no total (a CSS multiplica `--i` pelo token).
  const passoEscalona = Math.min(1, 10 / dados.length);
  const { ativo, setAtivo, handlers } = useItemAtivo(dados.length);
  const idGrad = `v2-barra-${useId().replace(/:/g, "")}`;

  const esq = MARGEM.esquerda;
  const areaW = Math.max(0, largura - esq - MARGEM.direita);
  const areaH = Math.max(0, altura - MARGEM.topo - MARGEM.base);

  const valorScale = useMemo(
    () => escalaLinear(yDomain(dados.map((d) => d.value)), [areaH, 0], { nice: true }),
    [dados, areaH],
  );
  const bandScale = useMemo(
    () =>
      escalaBanda(
        dados.map((d) => d.id),
        [0, areaW],
        0.35,
      ),
    [dados, areaW],
  );
  const ticks = valorScale.ticks(4);
  const zero = valorScale(0);
  const passo = bandScale.step();
  const rotuloLargura = Math.max(...dados.map((d) => d.label.length)) * LARG_CHAR;
  const saltoRotulos = Math.max(1, Math.ceil(rotuloLargura / passo));
  const rotularValor = dados.length <= 8;

  const barras = dados.map((d, i) => {
    const espessura = Math.min(bandScale.bandwidth(), ESPESSURA_MAX);
    const inicio = (bandScale(d.id) ?? 0) + (bandScale.bandwidth() - espessura) / 2;
    const v = valorScale(d.value);
    const y = Math.min(zero, v);
    const h = Math.abs(v - zero);
    return { d, i, x: inicio, y, w: espessura, h, ponta: (d.value >= 0 ? "topo" : "base") as "topo" | "base" };
  });

  const b = ativo !== null ? barras[ativo] : null;

  return (
    <div className="relative min-w-0">
      <div
        role="group"
        aria-roledescription="gráfico de colunas"
        aria-label={`${titulo}. Use as setas para percorrer os valores.`}
        tabIndex={0}
        className={cx("relative rounded-v2-sm", foco)}
        {...handlers}
      >
        <svg width={largura} height={altura} aria-hidden="true" className="block overflow-hidden">
          <GradienteBarra id={idGrad} cor={cor} horizontal={false} />
          <g transform={`translate(${esq} ${MARGEM.topo})`}>
            {ticks.map((t) => {
              const p = valorScale(t);
              return (
                <g key={t}>
                  <line x1={0} x2={areaW} y1={p} y2={p} stroke={COR.grade} />
                  <text x={-8} y={p} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={COR.textoMudo}>
                    {formatar(t)}
                  </text>
                </g>
              );
            })}
            <line x1={0} x2={areaW} y1={zero} y2={zero} stroke={COR.eixo} />
            {dados.map((d, i) => {
              if (i % saltoRotulos !== 0) return null;
              const centro = (bandScale(d.id) ?? 0) + bandScale.bandwidth() / 2;
              // Largura máxima: o passo do salto, sem passar das bordas do SVG.
              const maxPx = Math.min(passo * saltoRotulos, 2 * (centro + esq), 2 * (areaW + MARGEM.direita - centro));
              return (
                <text key={d.id} x={centro} y={areaH + 18} textAnchor="middle" fontSize={11} fill={COR.textoMudo}>
                  <title>{d.label}</title>
                  {truncar(d.label, maxPx)}
                </text>
              );
            })}
            <CamadaAnimada animKey={animKey}>
              {barras.map(({ d, i, x, y, w, h, ponta }) => {
                const texto = formatar(d.value);
                const meiaLargura = (texto.length * LARG_CHAR) / 2;
                // Rótulo de valor centrado na coluna, mas preso às bordas do SVG.
                const meio = Math.max(-esq + meiaLargura, Math.min(areaW + MARGEM.direita - meiaLargura, x + w / 2));
                return (
                  <g key={d.id}>
                    <path
                      d={caminhoBarra(x, y, w, h, RAIO, ponta)}
                      fill={`url(#${idGrad})`}
                      className="v2-g v2-g-sobe"
                      style={
                        {
                          ...estiloAtraso(i, passoEscalona),
                          opacity: ativo === null || ativo === i ? 1 : 0.5,
                          // Barra negativa nasce do zero, que fica no lado oposto ao da positiva.
                          ...(d.value < 0 ? { transformOrigin: "top" } : null),
                        } as React.CSSProperties
                      }
                    />
                    {rotularValor ? (
                      <text
                        className="v2-g v2-g-rotulo"
                        style={estiloAtraso(i, passoEscalona)}
                        x={meio}
                        y={d.value >= 0 ? y - 6 : y + h + 12}
                        textAnchor="middle"
                        fontSize={11}
                        fill={COR.texto}
                      >
                        {texto}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </CamadaAnimada>
            {/* Alvo de ponteiro maior que a barra: a faixa inteira da categoria. */}
            {dados.map((d, i) => (
              <rect
                key={d.id}
                x={bandScale(d.id)}
                y={0}
                width={bandScale.bandwidth()}
                height={areaH}
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
            x={esq + b.x + b.w / 2}
            y={MARGEM.topo + b.y - 8}
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
