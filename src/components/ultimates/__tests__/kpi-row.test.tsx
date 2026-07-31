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
    naoRenovados: 2,
    renovacoesSemVinculo: 4,
    renovacoesSemVinculoReembolsadas: 1,
    // min(4, 2) = 2 — distinto de renovacoesSemVinculo (4), então uma troca
    // entre as duas variáveis no componente fica detectável pelos testes
    // abaixo (antes coincidiam em 4 e mascaravam essa troca).
    possivelmenteRenovados: 2,
  });

  it("substitui o 5º tile por Renovações sem vínculo, com o total das duas categorias", () => {
    render(<KpiRow kpis={semVinculo} countsNewBuyers={false} />);
    const tile = screen.getByTestId("ultimates-kpi-renovacoes-sem-vinculo");
    expect(tile).toHaveTextContent("Renovações sem vínculo");
    // 4 aprovadas + 1 reembolsada = 5, com a reembolsada destacada no sufixo
    expect(tile).toHaveTextContent("5 (+1 ⟲)");
    expect(screen.queryByTestId("ultimates-kpi-novos-compradores")).toBeNull();
  });

  // O tile mostra o TOTAL puro. As 4 sem vínculo já estão dentro dos 141 (a
  // soma é feita em aggregateRosterKpis), mas não são decompostas aqui — quem
  // dá essa contagem é o 5º tile.
  it("mostra o total de renovados sem decompor as sem vínculo", () => {
    render(<KpiRow kpis={semVinculo} countsNewBuyers={false} />);
    const tile = screen.getByTestId("ultimates-kpi-renovados");
    expect(tile).toHaveTextContent("141");
    expect(tile).not.toHaveTextContent("sem vínculo");
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
    expect(tile).toHaveTextContent("2");
    expect(tile).toHaveTextContent("até 2 renovaram com outro email");
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

describe("KpiRow — sinalização de leads excluídos (PRD editar_roster)", () => {
  it("mostra quantos leads estão excluídos no tile Base", () => {
    render(<KpiRow kpis={kpis({ base: 120 })} countsNewBuyers excludedBuyersCount={3} />);

    const tile = screen.getByTestId("ultimates-kpi-base");
    expect(tile).toHaveTextContent("120");
    expect(tile).toHaveTextContent("3 excluídos");
  });

  it("usa o singular com um único excluído", () => {
    render(<KpiRow kpis={kpis({ base: 120 })} countsNewBuyers excludedBuyersCount={1} />);

    expect(screen.getByTestId("ultimates-kpi-base")).toHaveTextContent("1 excluído");
  });

  it("não diz nada quando ninguém está excluído", () => {
    render(<KpiRow kpis={kpis({ base: 120 })} countsNewBuyers excludedBuyersCount={0} />);

    expect(screen.getByTestId("ultimates-kpi-base")).not.toHaveTextContent("excluído");
  });

  it("não diz nada quando o contador nem foi informado", () => {
    render(<KpiRow kpis={kpis({ base: 120 })} countsNewBuyers />);

    expect(screen.getByTestId("ultimates-kpi-base")).not.toHaveTextContent("excluído");
  });
});
