/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OriginBreakdownTable } from "../origin-breakdown-table";
import type { OriginBreakdownBlock } from "@/lib/vendas/origin-breakdown";

const BLOCKS: OriginBreakdownBlock[] = [
  {
    key: "modalidade",
    title: "Por modalidade",
    rows: [
      { origin: "Presencial", purchases: 19, base: 238, conversion: 7.983 },
      { origin: "Online", purchases: 15, base: 486, conversion: 3.086 },
      { origin: null, purchases: 3, base: null, conversion: null },
    ],
  },
];

describe("OriginBreakdownTable", () => {
  it("mostra compras, base e conversão formatada por origem", () => {
    render(<OriginBreakdownTable blocks={BLOCKS} loading={false} error={false} />);

    const presencial = screen.getByRole("row", { name: /Presencial/ });
    expect(within(presencial).getByText("19")).toBeInTheDocument();
    expect(within(presencial).getByText("238")).toBeInTheDocument();
    expect(within(presencial).getByText("8,0%")).toBeInTheDocument();
  });

  it("mostra travessão em base e conversão dos não encontrados", () => {
    render(<OriginBreakdownTable blocks={BLOCKS} loading={false} error={false} />);

    const naoEncontrados = screen.getByRole("row", { name: /Não encontrados/ });
    expect(within(naoEncontrados).getByText("3")).toBeInTheDocument();
    // Base e conversão: não existe denominador para quem não está na base.
    expect(within(naoEncontrados).getAllByText("—")).toHaveLength(2);
  });

  it("preserva a ordem das linhas que o servidor mandou", () => {
    render(<OriginBreakdownTable blocks={BLOCKS} loading={false} error={false} />);

    // A ordenação é a informação (conversão desc) — a tabela não reordena.
    const labels = screen
      .getAllByRole("rowheader")
      .map((el) => el.textContent);
    expect(labels).toEqual(["Presencial", "Online", "Não encontrados"]);
  });

  it("avisa quando o cruzamento falha, em vez de sumir", () => {
    render(<OriginBreakdownTable blocks={null} loading={false} error />);

    expect(screen.getByTestId("ultimates-origin-error")).toHaveTextContent(
      "Não foi possível cruzar com a base de inscritos."
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("mostra esqueleto enquanto carrega", () => {
    render(<OriginBreakdownTable blocks={null} loading error={false} />);

    expect(screen.getByTestId("ultimates-origin-loading")).toBeInTheDocument();
  });

  it("erro tem precedência sobre carregando", () => {
    render(<OriginBreakdownTable blocks={null} loading error />);

    expect(screen.getByTestId("ultimates-origin-error")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-origin-loading")).not.toBeInTheDocument();
  });

  it("renderiza um bloco por dimensão", () => {
    render(
      <OriginBreakdownTable
        blocks={[...BLOCKS, { key: "categoria", title: "Por categoria", rows: [] }]}
        loading={false}
        error={false}
      />
    );

    expect(screen.getByTestId("ultimates-origin-block-modalidade")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-origin-block-categoria")).toBeInTheDocument();
    expect(screen.getByText("Nenhum inscrito na base")).toBeInTheDocument();
  });
});
