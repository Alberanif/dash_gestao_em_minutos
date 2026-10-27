"use client";

import { memo, useId, useMemo } from "react";
import { Area, LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { cx, foco } from "../ui/cx";
import {
  cleanPoints,
  formatarCompacto,
  formatarDataCurta,
  formatarDataLonga,
  formatarValor,
  nearestIndex,
  xDomain,
  yDomain,
  type XValue,
  type XY,
} from "./geometry";
import { COR, LIMITE_BRILHO_PONTOS, corSerie } from "./palette";
import { escalaLinear, marcasDeData, type EscalaLinear } from "./scales";
import { CamadaAnimada, EstadoVazio, Legenda, TabelaDados, TooltipGrafico } from "./parts";
import { useItemAtivo, useLarguraMedida } from "./use-chart";

export type SerieLinha = {
  id: string;
  label: string;
  data: ReadonlyArray<{ x: XValue; y: number }>;
  /** Cor da métrica (token CSS). Sem ela, a série pega a cor da sua posição na paleta. */
  cor?: string;
};

export type LineChartProps = {
  /** Título do gráfico: vira o nome acessível. */
  titulo: string;
  series: ReadonlyArray<SerieLinha>;
  altura?: number;
  /** Degradê sob a linha, da cor da série até transparente. Padrão: ligado só quando há uma série. */
  area?: boolean;
  formatarY?: (n: number) => string;
  /** Rótulo do eixo x. Padrão: dia e mês quando x é Date. */
  formatarX?: (x: number) => string;
  /** Rótulo completo no tooltip. Padrão: data completa quando x é Date. */
  formatarXLongo?: (x: number) => string;
  /** Muda quando os dados trocam de forma que pede animação. Padrão: derivada dos dados. */
  animKey?: string;
  className?: string;
};

const MARGEM = { topo: 12, direita: 20, base: 28 };
/** Espaço por rótulo do eixo x: ~4 datas em 360 px, mais em tela larga. Os rótulos nunca giram. */
const ESPACO_ROTULO_X = 76;
const LARGURA_CHAR = 6.2;
const LIMITE_TABELA = 400;
const MEIO_DIA = 43_200_000;

type Limpa = { id: string; label: string; cor: string; pontos: XY[]; xs: number[] };
type Escala = EscalaLinear;

type CamadaProps = { limpas: Limpa[]; xLin: Escala; yLin: Escala; area: boolean; brilho: boolean; idBase: string };

/** Camada estática das séries. Memoizada: mover o cursor não recalcula nem redesenha os caminhos. */
const CamadaSeries = memo(function CamadaSeries({ limpas, xLin, yLin, area, brilho, idBase }: CamadaProps) {
  return (
    <>
      {limpas.map((s, k) => {
        const ultimo = s.pontos[s.pontos.length - 1];
        return (
          <g key={s.id}>
            <defs>
              <linearGradient id={`${idBase}-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.cor} stopOpacity={0.34} />
                <stop offset="1" stopColor={s.cor} stopOpacity={0} />
              </linearGradient>
            </defs>
            {s.pontos.length > 1 ? (
              <g
                className="v2-g v2-g-traco"
                style={brilho ? { filter: `drop-shadow(0 0 6px color-mix(in srgb, ${s.cor} 55%, transparent))` } : undefined}
              >
                {area ? (
                  <Area<XY>
                    data={s.pontos}
                    x={(d) => xLin(d.x)}
                    y0={yLin.range()[0]}
                    y1={(d) => yLin(d.y)}
                    curve={curveMonotoneX}
                    fill={`url(#${idBase}-${k})`}
                  />
                ) : null}
                <LinePath<XY>
                  data={s.pontos}
                  x={(d) => xLin(d.x)}
                  y={(d) => yLin(d.y)}
                  curve={curveMonotoneX}
                  stroke={s.cor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </g>
            ) : null}
            {/* Último ponto da linha: o único uso do âmbar na biblioteca. Chega depois do traço e pulsa uma vez. */}
            <circle
              className="v2-g v2-g-pulso"
              cx={xLin(ultimo.x)}
              cy={yLin(ultimo.y)}
              r={4}
              fill="none"
              stroke={COR.ponto}
              strokeWidth={1.5}
              pointerEvents="none"
            />
            <circle
              className="v2-g v2-g-ponto"
              data-ponto-vivo=""
              cx={xLin(ultimo.x)}
              cy={yLin(ultimo.y)}
              r={4}
              fill={COR.ponto}
              stroke={COR.superficie}
              strokeWidth={2}
              style={{ filter: COR.brilhoPonto }}
            />
          </g>
        );
      })}
    </>
  );
});

