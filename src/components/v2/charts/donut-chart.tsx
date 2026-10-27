"use client";

import { useId, useMemo } from "react";
import { Pie } from "@visx/shape";
import { cx, foco } from "../ui/cx";
import { foldTail, formatarCompacto, formatarPercentual, formatarValor } from "./geometry";
import { COR, NUM_SERIES, corSerie } from "./palette";
import { LegendaLista } from "./legenda-lista";
import { CamadaAnimada, EstadoVazio, TabelaDados, TooltipGrafico } from "./parts";
import { useItemAtivo, useLarguraMedida } from "./use-chart";

export type FatiaRosca = { id: string; label: string; value: number };

export type DonutChartProps = {
  titulo: string;
  data: ReadonlyArray<FatiaRosca>;
  /** Texto pequeno sob o total no centro. */
  rotuloTotal?: string;
  formatarValor?: (n: number) => string;
  altura?: number;
  /** Cores das fatias, em ordem (token CSS). Sem isto vale a paleta de séries. "Outros" é sempre ardósia. */
  cores?: ReadonlyArray<string>;
  animKey?: string;
  className?: string;
};

const LARGURA_LADO_A_LADO = 440;

type Item = { id: string; label: string; value: number; cor: string };

/**
 * Rosca para parte do todo. No máximo 5 fatias nas cores da paleta; o resto vira "Outros" em ardósia
 * (nunca uma sexta cor). A cor segue a posição da fatia, não o tamanho.
 */
export function DonutChart({
  titulo,
  data,
  rotuloTotal = "Total",
  formatarValor: fmt = formatarValor,
  altura = 220,
  cores,
  animKey,
  className,
}: DonutChartProps) {
  const { ref, largura } = useLarguraMedida<HTMLDivElement>();
  const itens = useMemo<Item[]>(
    () =>
      foldTail(data, NUM_SERIES + 1).map((d, i) => ({
        id: d.id,
        label: d.label,
        value: d.value,
        cor: "outros" in d ? COR.outros : (cores?.[i] ?? corSerie(i)),
      })),
    [data, cores],
  );

  return (
    <div ref={ref} className={className}>
      {itens.length === 0 ? (
        <EstadoVazio titulo="Sem dados no período" dica="Ajuste o período ou os filtros." altura={altura} />
      ) : largura > 0 ? (
        <RoscaInterna
          titulo={titulo}
          itens={itens}
          largura={largura}
          altura={altura}
          rotuloTotal={rotuloTotal}
          fmt={fmt}
          animKey={animKey ?? itens.map((d) => `${d.id}:${d.value}`).join("|")}
        />
      ) : (
        <div style={{ height: altura }} />
      )}
    </div>
  );
}

function RoscaInterna({
  titulo,
  itens,
  largura,
  altura,
  rotuloTotal,
  fmt,
  animKey,
}: {
  titulo: string;
  itens: Item[];
  largura: number;
  altura: number;
  rotuloTotal: string;
  fmt: (n: number) => string;
  animKey: string;
}) {
  const idMascara = `v2-rosca-${useId().replace(/\W/g, "")}`;
  const { ativo, setAtivo, handlers } = useItemAtivo(itens.length);
  const total = useMemo(() => itens.reduce((s, i) => s + i.value, 0), [itens]);
  const lateral = largura >= LARGURA_LADO_A_LADO;
  const lado = Math.max(80, Math.min(lateral ? Math.min(altura, 200) : altura, largura));
  const raio = lado / 2 - 4;
  const espessura = Math.min(28, raio * 0.32);
  const cx0 = lado / 2;

  return (
    <div className="relative">
      <div
        role="group"
        aria-roledescription="gráfico de rosca"
        aria-label={`${titulo}. Use as setas para percorrer as fatias.`}
        tabIndex={0}
        className={cx(
          "relative flex gap-x-6 gap-y-4 rounded-v2-sm",
          lateral ? "flex-row items-center" : "flex-col items-center",
          foco,
        )}
        {...handlers}
      >
        <div className="relative max-w-full shrink-0" style={{ width: lado, height: lado }}>
          <svg width={lado} height={lado} aria-hidden="true" className="block overflow-visible">
            <g transform={`translate(${cx0} ${cx0})`}>
              <CamadaAnimada animKey={animKey}>
                {/* A rosca é varrida a partir das 12h por uma máscara: um anel grosso com o traço crescendo. */}
                <mask id={idMascara}>
                  <circle
                    className="v2-g v2-g-varre"
                    r={raio / 2}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={raio + 2}
                    pathLength={1}
                    strokeDasharray={1}
                    transform="rotate(-90)"
                  />
                </mask>
                <g mask={`url(#${idMascara})`}>
                  <Pie<Item>
                    data={itens}
                    pieValue={(d) => d.value}
                    outerRadius={raio}
                    innerRadius={raio - espessura}
                    padAngle={itens.length > 1 ? 0.025 : 0}
                    cornerRadius={3}
                    pieSort={null}
                  >
                    {(pie) =>
                      pie.arcs.map((arc, i) => (
                        <path
                          key={arc.data.id}
                          d={pie.path(arc) ?? ""}
                          fill={arc.data.cor}
                          className="transition-opacity duration-150"
                          style={{ opacity: ativo === null || ativo === i ? 1 : 0.5 }}
                          onPointerEnter={() => setAtivo(i)}
                          onPointerDown={() => setAtivo(i)}
                          onPointerLeave={() => setAtivo(null)}
                        />
                      ))
                    }
                  </Pie>
                </g>
              </CamadaAnimada>
              <text textAnchor="middle" y={2} fontSize={Math.min(26, raio * 0.4)} fontWeight={300} fill={COR.texto}>
                {formatarCompacto(total)}
              </text>
              <text textAnchor="middle" y={raio * 0.3 + 6} fontSize={11} fill={COR.textoMudo}>
                {rotuloTotal}
              </text>
            </g>
          </svg>
          {ativo !== null ? (
            <TooltipGrafico
              x={lado - 8}
              y={0}
              larguraContainer={largura}
              titulo={itens[ativo].label}
              linhas={[
                { cor: itens[ativo].cor, rotulo: formatarPercentual(itens[ativo].value / total), valor: fmt(itens[ativo].value) },
              ]}
            />
          ) : null}
        </div>
        <LegendaLista
          className={lateral ? "flex-1" : "w-full"}
          ativo={ativo}
          onAtivo={setAtivo}
          itens={itens.map((i) => ({
            id: i.id,
            label: i.label,
            cor: i.cor,
            parte: total > 0 ? i.value / total : 0,
            percentual: formatarPercentual(total > 0 ? i.value / total : 0),
            quantidade: fmt(i.value),
          }))}
        />
        <div aria-live="polite" className="sr-only">
          {ativo !== null ? `${itens[ativo].label}: ${fmt(itens[ativo].value)}, ${formatarPercentual(itens[ativo].value / total)}` : ""}
        </div>
        <TabelaDados
          legenda={titulo}
          colunas={["Fatia", "Valor", "Parte do total"]}
          linhas={itens.map((i) => [i.label, fmt(i.value), formatarPercentual(i.value / total)])}
        />
      </div>
    </div>
  );
}
