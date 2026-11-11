/** @jest-environment jsdom */
import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GraficoAcumulado, GraficoDeVendas } from "../vendas/graficos-de-vendas";
import { PorProduto } from "../vendas/por-produto";
import type { ChartGranularity } from "@/lib/vendas/cumulative-chart";
import type { VendasViewDailyRow, VendasViewHourlyRow } from "@/types/vendas";
import { mockReducedMotion } from "./helpers";

// O chunk lazy dos gráficos vira o gráfico real.
jest.mock("../evento/charts-lazy", () => {
  const c = jest.requireActual("../charts");
  return { LineChartLazy: c.LineChart, BarChartDiarioLazy: c.BarChartDiario };
});

beforeEach(() => mockReducedMotion(false));

const DAILY: VendasViewDailyRow[] = [
  { day: "2026-07-01", sales: 2 },
  { day: "2026-07-02", sales: 3 },
];
const HOURLY: VendasViewHourlyRow[] = [
  { hour: "2026-07-01T10", sales: 1 },
  { hour: "2026-07-01T12", sales: 4 },
];

// A granularidade vive no dashboard em produção e é compartilhada pelos dois gráficos.
function Par({
  daily = DAILY,
  hourly = HOURLY as VendasViewHourlyRow[] | null,
}: {
  daily?: VendasViewDailyRow[];
  hourly?: VendasViewHourlyRow[] | null;
}) {
  const [g, setG] = useState<ChartGranularity>("dia");
  return (
    <>
      <GraficoDeVendas daily={daily} hourly={hourly} granularity={g} onGranularityChange={setG} />
      <GraficoAcumulado daily={daily} hourly={hourly} granularity={g} onGranularityChange={setG} />
    </>
  );
}

const aba = (cartao: string, nome: string) =>
  within(screen.getByTestId(cartao)).getByRole("tab", { name: nome });

