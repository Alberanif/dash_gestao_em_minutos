/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LinkBuyerModal } from "../link-buyer-modal";
import type { UltimatesRosterRow } from "@/types/vendas";

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

const NEW_BUYER = row({
  buyer_id: null,
  name: "Compra Nova",
  email: "novo@example.com",
  category: "novo_comprador",
  transaction_code: "HP-TX-1",
});

const BASE_ROWS: UltimatesRosterRow[] = [
  row({ buyer_id: "b-maria", name: "Maria Silva", email: "maria@example.com", category: "nao_renovado" }),
  row({ buyer_id: "b-joao", name: "João Souza", email: "joao@example.com", category: "nao_renovado" }),
];

afterEach(() => jest.restoreAllMocks());

describe("LinkBuyerModal — busca de comprador da base", () => {
  it("filtra candidatos por nome/email", () => {
    render(
      <LinkBuyerModal
        cycleId="c1"
        newBuyerRow={NEW_BUYER}
        baseRows={BASE_ROWS}
        onLinked={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    fireEvent.change(screen.getByTestId("ultimates-link-search"), { target: { value: "maria" } });
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.queryByText("João Souza")).not.toBeInTheDocument();
  });
});

describe("LinkBuyerModal — confirmação e POST", () => {
  it("seleciona candidato, confirma e faz POST com o body correto, chamando onLinked", async () => {
    const onLinked = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ link: { id: "l1" } }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(
      <LinkBuyerModal
        cycleId="c1"
        newBuyerRow={NEW_BUYER}
        baseRows={BASE_ROWS}
        onLinked={onLinked}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("ultimates-link-select-b-maria"));
    // Confirmação nomeia as duas pontas.
    expect(screen.getByTestId("ultimates-link-confirm-text")).toHaveTextContent("novo@example.com");
    expect(screen.getByTestId("ultimates-link-confirm-text")).toHaveTextContent("Maria Silva");

    fireEvent.click(screen.getByTestId("ultimates-link-confirm-btn"));

    await waitFor(() => expect(onLinked).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/vendas/links");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      cycleId: "c1",
      buyerId: "b-maria",
      transactionCode: "HP-TX-1",
    });
  });

  it("exibe erro da API (ex: 409 já vinculada) sem chamar onLinked", async () => {
    const onLinked = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Transaction already linked" }),
    }) as unknown as typeof global.fetch;

    render(
      <LinkBuyerModal
        cycleId="c1"
        newBuyerRow={NEW_BUYER}
        baseRows={BASE_ROWS}
        onLinked={onLinked}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("ultimates-link-select-b-maria"));
    fireEvent.click(screen.getByTestId("ultimates-link-confirm-btn"));

    await screen.findByTestId("ultimates-link-error");
    expect(screen.getByTestId("ultimates-link-error")).toHaveTextContent("already linked");
    expect(onLinked).not.toHaveBeenCalled();
  });
});
