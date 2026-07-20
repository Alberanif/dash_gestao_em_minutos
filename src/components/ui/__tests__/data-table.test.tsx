/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DataTable } from "../data-table";

type Row = Record<string, unknown> & { name: string; value: number };

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `Item ${String(i + 1).padStart(2, "0")}`,
    value: i + 1,
  }));
}

const COLUMNS = [
  { key: "name" as keyof Row, label: "Nome" },
  { key: "value" as keyof Row, label: "Valor" },
];

describe("DataTable — sem pageSize (comportamento atual)", () => {
  it("renderiza todas as linhas e nenhum rodapé de paginação", () => {
    render(<DataTable<Row> data={makeRows(12)} columns={COLUMNS} />);
    expect(screen.getByText("Item 01")).toBeInTheDocument();
    expect(screen.getByText("Item 12")).toBeInTheDocument();
    expect(screen.queryByTestId("data-table-page-info")).not.toBeInTheDocument();
  });
});

describe("DataTable — paginação com pageSize", () => {
  it("mostra só a primeira página e o rodapé com contagem", () => {
    render(<DataTable<Row> data={makeRows(12)} columns={COLUMNS} pageSize={10} />);
    expect(screen.getByText("Item 01")).toBeInTheDocument();
    expect(screen.getByText("Item 10")).toBeInTheDocument();
    expect(screen.queryByText("Item 11")).not.toBeInTheDocument();
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 1 de 2");
    expect(screen.getByText("12 registros")).toBeInTheDocument();
    expect(screen.getByTestId("data-table-prev")).toBeDisabled();
    expect(screen.getByTestId("data-table-next")).not.toBeDisabled();
  });

  it("navega com Próxima/Anterior e desabilita nos limites", () => {
    render(<DataTable<Row> data={makeRows(12)} columns={COLUMNS} pageSize={10} />);
    fireEvent.click(screen.getByTestId("data-table-next"));
    expect(screen.getByText("Item 11")).toBeInTheDocument();
    expect(screen.queryByText("Item 01")).not.toBeInTheDocument();
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 2 de 2");
    expect(screen.getByTestId("data-table-next")).toBeDisabled();
    fireEvent.click(screen.getByTestId("data-table-prev"));
    expect(screen.getByText("Item 01")).toBeInTheDocument();
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 1 de 2");
  });

  it("não mostra rodapé quando cabe tudo numa página", () => {
    render(<DataTable<Row> data={makeRows(10)} columns={COLUMNS} pageSize={10} />);
    expect(screen.getByText("Item 10")).toBeInTheDocument();
    expect(screen.queryByTestId("data-table-page-info")).not.toBeInTheDocument();
  });

  it("ordena o conjunto completo (não só a página) e mantém a página ao ordenar", () => {
    render(<DataTable<Row> data={makeRows(12)} columns={COLUMNS} pageSize={10} />);
    fireEvent.click(screen.getByTestId("data-table-next"));
    // Primeiro clique numa coluna ordena desc sobre TODAS as linhas; a página
    // atual (2) é mantida — nela ficam os menores valores (Item 02, Item 01).
    fireEvent.click(screen.getByText("Valor"));
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 2 de 2");
    expect(screen.getByText("Item 01")).toBeInTheDocument();
    expect(screen.getByText("Item 02")).toBeInTheDocument();
    expect(screen.queryByText("Item 12")).not.toBeInTheDocument();
  });

  it("reseta para a página 1 quando a referência de data muda", () => {
    const { rerender } = render(
      <DataTable<Row> data={makeRows(25)} columns={COLUMNS} pageSize={10} />
    );
    fireEvent.click(screen.getByTestId("data-table-next"));
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 2 de 3");
    rerender(<DataTable<Row> data={makeRows(15)} columns={COLUMNS} pageSize={10} />);
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 1 de 2");
  });

  it("pageSize={0} desativa a paginação sem renderizar '0' solto", () => {
    const { container } = render(
      <DataTable<Row> data={makeRows(3)} columns={COLUMNS} pageSize={0} />
    );
    expect(screen.getByText("Item 03")).toBeInTheDocument();
    expect(screen.queryByTestId("data-table-page-info")).not.toBeInTheDocument();
    expect(container.textContent?.endsWith("0")).toBe(false);
  });
});