describe("GraficoDeVendas e GraficoAcumulado", () => {
  it("abrem em Dia, com os títulos de dia e a aba Dia marcada", () => {
    render(<Par />);
    expect(screen.getByTestId("view-daily-chart")).toHaveTextContent("Vendas por dia");
    expect(screen.getByTestId("view-cumulative-chart")).toHaveTextContent("Vendas acumuladas");
    expect(aba("view-daily-chart", "Dia")).toHaveAttribute("aria-selected", "true");
    expect(aba("view-cumulative-chart", "Dia")).toHaveAttribute("aria-selected", "true");
  });

  it("alternar Dia/Hora em um gráfico troca os dois ao mesmo tempo", () => {
    render(<Par />);
    fireEvent.click(aba("view-daily-chart", "Hora"));
    expect(screen.getByTestId("view-daily-chart")).toHaveTextContent("Vendas por hora");
    expect(screen.getByTestId("view-cumulative-chart")).toHaveTextContent("Vendas acumuladas por hora");
    expect(aba("view-cumulative-chart", "Hora")).toHaveAttribute("aria-selected", "true");

    fireEvent.click(aba("view-cumulative-chart", "Dia"));
    expect(screen.getByTestId("view-daily-chart")).toHaveTextContent("Vendas por dia");
  });

  it("sem série horária o switch não aparece e os gráficos seguem por dia", () => {
    render(<Par hourly={null} />);
    expect(screen.queryByTestId("view-daily-granularity")).not.toBeInTheDocument();
    expect(screen.queryByTestId("view-cumulative-granularity")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-daily-chart")).toHaveTextContent("Vendas por dia");
  });

  it("a tabela de dados acessível usa os rótulos de cada granularidade", () => {
    render(<Par />);
    const tabelaDia = within(screen.getByTestId("view-daily-chart")).getByRole("table", { hidden: true });
    expect(tabelaDia).toHaveTextContent("01/07");
    expect(tabelaDia).toHaveTextContent("Dia");

    fireEvent.click(aba("view-daily-chart", "Hora"));
    const tabelaHora = within(screen.getByTestId("view-daily-chart")).getByRole("table", { hidden: true });
    expect(tabelaHora).toHaveTextContent("01/07 às 10h");
    expect(tabelaHora).toHaveTextContent("Hora");
  });

  it("as barras vão em azul IGT e o último ponto do acumulado é o único em âmbar", () => {
    const { container } = render(<Par />);
    const barras = within(screen.getByTestId("view-daily-chart")).getByRole("group");
    expect(barras.innerHTML).toContain("--v2-azul-igt");
    expect(barras.innerHTML).not.toContain("--v2-ponto");

    const vivos = container.querySelectorAll("[data-ponto-vivo]");
    expect(vivos).toHaveLength(1);
    expect(screen.getByTestId("view-cumulative-chart").contains(vivos[0])).toBe(true);
  });

  it("o acumulado soma na ordem do tempo (3 vira 5 vira 8)", () => {
    render(
      <Par
        daily={[
          { day: "2026-07-02", sales: 3 },
          { day: "2026-07-01", sales: 2 },
        ]}
      />,
    );
    const tabela = within(screen.getByTestId("view-cumulative-chart")).getByRole("table", { hidden: true });
    const celulas = Array.from(tabela.querySelectorAll("tbody tr")).map((tr) => tr.textContent);
    expect(celulas[0]).toContain("2");
    expect(celulas[1]).toContain("5");
  });

  it("sem vendas no período mostra o vazio nos dois", () => {
    render(<Par daily={[{ day: "2026-07-01", sales: 0 }]} hourly={null} />);
    expect(screen.getByTestId("view-daily-chart-empty")).toHaveTextContent("Sem vendas no período.");
    expect(screen.getByTestId("view-cumulative-chart-empty")).toHaveTextContent("Sem vendas no período.");
  });
});

describe("PorProduto", () => {
  const P1 = { product_id: "p1", product_name: "Produto Um" };
  const P2 = { product_id: "p2", product_name: "Produto Dois" };
  const LINHAS = [
    { ...P1, offer_code: "OF-1", offer_name: "Oferta Um", sales: 7, refunded: 2 },
    { ...P1, offer_code: "OF-2", offer_name: null, sales: 0, refunded: 0 },
    { ...P2, offer_code: "OF-3", offer_name: "Oferta Três", sales: 1, refunded: 1 },
  ];
  const abrir = (id: string) => fireEvent.click(screen.getByTestId(`view-product-${id}-toggle`));

  it("lista cada produto com o subtotal e o total geral", () => {
    render(<PorProduto offers={LINHAS} />);
    expect(screen.getByText("Total nos produtos: 8")).toBeInTheDocument();
    expect(screen.getByTestId("view-product-p1")).toHaveTextContent("Produto Um");
    expect(screen.getByTestId("view-product-p1-sales")).toHaveTextContent("7");
    expect(screen.getByTestId("view-product-p2-sales")).toHaveTextContent("1");
    expect(screen.getByTestId("view-product-p1")).toHaveTextContent("2 ofertas");
    expect(screen.getByTestId("view-product-p2")).toHaveTextContent("1 oferta");
  });

  it("as ofertas só aparecem ao expandir o produto, e só as dele", () => {
    render(<PorProduto offers={LINHAS} />);
    expect(screen.queryByTestId("view-offer-OF-1")).not.toBeInTheDocument();
    abrir("p1");
    expect(screen.getByTestId("view-product-p1-toggle")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("view-offer-OF-1")).toHaveTextContent("Oferta Um");
    expect(screen.getByTestId("view-offer-OF-1-sales")).toHaveTextContent("7");
    expect(screen.getByTestId("view-offer-OF-2")).not.toHaveTextContent(", ");
    expect(screen.queryByTestId("view-offer-OF-3")).not.toBeInTheDocument();
    abrir("p1");
    expect(screen.queryByTestId("view-offer-OF-1")).not.toBeInTheDocument();
  });

  it("oferta sem venda coletada mostra 0 e a marca; oferta com venda não tem a marca", () => {
    render(<PorProduto offers={LINHAS} />);
    abrir("p1");
    expect(screen.getByTestId("view-offer-OF-2-sales")).toHaveTextContent("0");
    expect(screen.getByTestId("view-offer-OF-2-empty")).toHaveTextContent("0 vendas coletadas");
    expect(screen.queryByTestId("view-offer-OF-1-empty")).not.toBeInTheDocument();
  });

  it("produto com todas as ofertas em zero continua na lista", () => {
    render(<PorProduto offers={[{ ...P2, offer_code: "OF-7", offer_name: null, sales: 0, refunded: 0 }]} />);
    expect(screen.getByTestId("view-product-p2-sales")).toHaveTextContent("0");
  });

  it("oferta com reembolso mas sem venda não ganha a marca de 'sem vendas coletadas'", () => {
    render(<PorProduto offers={[{ ...P1, offer_code: "OF-9", offer_name: null, sales: 0, refunded: 3 }]} />);
    abrir("p1");
    expect(screen.queryByTestId("view-offer-OF-9-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-offer-OF-9")).toHaveTextContent("3 reembolsadas");
  });

  it("reembolsadas no singular e no plural, no produto e na oferta", () => {
    render(<PorProduto offers={LINHAS} />);
    expect(screen.getByTestId("view-product-p1-refunded")).toHaveTextContent("2 reembolsadas");
    expect(screen.getByTestId("view-product-p2-refunded")).toHaveTextContent("1 reembolsada");
    expect(screen.getByTestId("view-product-p2-refunded")).not.toHaveTextContent("1 reembolsadas");
    abrir("p2");
    expect(screen.getByTestId("view-offer-OF-3")).toHaveTextContent("1 reembolsada");
    expect(screen.getByTestId("view-offer-OF-3")).not.toHaveTextContent("1 reembolsadas");
  });

  it("o cabeçalho da seção não leva numeração", () => {
    render(<PorProduto offers={LINHAS} />);
    expect(screen.getByRole("heading", { name: "Por produto" })).toBeInTheDocument();
  });
});
