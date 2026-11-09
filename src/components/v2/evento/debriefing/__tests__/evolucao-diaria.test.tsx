/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionProvider } from "../../../motion";
import { mockReducedMotion } from "../../../__tests__/helpers";
import { EvolucaoDiaria } from "../evolucao-diaria";
import type { DebriefingDailyPoint } from "@/lib/indicadores/service/debriefing";

jest.mock("../../charts-lazy", () => {
  const c = jest.requireActual("../../../charts");
  return { LineChartLazy: c.LineChart, BarChartDiarioLazy: c.BarChartDiario };
});

beforeEach(() => mockReducedMotion(false));

const serie: DebriefingDailyPoint[] = [
  { date: "2026-10-07", sales_count: 3, sales_brl: 300, sales_foreign: 0, revenue: 300 },
  { date: "2026-10-08", sales_count: 1, sales_brl: 97, sales_foreign: 0, revenue: 97 },
  { date: "2026-10-09", sales_count: 5, sales_brl: 1500, sales_foreign: 0, revenue: 1500 },
];
const com = (ui: React.ReactElement) => render(<MotionProvider>{ui}</MotionProvider>);
const leitura = () => screen.getByTestId("leitura-dia").textContent ?? "";

describe("EvolucaoDiaria", () => {
  it("série vazia mostra estado vazio sem gráficos", () => {
    const { container } = com(<EvolucaoDiaria series={[]} />);
    expect(screen.getByRole("status").textContent).toContain("Sem vendas");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("desenha os dois gráficos com os mesmos dias da série e tabelas alternativas", () => {
    const { container } = com(<EvolucaoDiaria series={serie} />);
    expect(screen.getAllByRole("group")).toHaveLength(2);
    const tabelas = container.querySelectorAll("table");
    expect(tabelas).toHaveLength(2);
    for (const t of Array.from(tabelas)) expect(t.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(container.querySelector("[data-ponto-vivo]")).not.toBeNull();
    expect(container.querySelectorAll("path.v2-g-sobe")).toHaveLength(3);
  });

  it("foco/teclado em um gráfico destaca o mesmo dia no outro e na leitura", () => {
    const { container } = com(<EvolucaoDiaria series={serie} />);
    const [linha, barras] = screen.getAllByRole("group");
    fireEvent.keyDown(linha, { key: "End" });
    expect(leitura()).toContain("09/10");
    expect(leitura()).toContain("5 vendas");
    expect(leitura()).toContain("1.500,00");
    const vivos = container.querySelectorAll('[aria-live="polite"]');
    expect(vivos[1].textContent).toContain("09/10/2026");
    fireEvent.keyDown(barras, { key: "ArrowLeft" });
    expect(leitura()).toContain("08/10");
    expect(leitura()).toContain("1 venda");
    expect(vivos[0].textContent).toContain("08/10/2026");
  });

  it("Escape limpa o destaque nos dois", () => {
    const { container } = com(<EvolucaoDiaria series={serie} />);
    const [linha] = screen.getAllByRole("group");
    fireEvent.keyDown(linha, { key: "Home" });
    fireEvent.keyDown(linha, { key: "Escape" });
    const vivos = container.querySelectorAll('[aria-live="polite"]');
    expect(vivos[1].textContent).toBe("");
    expect(leitura()).toContain("Passe o mouse");
  });

  it("ordena série fora de ordem", () => {
    com(<EvolucaoDiaria series={[...serie].reverse()} />);
    fireEvent.keyDown(screen.getAllByRole("group")[0], { key: "Home" });
    expect(leitura()).toContain("07/10");
  });
});
