"use client";

import dynamic from "next/dynamic";
import { Esqueleto } from "./bloco";

/**
 * Gráficos sob demanda: o JS deles (visx + geometria) não entra no carregamento
 * inicial da rota, que tem folga curta no orçamento de 180 KB. Cada um reserva a
 * altura final para a chegada do chunk não deslocar o layout.
 */
function comAltura(altura: number) {
  return function Carregando() {
    return <div style={{ height: altura }} className="w-full animate-none"><Esqueleto className="h-full w-full" /></div>;
  };
}

export const LineChartLazy = dynamic(() => import("../charts/line-chart").then((m) => m.LineChart), {
  ssr: false,
  loading: comAltura(240),
});
export const BarChartLazy = dynamic(() => import("../charts/bar-chart").then((m) => m.BarChart), {
  ssr: false,
  loading: comAltura(240),
});
export const DonutChartLazy = dynamic(() => import("../charts/donut-chart").then((m) => m.DonutChart), {
  ssr: false,
  loading: comAltura(220),
});
export const FunnelChartLazy = dynamic(() => import("../charts/funnel-chart").then((m) => m.FunnelChart), {
  ssr: false,
  loading: comAltura(260),
});
