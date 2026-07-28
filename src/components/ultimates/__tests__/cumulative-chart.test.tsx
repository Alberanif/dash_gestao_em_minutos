/** @jest-environment jsdom */
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CumulativeChart } from "../cumulative-chart";
import { buildCumulativeSeries, type UltimatesSeries } from "@/lib/ultimates/cumulative-chart";
import type { UltimatesDailyRow } from "@/types/ultimates";

const DAYS: UltimatesDailyRow[] = [
  { day: "2026-07-01", renewals: 2, new_buyers: 0 },
  { day: "2026-07-02", renewals: 0, new_buyers: 3 },
  { day: "2026-07-03", renewals: 1, new_buyers: 1 },
];

// Wrapper controlado: o estado da série vive no dashboard em produção, então
// o teste do switch precisa reproduzir esse ciclo (clique -> nova prop).
function Harness({ days = DAYS }: { days?: UltimatesDailyRow[] }) {
  const [series, setSeries] = useState<UltimatesSeries>("renovacoes");
  return (
    <CumulativeChart
      data={buildCumulativeSeries(days, series)}
      series={series}
      onSeriesChange={setSeries}
    />
  );
}

describe("CumulativeChart — switch entre renovações e novos compradores", () => {
  it("abre em renovações, com o botão da série ativa marcado", () => {
    render(<Harness />);

    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-series", "renovacoes");
    expect(screen.getByText("Renovações acumuladas")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-cumulative-series-renovacoes")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("ultimates-cumulative-series-novos")).toHaveAttribute("aria-pressed", "false");
  });

  it("alterna para novos compradores ao clicar no switch", () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId("ultimates-cumulative-series-novos"));

    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-series", "novos");
    expect(screen.getByText("Novos compradores acumulados")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-cumulative-series-novos")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Renovações acumuladas")).not.toBeInTheDocument();
  });

  it("volta para renovações ao clicar de novo no outro botão", () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId("ultimates-cumulative-series-novos"));
    fireEvent.click(screen.getByTestId("ultimates-cumulative-series-renovacoes"));

    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-series", "renovacoes");
    expect(screen.getByText("Renovações acumuladas")).toBeInTheDocument();
  });

  it("mostra vazio por série: sem renovações no ciclo, mas com novos compradores", () => {
    const onlyNew: UltimatesDailyRow[] = [
      { day: "2026-07-01", renewals: 0, new_buyers: 2 },
      { day: "2026-07-02", renewals: 0, new_buyers: 1 },
    ];
    render(<Harness days={onlyNew} />);

    // Os dias existem (eixo compartilhado), mas a série ativa soma zero — o
    // card diz isso em vez de desenhar uma linha reta colada no eixo.
    expect(screen.getByTestId("ultimates-cumulative-chart-empty")).toHaveTextContent(
      "Sem renovações registradas no ciclo ainda."
    );

    // E o switch continua acessível para ver a outra série, que tem dados.
    fireEvent.click(screen.getByTestId("ultimates-cumulative-series-novos"));
    expect(screen.queryByTestId("ultimates-cumulative-chart-empty")).not.toBeInTheDocument();
  });

  it("mostra o vazio de novos compradores quando só houve renovações", () => {
    const onlyRenewals: UltimatesDailyRow[] = [{ day: "2026-07-01", renewals: 5, new_buyers: 0 }];
    render(<Harness days={onlyRenewals} />);

    fireEvent.click(screen.getByTestId("ultimates-cumulative-series-novos"));

    expect(screen.getByTestId("ultimates-cumulative-chart-empty")).toHaveTextContent(
      "Sem novos compradores registrados no ciclo ainda."
    );
  });

  it("mostra vazio quando o ciclo não tem nenhum dia com venda", () => {
    render(<Harness days={[]} />);
    expect(screen.getByTestId("ultimates-cumulative-chart-empty")).toBeInTheDocument();
  });
});
