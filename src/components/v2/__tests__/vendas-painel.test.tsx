/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PainelVisualizacoes } from "../vendas/painel-visualizacoes";
import type { ViewGroup } from "@/lib/vendas/views";
import type { VendasFolderRecord } from "@/types/vendas";
import { makeView, polyfillsDoRadix } from "./vendas-helpers";

const PASTA: VendasFolderRecord = {
  id: "f1",
  account_id: "acc-1",
  name: "Pasta Teste",
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
};

function grupo(over: Partial<ViewGroup> = {}): ViewGroup {
  return {
    id: "f1",
    name: "Pasta Teste",
    isUnfolder: false,
    folder: PASTA,
    items: [makeView({ id: "c1", name: "Visualização 1" })],
    isExpanded: true,
    ...over,
  };
}

beforeEach(() => polyfillsDoRadix());

describe("PainelVisualizacoes", () => {
  it("mostra o nome da pasta e o contador, no singular e no plural", () => {
    const { rerender } = render(
      <PainelVisualizacoes grupos={[grupo()]} selecionadaId={null} onSelecionar={jest.fn()} onAlternarPasta={jest.fn()} />,
    );
    expect(screen.getByText("Pasta Teste")).toBeInTheDocument();
    expect(screen.getByText("1 visualização")).toBeInTheDocument();

    rerender(
      <PainelVisualizacoes
        grupos={[grupo({ items: [makeView({ id: "a" }), makeView({ id: "b" })] })]}
        selecionadaId={null}
        onSelecionar={jest.fn()}
        onAlternarPasta={jest.fn()}
      />,
    );
    expect(screen.getByText("2 visualizações")).toBeInTheDocument();
  });

  it("aberta, lista as visualizações e seleciona ao clicar", () => {
    const onSelecionar = jest.fn();
    render(<PainelVisualizacoes grupos={[grupo()]} selecionadaId="c1" onSelecionar={onSelecionar} onAlternarPasta={jest.fn()} />);
    const opcao = screen.getByTestId("vendas-view-option-c1");
    expect(opcao).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(opcao);
    expect(onSelecionar).toHaveBeenCalledWith("c1");
  });

  it("fechada, não lista as visualizações", () => {
    render(
      <PainelVisualizacoes grupos={[grupo({ isExpanded: false })]} selecionadaId={null} onSelecionar={jest.fn()} onAlternarPasta={jest.fn()} />,
    );
    expect(screen.queryByTestId("vendas-view-option-c1")).not.toBeInTheDocument();
  });

  it("pasta vazia aberta avisa que não tem visualização", () => {
    render(
      <PainelVisualizacoes grupos={[grupo({ items: [] })]} selecionadaId={null} onSelecionar={jest.fn()} onAlternarPasta={jest.fn()} />,
    );
    expect(screen.getByText("Nenhuma visualização nesta pasta")).toBeInTheDocument();
  });

  it("clicar no nome da pasta alterna a pasta", () => {
    const onAlternarPasta = jest.fn();
    render(<PainelVisualizacoes grupos={[grupo()]} selecionadaId={null} onSelecionar={jest.fn()} onAlternarPasta={onAlternarPasta} />);
    fireEvent.click(screen.getByText("Pasta Teste"));
    expect(onAlternarPasta).toHaveBeenCalledWith("f1");
  });

  it("só a visualização selecionada leva a marca âmbar", () => {
    render(
      <PainelVisualizacoes
        grupos={[grupo({ items: [makeView({ id: "a", name: "A" }), makeView({ id: "b", name: "B" })] })]}
        selecionadaId="a"
        onSelecionar={jest.fn()}
        onAlternarPasta={jest.fn()}
      />,
    );
    expect(screen.getByTestId("vendas-view-option-a").className).toContain("border-v2-ponto");
    expect(screen.getByTestId("vendas-view-option-b").className).not.toContain("v2-ponto");
  });

  it("no celular o painel vira um Select com as visualizações agrupadas por pasta", async () => {
    const onSelecionar = jest.fn();
    render(
      <PainelVisualizacoes
        grupos={[
          grupo({ items: [makeView({ id: "a", name: "Da pasta" })] }),
          { id: "unfoldered", name: "Sem pasta", isUnfolder: true, items: [makeView({ id: "b", name: "Solta" })], isExpanded: true },
        ]}
        selecionadaId="a"
        onSelecionar={onSelecionar}
        onAlternarPasta={jest.fn()}
      />,
    );
    const gatilho = screen.getByRole("combobox", { name: "Visualização" });
    expect(gatilho).toHaveTextContent("Da pasta");
    fireEvent.keyDown(gatilho, { key: "Enter" });
    const lista = await screen.findByRole("listbox");
    expect(within(lista).getByText("Pasta Teste")).toBeInTheDocument();
    expect(within(lista).getByText("Sem pasta")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: "Solta" }));
    expect(onSelecionar).toHaveBeenCalledWith("b");
  });

  it("o menu da pasta (renomear, deletar) só existe para quem edita", () => {
    const onRenomear = jest.fn();
    const onExcluir = jest.fn();
    const { rerender } = render(
      <PainelVisualizacoes grupos={[grupo()]} selecionadaId={null} onSelecionar={jest.fn()} onAlternarPasta={jest.fn()} />,
    );
    expect(screen.queryByTestId("folder-menu-btn-f1")).not.toBeInTheDocument();

    rerender(
      <PainelVisualizacoes
        grupos={[grupo()]}
        selecionadaId={null}
        onSelecionar={jest.fn()}
        onAlternarPasta={jest.fn()}
        canEdit
        onRenomearPasta={onRenomear}
        onExcluirPasta={onExcluir}
      />,
    );
    fireEvent.click(screen.getByTestId("folder-menu-btn-f1"));
    fireEvent.click(screen.getByTestId("folder-rename-btn-f1"));
    expect(onRenomear).toHaveBeenCalledWith(PASTA);
    fireEvent.click(screen.getByTestId("folder-menu-btn-f1"));
    fireEvent.click(screen.getByTestId("folder-delete-btn-f1"));
    expect(onExcluir).toHaveBeenCalledWith(PASTA);
  });

  it("'Sem pasta' não tem menu de pasta", () => {
    render(
      <PainelVisualizacoes
        grupos={[{ id: "unfoldered", name: "Sem pasta", isUnfolder: true, items: [makeView()], isExpanded: true }]}
        selecionadaId="v1"
        onSelecionar={jest.fn()}
        onAlternarPasta={jest.fn()}
        canEdit
      />,
    );
    expect(screen.queryByTestId("folder-menu-btn-unfoldered")).not.toBeInTheDocument();
  });
});
