/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MarkRenewedModal } from "../mark-renewed-modal";
import type { UltimatesRosterRow } from "@/types/ultimates";

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: null,
    name: null,
    email: "compra@example.com",
    phone: null,
    extra: {},
    category: "novo_comprador",
    renewed_at: "2026-07-15T10:00:00Z",
    total_value: 497,
    transaction_code: "HP-TX-1",
    ...overrides,
  };
}

const TARGET: UltimatesRosterRow = {
  buyer_id: "b-joao",
  name: "João Souza",
  email: "joao@empresa.com",
  phone: null,
  extra: {},
  category: "nao_renovado",
  renewed_at: null,
  total_value: null,
  transaction_code: null,
};

const CANDIDATAS: UltimatesRosterRow[] = [
  row({ email: "joao.pessoal@gmail.com", transaction_code: "HP-TX-1" }),
  row({ email: "outra@example.com", transaction_code: "HP-TX-2", total_value: 297 }),
];

afterEach(() => jest.restoreAllMocks());

describe("MarkRenewedModal — escolha da compra", () => {
  it("lista as compras não atribuídas com email e valor", () => {
    render(
      <MarkRenewedModal
        cycleId="c1"
        targetRow={TARGET}
        unattributedRows={CANDIDATAS}
        countsNewBuyers
        onLinked={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("ultimates-mark-renewed-select-HP-TX-1")).toHaveTextContent(
      "joao.pessoal@gmail.com"
    );
    expect(screen.getByTestId("ultimates-mark-renewed-select-HP-TX-2")).toHaveTextContent("297");
  });

  it("filtra as candidatas por email", () => {
    render(
      <MarkRenewedModal
        cycleId="c1"
        targetRow={TARGET}
        unattributedRows={CANDIDATAS}
        countsNewBuyers
        onLinked={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    fireEvent.change(screen.getByTestId("ultimates-mark-renewed-search"), {
      target: { value: "joao.pessoal" },
    });

    expect(screen.getByTestId("ultimates-mark-renewed-select-HP-TX-1")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-mark-renewed-select-HP-TX-2")).not.toBeInTheDocument();
  });

  it("ignora candidata sem transação — não há o que vincular", () => {
    render(
      <MarkRenewedModal
        cycleId="c1"
        targetRow={TARGET}
        unattributedRows={[row({ email: "sem-tx@example.com", transaction_code: null })]}
        countsNewBuyers
        onLinked={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("ultimates-mark-renewed-empty")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há compras não atribuídas", () => {
    render(
      <MarkRenewedModal
        cycleId="c1"
        targetRow={TARGET}
        unattributedRows={[]}
        countsNewBuyers
        onLinked={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("ultimates-mark-renewed-empty")).toBeInTheDocument();
  });
});

describe("MarkRenewedModal — confirmação e POST", () => {
  it("seleciona a compra, confirma e faz POST em /api/ultimates/links", async () => {
    const onLinked = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ link: { id: "l1" } }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(
      <MarkRenewedModal
        cycleId="c1"
        targetRow={TARGET}
        unattributedRows={CANDIDATAS}
        countsNewBuyers
        onLinked={onLinked}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("ultimates-mark-renewed-select-HP-TX-1"));
    expect(screen.getByTestId("ultimates-mark-renewed-confirm-text")).toHaveTextContent(
      "João Souza"
    );

    fireEvent.click(screen.getByTestId("ultimates-mark-renewed-confirm-btn"));

    await waitFor(() => expect(onLinked).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ultimates/links",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          cycleId: "c1",
          buyerId: "b-joao",
          transactionCode: "HP-TX-1",
        }),
      })
    );
  });

  it("mostra a mensagem de erro da rota e não chama onLinked", async () => {
    const onLinked = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Ciclo encerrado" }),
    }) as unknown as typeof global.fetch;

    render(
      <MarkRenewedModal
        cycleId="c1"
        targetRow={TARGET}
        unattributedRows={CANDIDATAS}
        countsNewBuyers
        onLinked={onLinked}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("ultimates-mark-renewed-select-HP-TX-1"));
    fireEvent.click(screen.getByTestId("ultimates-mark-renewed-confirm-btn"));

    expect(await screen.findByTestId("ultimates-mark-renewed-error")).toHaveTextContent(
      "Ciclo encerrado"
    );
    expect(onLinked).not.toHaveBeenCalled();
  });

  it("usa a nomenclatura do ciclo sem novas compras", () => {
    render(
      <MarkRenewedModal
        cycleId="c1"
        targetRow={TARGET}
        unattributedRows={CANDIDATAS}
        countsNewBuyers={false}
        onLinked={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId("ultimates-mark-renewed-intro")).toHaveTextContent(
      /sem vínculo/i
    );
  });

  it("cancela com Escape", () => {
    const onCancel = jest.fn();
    render(
      <MarkRenewedModal
        cycleId="c1"
        targetRow={TARGET}
        unattributedRows={CANDIDATAS}
        countsNewBuyers
        onLinked={jest.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
