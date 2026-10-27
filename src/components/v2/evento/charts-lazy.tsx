"use client";

import dynamic from "next/dynamic";
import { EsqueletoGrafico, type FormaEsqueleto } from "./bloco";

/**
 * Gráficos sob demanda: o JS deles (visx + geometria) não entra no carregamento
 * inicial da rota, que tem folga curta no orçamento de 180 KB. Cada um reserva a
 * altura final, com a forma do gráfico, para a chegada do chunk não deslocar o layout.
 */
function comAltura(altura: number, forma: FormaEsqueleto) {
  return function Carregando() {
    return (
      <div style={{ height: altura }} className="w-full">
        <EsqueletoGrafico forma={forma} className="h-full w-full" />
      </div>
    );
  };
}

export const LineChartLazy = dynamic(() => import("../charts/line-chart").then((m) => m.LineChart), {
  ssr: false,
  loading: comAltura(240, "linha"),
});
export const BarChartLazy = dynamic(() => import("../charts/bar-chart").then((m) => m.BarChart), {
  ssr: false,
  loading: comAltura(240, "barras"),
});
export const BarChartDiarioLazy = dynamic(() => import("../charts/bar-chart-diario").then((m) => m.BarChartDiario), {
  ssr: false,
  loading: comAltura(240, "colunas"),
});
/** A tendência do KPI também vem do chunk dos gráficos; reserva o tamanho dela para o número não pular. */
export const SparklineLazy = dynamic(() => import("../charts/sparkline").then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <span aria-hidden="true" className="mb-2 inline-block h-8 w-[88px] shrink-0" />,
});
export const DonutChartLazy = dynamic(() => import("../charts/donut-chart").then((m) => m.DonutChart), {
  ssr: false,
  loading: comAltura(220, "rosca"),
});
