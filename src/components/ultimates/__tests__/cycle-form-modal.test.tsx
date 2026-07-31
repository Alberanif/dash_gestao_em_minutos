/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CycleFormModal } from "../cycle-form-modal";
import type { HotmartProductOption, CycleWithProduct } from "../types";

const PRODUCTS: HotmartProductOption[] = [
  { product_id: "4567890", product_name: "Mentoria Ultimates" },
  { product_id: "1234567", product_name: "Curso Avançado" },
];

function renderCreate(products: HotmartProductOption[] = PRODUCTS) {
  return render(<CycleFormModal products={products} onSave={jest.fn()} onCancel={jest.fn()} />);
}

function makeCycle(overrides: Partial<CycleWithProduct> = {}): CycleWithProduct {
  return {
    id: "c1",
    name: "Ciclo Julho",
    account_id: "acc-1",
    product_id: "4567890",
    product_name: "Mentoria Ultimates",
    goal_percent: 60,
    status: "ativo",
    counts_new_buyers: true,
    purchases_only: false,
    refresh_started_at: null,
    last_refresh_at: null,
    created_by: "user-1",
    created_at: "2026-07-19T00:00:00Z",
    updated_at: "2026-07-19T00:00:00Z",
    ...overrides,
  };
}

function renderEdit(editTarget: CycleWithProduct) {
  return render(
    <CycleFormModal products={PRODUCTS} editTarget={editTarget} onSave={jest.fn()} onCancel={jest.fn()} />
  );
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
    expect(selected).toHaveTextContent("4567890");
  });
});

describe("CycleFormModal — Apenas Compras", () => {
  it("modo criação mostra o interruptor 'Apenas Compras' desligado por padrão, com meta visível", () => {
    renderCreate();
    const toggle = screen.getByTestId("cycle-form-purchases-only");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("cycle-form-goal")).toBeInTheDocument();
  });

  it("ligar 'Apenas Compras' esconde o campo de meta", () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-purchases-only"));
    expect(screen.getByTestId("cycle-form-purchases-only")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("cycle-form-goal")).not.toBeInTheDocument();
  });

  it("criar com 'Apenas Compras' ligado envia purchasesOnly: true no POST", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cycle: makeCycle({ purchases_only: true }) }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Compras Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-purchases-only"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await screen.findByTestId("cycle-form-save");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.purchasesOnly).toBe(true);
  });

  it("modo edição de ciclo purchases_only mostra o modo somente-leitura, sem interruptor e sem meta", () => {
    renderEdit(makeCycle({ purchases_only: true, goal_percent: null }));
    expect(screen.getByTestId("cycle-form-purchases-only-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-purchases-only")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-goal")).not.toBeInTheDocument();
  });

  it("modo edição de ciclo normal não mostra badge de compras e mantém a meta", () => {
    renderEdit(makeCycle({ purchases_only: false }));
    expect(screen.queryByTestId("cycle-form-purchases-only-readonly")).not.toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-goal")).toBeInTheDocument();
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
