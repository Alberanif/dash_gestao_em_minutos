/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EditBuyerModal } from "../edit-buyer-modal";
import type { UltimatesRosterRow } from "@/types/vendas";

const TARGET: UltimatesRosterRow = {
  buyer_id: "b-1",
  name: "Fulano da Silva",
  email: "fulano@empresa.com",
  phone: "11999998888",
  extra: {},
  category: "nao_renovado",
  renewed_at: null,
  total_value: null,
  transaction_code: null,
};

afterEach(() => jest.restoreAllMocks());

describe("EditBuyerModal", () => {
  it("pré-preenche nome e telefone do cadastro atual", () => {
    render(<EditBuyerModal cycleId="c1" targetRow={TARGET} onSaved={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByTestId("ultimates-edit-name")).toHaveValue("Fulano da Silva");
    expect(screen.getByTestId("ultimates-edit-phone")).toHaveValue("11999998888");
  });

  it("exibe o email sem permitir edição", () => {
    render(<EditBuyerModal cycleId="c1" targetRow={TARGET} onSaved={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText("fulano@empresa.com")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-edit-email")).not.toBeInTheDocument();
  });

  it("avisa que a correção vale até o próximo upload da base", () => {
    render(<EditBuyerModal cycleId="c1" targetRow={TARGET} onSaved={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByTestId("ultimates-edit-upload-warning")).toHaveTextContent(
      /próximo upload/i
    );
  });

  it("faz PATCH na rota do buyer e chama onSaved", async () => {
    const onSaved = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ buyer: { id: "b-1" } }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<EditBuyerModal cycleId="c1" targetRow={TARGET} onSaved={onSaved} onCancel={jest.fn()} />);

    fireEvent.change(screen.getByTestId("ultimates-edit-name"), {
      target: { value: "Fulano Corrigido" },
    });
    fireEvent.click(screen.getByTestId("ultimates-edit-confirm-btn"));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vendas/cycles/c1/buyers/b-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Fulano Corrigido", phone: "11999998888" }),
      })
    );
  });

  it("mostra a mensagem de erro da rota e não chama onSaved", async () => {
    const onSaved = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Ciclo encerrado" }),
    }) as unknown as typeof global.fetch;

    render(<EditBuyerModal cycleId="c1" targetRow={TARGET} onSaved={onSaved} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByTestId("ultimates-edit-confirm-btn"));

    expect(await screen.findByTestId("ultimates-edit-error")).toHaveTextContent("Ciclo encerrado");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("cancela com Escape", () => {
    const onCancel = jest.fn();
    render(<EditBuyerModal cycleId="c1" targetRow={TARGET} onSaved={jest.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
