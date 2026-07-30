/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UnlinkBuyerModal } from "../unlink-buyer-modal";
import type { UltimatesRosterRow } from "@/types/ultimates";

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: "b-maria",
    name: "Maria Silva",
    email: "maria@example.com",
    phone: null,
    extra: {},
    category: "renovado",
    renewed_at: "2026-07-10T00:00:00Z",
    total_value: 199.9,
    transaction_code: "HP-TX-1",
    ...overrides,
  };
}

afterEach(() => jest.restoreAllMocks());

describe("UnlinkBuyerModal — desfazer vínculo", () => {
  it("faz DELETE com cycleId + transactionCode e chama onUnlinked no sucesso (204)", async () => {
    const onUnlinked = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(
      <UnlinkBuyerModal
        cycleId="c1"
        targetRow={row({})}
        countsNewBuyers
        onUnlinked={onUnlinked}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("ultimates-unlink-confirm-btn"));

    await waitFor(() => expect(onUnlinked).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ultimates/links");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ cycleId: "c1", transactionCode: "HP-TX-1" });
  });

  it("trata 404 com mensagem amigável (renovação não veio de vínculo manual)", async () => {
    const onUnlinked = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Link not found" }),
    }) as unknown as typeof global.fetch;

    render(
      <UnlinkBuyerModal
        cycleId="c1"
        targetRow={row({})}
        countsNewBuyers
        onUnlinked={onUnlinked}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("ultimates-unlink-confirm-btn"));

    await screen.findByTestId("ultimates-unlink-error");
    expect(screen.getByTestId("ultimates-unlink-error")).toHaveTextContent(/vínculo manual/i);
    expect(onUnlinked).not.toHaveBeenCalled();
  });
});

describe("UnlinkBuyerModal — destino conforme o modo do ciclo", () => {
  it("diz Novos Compradores quando o ciclo admite novas compras", () => {
    render(
      <UnlinkBuyerModal
        cycleId="c1"
        targetRow={row({})}
        countsNewBuyers
        onUnlinked={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Novos Compradores");
  });

  it("diz Renovação sem vínculo quando o ciclo não admite", () => {
    render(
      <UnlinkBuyerModal
        cycleId="c1"
        targetRow={row({})}
        countsNewBuyers={false}
        onUnlinked={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Renovação sem vínculo");
    expect(dialog).not.toHaveTextContent("Novos Compradores");
  });
});
