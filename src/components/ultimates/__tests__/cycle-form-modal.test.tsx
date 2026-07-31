/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CycleFormModal } from "../cycle-form-modal";
import type { HotmartProductOption } from "../types";

const PRODUCTS: HotmartProductOption[] = [
  { product_id: "4567890", product_name: "Mentoria Ultimates", account_id: "acc-1" },
  { product_id: "1234567", product_name: "Curso Avançado", account_id: "acc-1" },
  { product_id: "9999999", product_name: "Produto Outra Conta", account_id: "acc-2" },
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

  it("sem seleção, salvar mostra 'Selecione ao menos um produto.' e não faz POST", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(screen.getByText("Selecione ao menos um produto.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha de rede no salvar mostra erro em vez de falhar em silêncio", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    global.fetch = fetchMock as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(await screen.findByText("Falha de rede ao salvar o ciclo.")).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-save")).not.toBeDisabled();
  });

  it("resposta 2xx sem cycle no corpo mostra erro genérico em vez de quebrar", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("empty body")),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(await screen.findByText("Erro ao salvar ciclo.")).toBeInTheDocument();
  });

  it("mostra o produto selecionado mesmo quando a busca o filtra da lista", () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "curso" } });
    expect(screen.queryByTestId("cycle-form-product-option-4567890")).not.toBeInTheDocument();
    const selected = screen.getByTestId("cycle-form-product-selected");
    expect(selected).toHaveTextContent("Mentoria Ultimates");
    // O resumo de seleção múltipla mostra a contagem, não mais o ID —
    // formato do card mudou de "Selecionado: <nome> (id)" para
    // "Selecionados: <nomes> (N)".
    expect(selected).toHaveTextContent("(1)");
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

describe("CycleFormModal — seleção múltipla", () => {
  it("clicar em dois produtos mantém os dois selecionados", () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toHaveAttribute("aria-pressed", "true");
  });

  it("clicar de novo no mesmo produto o desmarca", () => {
    renderCreate();
    const option = screen.getByTestId("cycle-form-product-option-4567890");
    fireEvent.click(option);
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-pressed", "false");
  });

  it("após a 1ª seleção, produto de outra conta fica desabilitado", () => {
    renderCreate();
    expect(screen.getByTestId("cycle-form-product-option-9999999")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(screen.getByTestId("cycle-form-product-option-9999999")).toBeDisabled();
    expect(screen.getByTestId("cycle-form-product-option-1234567")).not.toBeDisabled();
  });

  it("esvaziar a seleção destrava as demais contas", () => {
    renderCreate();
    const first = screen.getByTestId("cycle-form-product-option-4567890");
    fireEvent.click(first);
    fireEvent.click(first);
    expect(screen.getByTestId("cycle-form-product-option-9999999")).not.toBeDisabled();
  });

  it("envia productIds com todos os selecionados e monta products no onSave", async () => {
    const onSave = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cycle: { id: "c9", name: "Ciclo Julho" } }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<CycleFormModal products={PRODUCTS} onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await screen.findByText("Salvar");

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.productIds).toEqual(["4567890", "1234567"]);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "c9",
        products: [
          { product_id: "4567890", product_name: "Mentoria Ultimates" },
          { product_id: "1234567", product_name: "Curso Avançado" },
        ],
      })
    );
  });
});
