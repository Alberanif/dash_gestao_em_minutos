/** @jest-environment jsdom */
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { buildChartRows, ViewCumulativeChart } from "../view-charts";
import type { ChartGranularity } from "@/lib/vendas/cumulative-chart";
import type { VendasViewDailyRow, VendasViewHourlyRow } from "@/types/vendas";

// O Recharts não renderiza nada mensurável sob o ResponsiveContainer de
// tamanho zero do jsdom, então nenhum teste de componente chega perto dos
// rótulos do eixo e do tooltip. Sem estes testes diretos, trocar fmtHourShort
// por fmtDateShort deixaria todo tick lendo "01T20/07" com a suíte verde.
describe("buildChartRows — rótulos por granularidade", () => {
  const PONTOS = [
    { key: "2026-07-01", cumulative: 2 },
    { key: "2026-08-03", cumulative: 5 },
  ];
  const PONTOS_HORA = [
    { key: "2026-07-01T00", cumulative: 2 },
    { key: "2026-07-01T20", cumulative: 5 },
  ];

  it("na visão dia usa dd/mm no eixo e no tooltip", () => {
    expect(buildChartRows(PONTOS, "dia")).toEqual([
      { x: "01/07", tooltip: "01/07", cumulative: 2 },
      { x: "03/08", tooltip: "03/08", cumulative: 5 },
    ]);
  });

  it("na visão hora usa dd/mm HHh no eixo e a forma por extenso no tooltip", () => {
    expect(buildChartRows(PONTOS_HORA, "hora")).toEqual([
      { x: "01/07 00h", tooltip: "01/07 às 00h", cumulative: 2 },
      { x: "01/07 20h", tooltip: "01/07 às 20h", cumulative: 5 },
    ]);
  });

  // Guarda contra a troca silenciosa dos dois pares de formatadores: a chave
  // horária passada pelo formatador de dia produz lixo plausível ("01T20/07"),
  // que ninguém nota em um eixo denso.
  it("não confunde os dois formatadores entre si", () => {
    expect(buildChartRows(PONTOS_HORA, "dia")[1].x).not.toBe(
      buildChartRows(PONTOS_HORA, "hora")[1].x
    );
  });

  it("preserva o acumulado e a ordem dos pontos", () => {
    expect(buildChartRows(PONTOS, "dia").map((r) => r.cumulative)).toEqual([2, 5]);
    expect(buildChartRows([], "hora")).toEqual([]);
  });
});

const DAILY: VendasViewDailyRow[] = [
  { day: "2026-07-01", sales: 2 },
  { day: "2026-07-02", sales: 3 },
];
const HOURLY: VendasViewHourlyRow[] = [
  { hour: "2026-07-01T10", sales: 1 },
  { hour: "2026-07-01T12", sales: 4 },
];

// Wrapper controlado: a granularidade vive no dashboard em produção.
function Harness({
  daily = DAILY,
  hourly = HOURLY as VendasViewHourlyRow[] | null,
}: {
  daily?: VendasViewDailyRow[];
  hourly?: VendasViewHourlyRow[] | null;
}) {
  const [granularity, setGranularity] = useState<ChartGranularity>("dia");
  return (
    <ViewCumulativeChart
      daily={daily}
      hourly={hourly}
      granularity={granularity}
      onGranularityChange={setGranularity}
    />
  );
}

describe("ViewCumulativeChart — vendas acumuladas", () => {
  it("abre em dia, com o título de vendas acumuladas e o chip de dia marcado", () => {
    render(<Harness />);
    expect(screen.getByTestId("view-cumulative-chart")).toHaveTextContent("Vendas acumuladas");
    expect(screen.getByTestId("view-cumulative-granularity-dia")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("view-cumulative-granularity-hora")).toHaveAttribute("aria-pressed", "false");
  });

  it("alterna para hora e ajusta o título", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("view-cumulative-granularity-hora"));
    expect(screen.getByTestId("view-cumulative-chart")).toHaveTextContent("Vendas acumuladas — por hora");
    expect(screen.getByTestId("view-cumulative-granularity-hora")).toHaveAttribute("aria-pressed", "true");
  });

  it("não renderiza o switch de granularidade quando a série horária não chegou", () => {
    render(<Harness hourly={null} />);
    expect(screen.queryByTestId("view-cumulative-granularity")).not.toBeInTheDocument();
  });

  it("mostra o vazio quando o acumulado soma zero", () => {
    render(<Harness daily={[{ day: "2026-07-01", sales: 0 }]} />);
    expect(screen.getByTestId("view-cumulative-chart-empty")).toHaveTextContent("Sem vendas no período.");
  });
});
