/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { KpiRow } from "../kpi-row";
import type { RosterKpis } from "@/lib/vendas/kpi-aggregation";

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

describe("KpiRow — modo Apenas Compras", () => {
  it("com purchaseKpis, mostra Compras, Compras reembolsadas e Valor total", () => {
    render(
      <KpiRow
        kpis={kpis()}
        countsNewBuyers
        purchaseKpis={{ compras: 42, comprasReembolsadas: 3, valorTotal: 4970 }}
      />
    );

    expect(screen.getByTestId("ultimates-kpi-compras")).toHaveTextContent("Compras");
    expect(screen.getByTestId("ultimates-kpi-compras")).toHaveTextContent("42");
    expect(screen.getByTestId("ultimates-kpi-compras-reembolsadas")).toHaveTextContent(
      "Compras reembolsadas"
    );
    expect(screen.getByTestId("ultimates-kpi-compras-reembolsadas")).toHaveTextContent("3");
    const valor = screen.getByTestId("ultimates-kpi-valor-total");
    expect(valor).toHaveTextContent("Valor total");
    expect(valor).toHaveTextContent("4.970");
  });

  it("com purchaseKpis, some com os tiles de renovação", () => {
    render(
      <KpiRow
        kpis={kpis()}
        countsNewBuyers
        purchaseKpis={{ compras: 1, comprasReembolsadas: 0, valorTotal: 100 }}
      />
    );

    expect(screen.queryByTestId("ultimates-kpi-base")).toBeNull();
    expect(screen.queryByTestId("ultimates-kpi-renovados")).toBeNull();
    expect(screen.queryByTestId("ultimates-kpi-nao-renovados")).toBeNull();
    expect(screen.queryByTestId("ultimates-kpi-novos-compradores")).toBeNull();
    expect(screen.queryByTestId("ultimates-kpi-renovacoes-sem-vinculo")).toBeNull();
  });

  it("sem purchaseKpis, mantém os tiles de renovação intactos", () => {
    render(<KpiRow kpis={kpis()} countsNewBuyers />);
    expect(screen.getByTestId("ultimates-kpi-base")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-kpi-compras")).toBeNull();
  });
});

describe("KpiRow — recorte por período (spec filtro de datas)", () => {
  const ciclo = kpis({
    base: 500,
    renovados: 250,
    renovadosPercent: 50,
    renovacaoReembolsada: 8,
    naoRenovados: 242,
    novosCompradores: 90,
  });

  it("sem periodKpis, todos os tiles saem de kpis", () => {
    render(<KpiRow kpis={ciclo} countsNewBuyers />);

    expect(screen.getByTestId("ultimates-kpi-base")).toHaveTextContent("500");
    expect(screen.getByTestId("ultimates-kpi-renovados")).toHaveTextContent("250");
    expect(screen.getByTestId("ultimates-kpi-renovados")).toHaveTextContent("da base");
    expect(screen.getByTestId("ultimates-kpi-novos-compradores")).toHaveTextContent("90");
  });

  it("com periodKpis, movimento vem da janela e estoque continua do ciclo", () => {
    render(
      <KpiRow
        kpis={ciclo}
        periodKpis={kpis({
          base: 130,
          renovados: 120,
          renovacaoReembolsada: 5,
          naoRenovados: 0,
          novosCompradores: 40,
        })}
        countsNewBuyers
      />
    );

    // Estoque: ciclo. Repare que periodKpis traz base 130 e naoRenovados 0 —
    // são justamente os números que NÃO podem vazar para a tela.
    expect(screen.getByTestId("ultimates-kpi-base")).toHaveTextContent("500");
    expect(screen.getByTestId("ultimates-kpi-nao-renovados")).toHaveTextContent("242");
    // Movimento: janela.
    expect(screen.getByTestId("ultimates-kpi-renovados")).toHaveTextContent("120");
    expect(screen.getByTestId("ultimates-kpi-renovacao-reembolsada")).toHaveTextContent("5");
    expect(screen.getByTestId("ultimates-kpi-novos-compradores")).toHaveTextContent("40");
  });

  it("com periodKpis, o subtítulo de Renovados vira 'no período'", () => {
    render(<KpiRow kpis={ciclo} periodKpis={kpis({ renovados: 120 })} countsNewBuyers />);

    const tile = screen.getByTestId("ultimates-kpi-renovados");
    expect(tile).toHaveTextContent("no período");
    // Misturar numerador da janela com denominador do ciclo na mesma frase
    // daria um percentual que não significa nem uma coisa nem outra.
    expect(tile).not.toHaveTextContent("da base");
  });

  it("com periodKpis, a dica de Não renovados segue vindo do ciclo", () => {
    render(
      <KpiRow
        kpis={kpis({ naoRenovados: 19, renovacoesSemVinculo: 4, possivelmenteRenovados: 2 })}
        periodKpis={kpis({ naoRenovados: 0, possivelmenteRenovados: 0 })}
        countsNewBuyers={false}
      />
    );

    const tile = screen.getByTestId("ultimates-kpi-nao-renovados");
    expect(tile).toHaveTextContent("19");
    expect(tile).toHaveTextContent("até 2 renovaram com outro email");
  });

  it("com periodKpis e ciclo sem novas compras, o 5º tile lê da janela", () => {
    render(
      <KpiRow
        kpis={kpis({ renovacoesSemVinculo: 30, renovacoesSemVinculoReembolsadas: 2 })}
        periodKpis={kpis({ renovacoesSemVinculo: 7, renovacoesSemVinculoReembolsadas: 1 })}
        countsNewBuyers={false}
      />
    );

    // 7 aprovadas + 1 reembolsada = 8, tudo da janela.
    expect(screen.getByTestId("ultimates-kpi-renovacoes-sem-vinculo")).toHaveTextContent(
      "8 (+1 ⟲)"
    );
  });
});
