/** @jest-environment jsdom */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionProvider } from "../motion";
import { BarChartDiario, LineChart } from "../charts";
import { mockReducedMotion } from "./helpers";

beforeEach(() => mockReducedMotion(false));

const dia = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 12));
const pts = [0, 1, 2, 3].map((i) => ({ x: dia(i), y: 10 + i }));
const serie = [{ id: "a", label: "Receita", data: pts }];
const com = (ui: React.ReactElement) => render(<MotionProvider>{ui}</MotionProvider>);
const vivo = (c: HTMLElement) => c.querySelector('[aria-live="polite"]')!.textContent;

describe("índice ativo controlado (retrocompatível)", () => {
  it("LineChart: indiceAtivo de fora destaca o dia sem interação", () => {
    const { container } = com(<LineChart titulo="Receita" series={serie} indiceAtivo={2} />);
    expect(vivo(container)).toContain("Receita 12");
  });

  it("LineChart: sem a prop continua funcionando sozinho", () => {
    const { container } = com(<LineChart titulo="Receita" series={serie} />);
    expect(vivo(container)).toBe("");
    fireEvent.keyDown(screen.getByRole("group"), { key: "End" });
    expect(vivo(container)).toContain("Receita 13");
  });

  it("LineChart: teclado avisa onIndiceAtivo e, controlado, só muda quando o pai muda", () => {
    const fn = jest.fn();
    const { container } = com(<LineChart titulo="Receita" series={serie} indiceAtivo={null} onIndiceAtivo={fn} />);
    fireEvent.keyDown(screen.getByRole("group"), { key: "End" });
    expect(fn).toHaveBeenLastCalledWith(3);
    expect(vivo(container)).toBe("");
  });

  it("BarChartDiario: indiceAtivo de fora destaca o dia e onIndiceAtivo é chamado pelas setas", () => {
    const fn = jest.fn();
    const { container } = com(<BarChartDiario titulo="Vendas" cor="var(--c)" data={pts} indiceAtivo={1} onIndiceAtivo={fn} />);
    expect(vivo(container)).toContain("11");
    fireEvent.keyDown(screen.getByRole("group"), { key: "ArrowRight" });
    expect(fn).toHaveBeenLastCalledWith(2);
  });

  it("BarChartDiario: modo não controlado inalterado", () => {
    const { container } = com(<BarChartDiario titulo="Vendas" cor="var(--c)" data={pts} />);
    fireEvent.keyDown(screen.getByRole("group"), { key: "Home" });
    expect(vivo(container)).toContain("10");
  });

  it("dois gráficos ligados pelo mesmo estado ficam no mesmo dia", () => {
    function Par() {
      const [i, setI] = useState<number | null>(null);
      return (
        <>
          <LineChart titulo="Receita" series={serie} indiceAtivo={i} onIndiceAtivo={setI} />
          <BarChartDiario titulo="Vendas" cor="var(--c)" data={pts} indiceAtivo={i} onIndiceAtivo={setI} />
        </>
      );
    }
    const { container } = com(<Par />);
    fireEvent.keyDown(screen.getAllByRole("group")[0], { key: "End" });
    const vivos = container.querySelectorAll('[aria-live="polite"]');
    expect(vivos[0].textContent).toContain("Receita 13");
    expect(vivos[1].textContent).toContain("13");
  });
});
