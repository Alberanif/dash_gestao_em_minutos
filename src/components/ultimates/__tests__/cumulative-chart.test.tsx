/** @jest-environment jsdom */
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CumulativeChart } from "../cumulative-chart";
import {
  buildCumulativeSeries,
  buildHourlyCumulativeSeries,
  type UltimatesGranularity,
  type UltimatesSeries,
} from "@/lib/ultimates/cumulative-chart";
import type { UltimatesDailyRow, UltimatesHourlyRow } from "@/types/ultimates";

const DAYS: UltimatesDailyRow[] = [
  { day: "2026-07-01", renewals: 2, new_buyers: 0 },
  { day: "2026-07-02", renewals: 0, new_buyers: 3 },
  { day: "2026-07-03", renewals: 1, new_buyers: 1 },
];

const HOURS: UltimatesHourlyRow[] = [
  { hour: "2026-07-01T20", renewals: 2, new_buyers: 0 },
  { hour: "2026-07-01T22", renewals: 1, new_buyers: 3 },
];

// Wrapper controlado: série e granularidade vivem no dashboard em produção,
// então o teste dos switches precisa reproduzir esse ciclo (clique -> nova
// prop).
function Harness({
  days = DAYS,
  hours = HOURS,
  countsNewBuyers = true,
  granularityAvailable = true,
}: {
  days?: UltimatesDailyRow[];
  hours?: UltimatesHourlyRow[];
  countsNewBuyers?: boolean;
  granularityAvailable?: boolean;
}) {
  const [series, setSeries] = useState<UltimatesSeries>("renovacoes");
  const [granularity, setGranularity] = useState<UltimatesGranularity>("dia");
  const activeSeries = countsNewBuyers ? series : "renovacoes";
  return (
    <CumulativeChart
      data={
        granularity === "hora"
          ? buildHourlyCumulativeSeries(hours, activeSeries)
          : buildCumulativeSeries(days, activeSeries)
      }
      series={activeSeries}
      onSeriesChange={setSeries}
      countsNewBuyers={countsNewBuyers}
      granularity={granularity}
      onGranularityChange={setGranularity}
      granularityAvailable={granularityAvailable}
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

describe("CumulativeChart — ciclo sem novas compras", () => {
  it("não renderiza o switch de séries", () => {
    render(<Harness countsNewBuyers={false} />);
    expect(screen.queryByTestId("ultimates-cumulative-series-switch")).toBeNull();
  });

  // Smoke test: o Harness já fixa series="renovacoes" quando countsNewBuyers
  // é false, então isto não verifica a lógica de esconder o switch — só
  // garante que esconder o switch não quebra a renderização do cabeçalho.
  it("esconder o switch não quebra o cabeçalho do card", () => {
    render(<Harness countsNewBuyers={false} />);
    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveTextContent(
      "Renovações acumuladas"
    );
  });

  it("o switch continua presente quando o ciclo admite novas compras", () => {
    render(<Harness countsNewBuyers />);
    expect(screen.getByTestId("ultimates-cumulative-series-switch")).toBeInTheDocument();
  });
});

describe("CumulativeChart — switch de granularidade", () => {
  it("abre em dia, com o chip de dia marcado", () => {
    render(<Harness />);

    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-granularity", "dia");
    expect(screen.getByTestId("ultimates-cumulative-granularity-dia")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("ultimates-cumulative-granularity-hora")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Renovações acumuladas")).toBeInTheDocument();
  });

  it("alterna para hora e ajusta o título do card", () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-hora"));

    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-granularity", "hora");
    expect(screen.getByText("Renovações acumuladas — por hora")).toBeInTheDocument();
  });

  it("volta para dia ao clicar no outro chip", () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-hora"));
    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-dia"));

    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-granularity", "dia");
    expect(screen.getByText("Renovações acumuladas")).toBeInTheDocument();
  });

  // O switch de granularidade não depende da política do ciclo: mesmo sem
  // novas compras existe uma curva para olhar por hora.
  it("continua visível quando o switch de séries está escondido", () => {
    render(<Harness countsNewBuyers={false} />);

    expect(screen.queryByTestId("ultimates-cumulative-series-switch")).toBeNull();
    expect(screen.getByTestId("ultimates-cumulative-granularity-switch")).toBeInTheDocument();
  });

  it("as duas dimensões são independentes: série e granularidade combinam livremente", () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId("ultimates-cumulative-series-novos"));
    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-hora"));

    const card = screen.getByTestId("ultimates-cumulative-chart");
    expect(card).toHaveAttribute("data-series", "novos");
    expect(card).toHaveAttribute("data-granularity", "hora");
    expect(screen.getByText("Novos compradores acumulados — por hora")).toBeInTheDocument();
  });

  // Sem a série horária (rota fora do ar, migration 054 pendente) o card não
  // oferece o chip: um "Hora" clicável levando a um gráfico vazio mentiria
  // sobre não haver vendas naquelas horas.
  it("não renderiza o grupo de granularidade quando a série horária não chegou", () => {
    render(<Harness granularityAvailable={false} />);

    expect(screen.queryByTestId("ultimates-cumulative-granularity-switch")).toBeNull();
    expect(screen.queryByTestId("ultimates-cumulative-granularity-hora")).toBeNull();
    // O resto do card segue inteiro, na visão dia.
    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-granularity", "dia");
    expect(screen.getByText("Renovações acumuladas")).toBeInTheDocument();
  });

  // Lista vazia é "ciclo sem venda ainda", não "série indisponível" — o chip
  // continua lá para quem quiser conferir a visão hora.
  it("mantém o grupo de granularidade quando a série horária chegou vazia", () => {
    render(<Harness hours={[]} />);
    expect(screen.getByTestId("ultimates-cumulative-granularity-switch")).toBeInTheDocument();
  });

  it("mostra o vazio da série na visão hora quando a métrica ativa soma zero", () => {
    const semRenovacoes: UltimatesHourlyRow[] = [{ hour: "2026-07-01T20", renewals: 0, new_buyers: 2 }];
    render(<Harness hours={semRenovacoes} />);

    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-hora"));

    expect(screen.getByTestId("ultimates-cumulative-chart-empty")).toHaveTextContent(
      "Sem renovações registradas no ciclo ainda."
    );
    // E o switch de granularidade continua acessível para voltar.
    expect(screen.getByTestId("ultimates-cumulative-granularity-switch")).toBeInTheDocument();
  });
});
