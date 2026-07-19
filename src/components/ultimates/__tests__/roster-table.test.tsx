/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RosterTable } from "../roster-table";
import type { UltimatesRosterRow } from "@/types/ultimates";

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: "b1",
    name: "Fulano",
    email: "fulano@example.com",
    phone: null,
    extra: {},
    category: "renovado",
    renewed_at: null,
    total_value: null,
    transaction_code: null,
    ...overrides,
  };
}

const ROWS: UltimatesRosterRow[] = [
  row({ buyer_id: "b1", name: "Maria Silva", email: "maria@example.com", category: "renovado" }),
  row({ buyer_id: "b2", name: "João Souza", email: "joao@example.com", category: "nao_renovado" }),
  row({ buyer_id: null, name: "Ana Nova", email: "ana@example.com", category: "novo_comprador" }),
];

describe("RosterTable — busca e filtro (client-side, mesma fonte dos KPIs)", () => {
  it("mostra todas as linhas inicialmente", () => {
    render(<RosterTable rows={ROWS} role="gestor" />);
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("João Souza")).toBeInTheDocument();
    expect(screen.getByText("Ana Nova")).toBeInTheDocument();
  });

  it("filtra por busca de nome/email digitada", () => {
    render(<RosterTable rows={ROWS} role="gestor" />);
    fireEvent.change(screen.getByTestId("ultimates-table-search"), { target: { value: "maria" } });
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.queryByText("João Souza")).not.toBeInTheDocument();
  });

  it("filtra por categoria selecionada no dropdown", () => {
    render(<RosterTable rows={ROWS} role="gestor" />);
    fireEvent.change(screen.getByTestId("ultimates-table-category"), { target: { value: "nao_renovado" } });
    expect(screen.getByText("João Souza")).toBeInTheDocument();
    expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();
  });

  it("mostra rótulo de categoria em pt-BR na linha", () => {
    render(<RosterTable rows={ROWS} role="gestor" />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Não renovado")).toBeInTheDocument();
  });
});

describe("RosterTable — slot 'Vincular à base' (task #124)", () => {
  it("gestor vê o botão só nas linhas de novo comprador (buyer_id null), desabilitado sem onLinkClick", () => {
    render(<RosterTable rows={ROWS} role="gestor" />);
    const btn = screen.getByTestId("ultimates-link-buyer-ana@example.com");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Indisponível");
    expect(screen.queryByTestId("ultimates-link-buyer-maria@example.com")).not.toBeInTheDocument();
  });

  it("aciona onLinkClick quando fornecido pelo pai (contrato que a #124 conecta)", () => {
    const onLinkClick = jest.fn();
    render(<RosterTable rows={ROWS} role="gestor" onLinkClick={onLinkClick} />);
    const btn = screen.getByTestId("ultimates-link-buyer-ana@example.com");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onLinkClick).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@example.com" }));
  });

  it("analista não vê nenhum botão de vínculo (ação é só gestor)", () => {
    render(<RosterTable rows={ROWS} role="analista" />);
    expect(screen.queryByTestId("ultimates-link-buyer-ana@example.com")).not.toBeInTheDocument();
  });
});

describe("RosterTable — exportação CSV usa a visão filtrada atual", () => {
  it("clicar em Exportar CSV dispara o download só com as linhas filtradas", () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => "blob:mock");
    URL.revokeObjectURL = jest.fn();
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<RosterTable rows={ROWS} role="gestor" />);
    fireEvent.change(screen.getByTestId("ultimates-table-category"), { target: { value: "nao_renovado" } });
    fireEvent.click(screen.getByText("Exportar CSV"));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    expect(blobArg.type).toContain("text/csv");
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevoke;
  });
});