function LinhaInterna({
  titulo,
  limpas,
  ehData,
  largura,
  altura,
  area,
  formatarY,
  formatarX,
  formatarXLongo,
  animKey,
  className,
}: {
  titulo: string;
  limpas: Limpa[];
  ehData: boolean;
  largura: number;
  altura: number;
  area: boolean;
  formatarY: (n: number) => string;
  formatarX: (x: number) => string;
  formatarXLongo: (x: number) => string;
  animKey: string;
  className?: string;
}) {
  // Eixo de referência do cursor: a série com mais pontos.
  const refXs = useMemo(() => {
    let maior = limpas[0].pontos;
    for (const s of limpas) if (s.pontos.length > maior.length) maior = s.pontos;
    return maior.map((p) => p.x);
  }, [limpas]);

  const { ativo, setAtivo, handlers } = useItemAtivo(refXs.length);
  const idBase = `v2-area-${useId().replace(/:/g, "")}`;

  const { yLin, ticksY, esq, fy } = useMemo(() => {
    const valores: number[] = [];
    for (const s of limpas) for (const p of s.pontos) valores.push(p.y);
    const y = escalaLinear(yDomain(valores), [altura - MARGEM.base, MARGEM.topo], { nice: true });
    const ticks = y.ticks(4);
    const medir = (f: (n: number) => string) => Math.max(...ticks.map((t) => f(t).length));
    let f = formatarY;
    let maiorRotulo = medir(f);
    // Rótulos longos (moeda com centavos) comem o gráfico em celular: cai para a forma compacta.
    if (maiorRotulo * 6.6 + 14 > largura * 0.3) {
      f = formatarCompacto;
      maiorRotulo = medir(f);
    }
    return { yLin: y, ticksY: ticks, esq: Math.max(32, Math.min(Math.ceil(maiorRotulo * 6.6) + 14, largura * 0.34)), fy: f };
  }, [limpas, altura, formatarY, largura]);

  const { xLin, ticksX } = useMemo(() => {
    const todos: number[] = [];
    for (const s of limpas) for (const p of s.pontos) todos.push(p.x);
    const dominio = xDomain(todos, ehData ? MEIO_DIA : 1);
    const range: [number, number] = [esq, largura - MARGEM.direita];
    const x = escalaLinear(dominio, range);
    const n = Math.max(2, Math.floor((largura - esq - MARGEM.direita) / ESPACO_ROTULO_X));
    return { xLin: x, ticksX: ehData ? marcasDeData(dominio[0], dominio[1], n) : x.ticks(n) };
  }, [limpas, ehData, esq, largura]);

  const totalPontos = useMemo(() => limpas.reduce((s, l) => s + l.pontos.length, 0), [limpas]);
  const base = altura - MARGEM.base;

  const refX = ativo !== null ? refXs[ativo] : null;
  const leitura = useMemo(() => {
    if (refX === null) return null;
    return limpas.map((s) => {
      const p = s.pontos[nearestIndex(s.xs, refX)];
      return { s, p };
    });
  }, [limpas, refX]);

  const textoLeitura =
    refX !== null && leitura
      ? `${formatarXLongo(refX)}: ${leitura.map(({ s, p }) => `${s.label} ${formatarValor(p.y)}`).join(", ")}`
      : "";

  function aoMoverPonteiro(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = esq + (e.clientX - r.left);
    setAtivo(nearestIndex(refXs, xLin.invert(sx)));
  }

  const tabela =
    totalPontos <= LIMITE_TABELA ? (
      <TabelaDados
        legenda={titulo}
        colunas={["Data", ...limpas.map((s) => s.label)]}
        linhas={refXs.map((x) => [
          formatarXLongo(x),
          ...limpas.map((s) => {
            const p = s.pontos[nearestIndex(s.xs, x)];
            return formatarValor(p.y);
          }),
        ])}
      />
    ) : null;

  return (
    <div className={cx("relative", className)}>
      {limpas.length > 1 ? <Legenda itens={limpas.map((s) => ({ cor: s.cor, rotulo: s.label }))} /> : null}
      <div
        role="group"
        aria-roledescription="gráfico de linhas"
        aria-label={`${titulo}. Use as setas para percorrer os valores.`}
        tabIndex={0}
        className={cx("relative mt-2 rounded-v2-sm", foco)}
        {...handlers}
      >
        <svg width={largura} height={altura} aria-hidden="true" className="block overflow-visible">
          {ticksY.map((t) => (
            <g key={t}>
              <line x1={esq} x2={largura - MARGEM.direita} y1={yLin(t)} y2={yLin(t)} stroke={COR.grade} />
              <text x={esq - 8} y={yLin(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={COR.textoMudo}>
                {fy(t)}
              </text>
            </g>
          ))}
          <line x1={esq} x2={largura - MARGEM.direita} y1={base} y2={base} stroke={COR.eixo} />
          {ticksX.map((t) => {
            const rotulo = formatarX(t);
            const x = xLin(t);
            const meia = (rotulo.length * LARGURA_CHAR) / 2;
            // Rótulo que passaria da borda do gráfico ancora pela ponta: nunca vaza nem gira.
            const ancora = x + meia > largura ? "end" : x - meia < 0 ? "start" : "middle";
            return (
              <text key={t} x={ancora === "end" ? Math.min(x + 2, largura) : x} y={altura - 8} textAnchor={ancora} fontSize={11} fill={COR.textoMudo}>
                {rotulo}
              </text>
            );
          })}
          <CamadaAnimada animKey={animKey}>
            <CamadaSeries limpas={limpas} xLin={xLin} yLin={yLin} area={area} brilho={totalPontos <= LIMITE_BRILHO_PONTOS} idBase={idBase} />
          </CamadaAnimada>
          {refX !== null && leitura ? (
            <g pointerEvents="none">
              <line x1={xLin(refX)} x2={xLin(refX)} y1={MARGEM.topo} y2={base} stroke={COR.cursor} />
              {leitura.map(({ s, p }) => (
                <circle key={s.id} cx={xLin(p.x)} cy={yLin(p.y)} r={4} fill={s.cor} stroke={COR.superficie} strokeWidth={2} />
              ))}
            </g>
          ) : null}
          <rect
            x={esq}
            y={MARGEM.topo}
            width={Math.max(0, largura - MARGEM.direita - esq)}
            height={Math.max(0, base - MARGEM.topo)}
            fill="transparent"
            onPointerMove={aoMoverPonteiro}
            onPointerDown={aoMoverPonteiro}
            onPointerLeave={() => setAtivo(null)}
          />
        </svg>
        {refX !== null && leitura ? (
          <TooltipGrafico
            x={xLin(refX)}
            y={MARGEM.topo}
            larguraContainer={largura}
            titulo={formatarXLongo(refX)}
            linhas={leitura.map(({ s, p }) => ({ cor: s.cor, rotulo: s.label, valor: formatarValor(p.y) }))}
          />
        ) : null}
        <div aria-live="polite" className="sr-only">
          {textoLeitura}
        </div>
        {tabela}
      </div>
    </div>
  );
}

/**
 * Gráfico de linha e área. Dados sujos são limpos, série vazia vira estado vazio, série de um ponto vira só o ponto.
 * Até 5 mil pontos por série: um único caminho SVG por série, memoizado, e o cursor só mexe numa camada leve.
 */
export function LineChart({
  titulo,
  series,
  altura = 240,
  area,
  formatarY = formatarCompacto,
  formatarX,
  formatarXLongo,
  animKey,
  className,
}: LineChartProps) {
  const { ref, largura } = useLarguraMedida<HTMLDivElement>();
  // Em celular o gráfico fica mais baixo, para não ocupar a tela inteira.
  const alturaUtil = largura > 0 && largura < 480 ? Math.min(altura, 208) : altura;

  const limpas = useMemo<Limpa[]>(
    () =>
      series
        // A cor segue a entidade (posição original), mesmo que outra série esteja vazia.
        .map((s, i) => {
          const pontos = cleanPoints(s.data);
          return { id: s.id, label: s.label, cor: s.cor ?? corSerie(i), pontos, xs: pontos.map((p) => p.x) };
        })
        .filter((s) => s.pontos.length > 0),
    [series],
  );
  const ehData = useMemo(() => series.some((s) => s.data.some((d) => d.x instanceof Date)), [series]);

  const chave = useMemo(
    () => animKey ?? limpas.map((s) => `${s.id}:${s.pontos.length}:${s.pontos[0].x}:${s.pontos[s.pontos.length - 1].x}`).join("|"),
    [animKey, limpas],
  );

  const fx = formatarX ?? (ehData ? formatarDataCurta : formatarCompacto);
  const fxLongo = formatarXLongo ?? (ehData ? formatarDataLonga : formatarValor);

  return (
    <div ref={ref} className={cx("min-w-0 max-w-full", className)}>
      {limpas.length === 0 ? (
        <EstadoVazio titulo="Sem dados no período" dica="Ajuste o período ou os filtros." altura={altura} />
      ) : largura > 0 ? (
        <LinhaInterna
          titulo={titulo}
          limpas={limpas}
          ehData={ehData}
          largura={largura}
          altura={alturaUtil}
          area={area ?? limpas.length === 1}
          formatarY={formatarY}
          formatarX={fx}
          formatarXLongo={fxLongo}
          animKey={chave}
        />
      ) : (
        <div style={{ height: altura }} />
      )}
    </div>
  );
}
