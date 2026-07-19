/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CycleFormModal } from "../cycle-form-modal";
import type { HotmartProductOption } from "../types";

const PRODUCTS: HotmartProductOption[] = [
  { product_id: "4567890", product_name: "Mentoria Ultimates" },
  { product_id: "1234567", product_name: "Curso Avançado" },
];

function renderCreate(products: HotmartProductOption[] = PRODUCTS) {
  return render(<CycleFormModal products={products} onSave={jest.fn()} onCancel={jest.fn()} />);
}

afterEach(() => jest.restoreAllMocks());

describe("CycleFormModal — busca de produto", () => {
  it("sem busca, lista todos os produtos com nome e ID", () => {
    renderCreate();
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toHaveTextContent("Mentoria Ultimates");
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toHaveTextContent("4567890");
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toBeInTheDocument();
  });

  it("filtra por nome (case-insensitive)", () => {
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "mentoria" } });
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-option-1234567")).not.toBeInTheDocument();
  });

  it("filtra por ID", () => {
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "1234" } });
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-option-4567890")).not.toBeInTheDocument();
  });

  it("clique numa linha seleciona o produto (aria-pressed)", () => {
    renderCreate();
    const option = screen.getByTestId("cycle-form-product-option-4567890");
    expect(option).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toHaveAttribute("aria-pressed", "false");
  });

  it("sem seleção, salvar mostra 'Selecione um produto.' e não faz POST", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(screen.getByText("Selecione um produto.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mostra o produto selecionado mesmo quando a busca o filtra da lista", () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "curso" } });
    expect(screen.queryByTestId("cycle-form-product-option-4567890")).not.toBeInTheDocument();
    const selected = screen.getByTestId("cycle-form-product-selected");
    expect(selected).toHaveTextContent("Mentoria Ultimates");
    expect(selected).toHaveTextContent("4567890");
  });
});

describe("CycleFormModal — estados vazios", () => {
  it("sem produtos cadastrados, mostra 'Nenhum produto disponível'", () => {
    renderCreate([]);
    expect(screen.getByText("Nenhum produto disponível")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-search")).not.toBeInTheDocument();
  });

  it("busca sem resultado mostra 'Nenhum produto encontrado.'", () => {
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "zzz" } });
    expect(screen.getByText("Nenhum produto encontrado.")).toBeInTheDocument();
  });
});
