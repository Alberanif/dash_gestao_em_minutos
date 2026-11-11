/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MotionProvider } from "../motion";
import { BarChartDiario } from "../charts";
import { mockReducedMotion } from "./helpers";

beforeEach(() => mockReducedMotion(false));

const dia = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 12));
const DADOS = [0, 1, 2].map((i) => ({ x: dia(i), y: 10 + i }));
const com = (ui: React.ReactElement) => render(<MotionProvider>{ui}</MotionProvider>);

describe("BarChartDiario: formatadores do eixo x", () => {
  it("sem formatadores mantém o comportamento por dia: data completa e coluna 'Dia'", () => {
    const { container } = com(<BarChartDiario titulo="Vendas" data={DADOS} cor="var(--v2-azul-igt)" />);
    const tabela = container.querySelector("table")!;
    expect(tabela).toHaveTextContent("Dia");
    expect(tabela.querySelectorAll("tbody tr")[0]).toHaveTextContent("01/10/2026");
    expect(screen.getByRole("group")).toHaveAttribute("aria-label", expect.stringContaining("percorrer as barras"));
  });

  it("formatadores, rótulo e unidade customizados chegam ao eixo, à tabela e ao nome acessível", () => {
    const { container } = com(
      <BarChartDiario
        titulo="Vendas por hora"
        data={DADOS}
        cor="var(--v2-azul-igt)"
        formatarX={(ms) => `curto-${new Date(ms).getUTCDate()}`}
        formatarXLongo={(ms) => `longo-${new Date(ms).getUTCDate()}`}
        rotuloX="Hora"
      />,
    );
    const tabela = container.querySelector("table")!;
    expect(tabela).toHaveTextContent("Hora");
    expect(tabela).not.toHaveTextContent("Dia");
    expect(tabela.querySelectorAll("tbody tr")[0]).toHaveTextContent("longo-1");
    expect(container.innerHTML).toContain("curto-1");
  });
});
