/** @jest-environment jsdom */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EscolhaDeProduto, filtrarProdutos } from "../vendas/escolha-de-produto";
import type { ProdutoHotmart } from "../vendas/tipos";

const P = (id: string, nome: string): ProdutoHotmart => ({ product_id: id, product_name: nome, account_id: "a" });
const PRODUTOS = [P("1001", "WA Online - Julho/2022"), P("2002", "Workshop de Metas"), P("3003", "Despertando é Ação")];

describe("filtrarProdutos", () => {
  it("acha por parte do nome, sem acento nem caixa", () => {
    expect(filtrarProdutos(PRODUTOS, "acao").map((p) => p.product_id)).toEqual(["3003"]);
    expect(filtrarProdutos(PRODUTOS, "WORKSHOP").map((p) => p.product_id)).toEqual(["2002"]);
  });
  it("acha por ID, com ou sem #", () => {
    expect(filtrarProdutos(PRODUTOS, "2002").map((p) => p.product_id)).toEqual(["2002"]);
    expect(filtrarProdutos(PRODUTOS, "#1001").map((p) => p.product_id)).toEqual(["1001"]);
  });
  it("termo vazio devolve todos e termo sem acerto devolve nenhum", () => {
    expect(filtrarProdutos(PRODUTOS, "  ")).toHaveLength(3);
    expect(filtrarProdutos(PRODUTOS, "zzz")).toHaveLength(0);
  });
});

function Host({ onEscolher }: { onEscolher: (id: string) => void }) {
  const [v, setV] = useState("");
  return (
    <EscolhaDeProduto
      produtos={PRODUTOS}
      valor={v}
      onEscolher={(id) => {
        setV(id);
        onEscolher(id);
      }}
    />
  );
}

describe("EscolhaDeProduto", () => {
  it("ao focar, lista os produtos com o ID de cada um", () => {
    render(<Host onEscolher={jest.fn()} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Produto" }));
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByText("ID 2002")).toBeInTheDocument();
  });

  it("digitar filtra por nome e por ID, e avisa quando nada bate", () => {
    render(<Host onEscolher={jest.fn()} />);
    const campo = screen.getByRole("combobox", { name: "Produto" });
    fireEvent.change(campo, { target: { value: "metas" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.change(campo, { target: { value: "3003" } });
    expect(screen.getByRole("option")).toHaveTextContent("Despertando");
    fireEvent.change(campo, { target: { value: "xyz" } });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum produto encontrado.")).toBeInTheDocument();
  });

  it("escolher por clique devolve o ID, fecha a lista e mostra o nome", () => {
    const onEscolher = jest.fn();
    render(<Host onEscolher={onEscolher} />);
    const campo = screen.getByRole("combobox", { name: "Produto" });
    fireEvent.focus(campo);
    fireEvent.mouseDown(screen.getByRole("option", { name: /Workshop/ }));
    expect(onEscolher).toHaveBeenCalledWith("2002");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(campo).toHaveValue("Workshop de Metas");
  });

  it("teclado: seta para baixo move, Enter escolhe e não envia o formulário", () => {
    const onEscolher = jest.fn();
    const aoEnviar = jest.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={aoEnviar}>
        <Host onEscolher={onEscolher} />
      </form>,
    );
    const campo = screen.getByRole("combobox", { name: "Produto" });
    fireEvent.focus(campo);
    fireEvent.keyDown(campo, { key: "ArrowDown" });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(onEscolher).toHaveBeenCalledWith("2002");
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it("sair do campo sem escolher devolve o nome do produto já escolhido", () => {
    render(<Host onEscolher={jest.fn()} />);
    const campo = screen.getByRole("combobox", { name: "Produto" });
    fireEvent.focus(campo);
    fireEvent.mouseDown(screen.getByRole("option", { name: /Workshop/ }));
    fireEvent.change(campo, { target: { value: "abc" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("Workshop de Metas");
  });

  it("com muitos produtos mostra só os primeiros e avisa", () => {
    const muitos = Array.from({ length: 80 }, (_, i) => P(String(i), `Produto ${i}`));
    render(<EscolhaDeProduto produtos={muitos} valor="" onEscolher={jest.fn()} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Produto" }));
    expect(screen.getAllByRole("option")).toHaveLength(50);
    expect(screen.getByText(/Mostrando 50 de 80/)).toBeInTheDocument();
  });
});
