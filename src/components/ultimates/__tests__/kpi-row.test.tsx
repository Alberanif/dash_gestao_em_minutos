/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { KpiRow } from "../kpi-row";
import type { RosterKpis } from "@/lib/ultimates/kpi-aggregation";

function kpis(overrides: Partial<RosterKpis> = {}): RosterKpis {
  return {
    base: 163,
    renovados: 137,
    renovadosPercent: 84.05,
    renovacaoReembolsada: 3,
    naoRenovados: 19,
    novosCompradores: 0,
    novosReembolsados: 0,
    renovacoesSemVinculo: 0,
    renovacoesSemVinculoReembolsadas: 0,
    possivelmenteRenovados: 0,
    ...overrides,
  };
}

describe("KpiRow — ciclo que admite novas compras", () => {
  it("mostra o tile de novos compradores", () => {
    render(<KpiRow kpis={kpis({ novosCompradores: 5, novosReembolsados: 1 })} countsNewBuyers />);
    expect(screen.getByTestId("ultimates-kpi-novos-compradores")).toHaveTextContent(
      "Novos Compradores"
    );
    expect(screen.queryByTestId("ultimates-kpi-renovacoes-sem-vinculo")).toBeNull();
  });

  it("não põe sufixo de sem vínculo em Renovados", () => {
    render(<KpiRow kpis={kpis()} countsNewBuyers />);
    expect(screen.getByTestId("ultimates-kpi-renovados")).not.toHaveTextContent("sem vínculo");
  });

  it("não mostra a dica em Não renovados", () => {
    render(<KpiRow kpis={kpis()} countsNewBuyers />);
    expect(screen.getByTestId("ultimates-kpi-nao-renovados")).not.toHaveTextContent(
      "outro email"
    );
  });
});

describe("KpiRow — ciclo sem novas compras", () => {
  const semVinculo = kpis({
    renovados: 141,
    renovadosPercent: 86.5,
    renovacaoReembolsada: 4,
    renovacoesSemVinculo: 4,
    renovacoesSemVinculoReembolsadas: 1,
    possivelmenteRenovados: 4,
  });

  it("substitui o 5º tile por Renovações sem vínculo, com o total das duas categorias", () => {
    render(<KpiRow kpis={semVinculo} countsNewBuyers={false} />);
    const tile = screen.getByTestId("ultimates-kpi-renovacoes-sem-vinculo");
    expect(tile).toHaveTextContent("Renovações sem vínculo");
    // 4 aprovadas + 1 reembolsada = 5, com a reembolsada destacada no sufixo
    expect(tile).toHaveTextContent("5 (+1 ⟲)");
    expect(screen.queryByTestId("ultimates-kpi-novos-compradores")).toBeNull();
  });

  it("soma no tile Renovados com o sufixo só das aprovadas", () => {
    render(<KpiRow kpis={semVinculo} countsNewBuyers={false} />);
    expect(screen.getByTestId("ultimates-kpi-renovados")).toHaveTextContent(
      "141 (+4 sem vínculo)"
    );
  });

  it("soma no tile de reembolsadas com o sufixo das reembolsadas sem vínculo", () => {
    render(<KpiRow kpis={semVinculo} countsNewBuyers={false} />);
    expect(screen.getByTestId("ultimates-kpi-renovacao-reembolsada")).toHaveTextContent(
      "4 (+1 sem vínculo)"
    );
  });

  it("mostra a dica em Não renovados sem alterar o valor", () => {
    render(<KpiRow kpis={semVinculo} countsNewBuyers={false} />);
    const tile = screen.getByTestId("ultimates-kpi-nao-renovados");
    expect(tile).toHaveTextContent("19");
    expect(tile).toHaveTextContent("até 4 renovaram com outro email");
  });

  it("omite sufixos e dica quando não há nenhuma renovação sem vínculo", () => {
    render(<KpiRow kpis={kpis()} countsNewBuyers={false} />);
    expect(screen.getByTestId("ultimates-kpi-renovados")).not.toHaveTextContent("sem vínculo");
    expect(screen.getByTestId("ultimates-kpi-nao-renovados")).not.toHaveTextContent(
      "outro email"
    );
    expect(screen.getByTestId("ultimates-kpi-renovacoes-sem-vinculo")).toHaveTextContent("0");
  });
});
