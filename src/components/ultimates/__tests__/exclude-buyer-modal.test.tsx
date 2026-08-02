/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ExcludeBuyerModal } from "../exclude-buyer-modal";
import type { UltimatesRosterRow } from "@/types/ultimates";

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: "b1",
    name: "Fulano",
    email: "fulano@example.com",
    phone: null,
    extra: {},
    category: "nao_renovado",
    renewed_at: null,
    total_value: null,
    transaction_code: null,
    ...overrides,
  };
}

const SEM_COMPRA = row({ name: "Teste Interno", email: "teste@empresa.com" });
const COM_COMPRA = row({
  name: "Renovou",
  email: "renovou@empresa.com",
  category: "renovado",
  renewed_at: "2026-07-15T10:00:00Z",
  total_value: 497,
  transaction_code: "HP-TX-1",
});

afterEach(() => jest.restoreAllMocks());

describe("ExcludeBuyerModal — contexto antes de confirmar", () => {
  it("mostra nome e email do lead", () => {
    render(
      <ExcludeBuyerModal cycleId="c1" targetRow={SEM_COMPRA} onExcluded={jest.fn()} onCancel={jest.fn()} />
    );

    expect(screen.getByText(/Teste Interno/)).toBeInTheDocument();
    expect(screen.getByText(/teste@empresa\.com/)).toBeInTheDocument();
  });

  it("avisa que a compra sai junto quando o lead renovou", () => {
    render(
      <ExcludeBuyerModal cycleId="c1" targetRow={COM_COMPRA} onExcluded={jest.fn()} onCancel={jest.fn()} />
    );

    const aviso = screen.getByTestId("ultimates-exclude-sale-warning");
    expect(aviso).toHaveTextContent("R$");
    expect(aviso).toHaveTextContent("497");
  });

  it("não mostra o aviso de compra quando o lead não renovou", () => {
    render(
      <ExcludeBuyerModal cycleId="c1" targetRow={SEM_COMPRA} onExcluded={jest.fn()} onCancel={jest.fn()} />
    );

    expect(screen.queryByTestId("ultimates-exclude-sale-warning")).not.toBeInTheDocument();
  });
});

describe("ExcludeBuyerModal — POST", () => {
  it("envia email e nota para a rota do ciclo e chama onExcluded", async () => {
    const onExcluded = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ buyer: { id: "eb-1" } }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(
      <ExcludeBuyerModal cycleId="c1" targetRow={SEM_COMPRA} onExcluded={onExcluded} onCancel={jest.fn()} />
    );

    fireEvent.change(screen.getByTestId("ultimates-exclude-note"), {
      target: { value: "email interno" },
    });
    fireEvent.click(screen.getByTestId("ultimates-exclude-confirm-btn"));

    await waitFor(() => expect(onExcluded).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ultimates/cycles/c1/excluded-buyers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "teste@empresa.com", note: "email interno" }),
      })
    );
  });

  it("mostra a mensagem de erro da rota e não chama onExcluded", async () => {
    const onExcluded = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Lead já excluído neste ciclo" }),
    }) as unknown as typeof global.fetch;

    render(
      <ExcludeBuyerModal cycleId="c1" targetRow={SEM_COMPRA} onExcluded={onExcluded} onCancel={jest.fn()} />
    );
    fireEvent.click(screen.getByTestId("ultimates-exclude-confirm-btn"));

    expect(await screen.findByTestId("ultimates-exclude-error")).toHaveTextContent(
      "Lead já excluído neste ciclo"
    );
    expect(onExcluded).not.toHaveBeenCalled();
  });

  it("cancela com Escape", () => {
    const onCancel = jest.fn();
    render(
      <ExcludeBuyerModal cycleId="c1" targetRow={SEM_COMPRA} onExcluded={jest.fn()} onCancel={onCancel} />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});

// No modo Apenas Compras (migration 064) a lista é por VENDA: um comprador
// ocupa uma linha por compra. A exclusão continua gravada por EMAIL, então
// excluir a partir de uma linha remove todas as outras junto — e isso precisa
// estar dito antes da confirmação, não descoberto depois.
describe("ExcludeBuyerModal — aviso de múltiplas compras", () => {
  it("com uma compra só, mantém o aviso no singular", () => {
    render(
      <ExcludeBuyerModal
        cycleId="c1"
        targetRow={COM_COMPRA}
        purchaseCount={1}
        onExcluded={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const aviso = screen.getByTestId("ultimates-exclude-sale-warning");
    expect(aviso.textContent).not.toMatch(/2 compras/);
    expect(aviso).toHaveTextContent("497");
  });

  it("com mais de uma compra, avisa que TODAS saem", () => {
    render(
      <ExcludeBuyerModal
        cycleId="c1"
        targetRow={COM_COMPRA}
        purchaseCount={2}
        onExcluded={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const aviso = screen.getByTestId("ultimates-exclude-sale-warning");
    expect(aviso.textContent).toMatch(/2 compras/);
    expect(aviso).toHaveTextContent("todas elas");
  });

  it("sem a prop, não quebra e trata como uma compra", () => {
    render(
      <ExcludeBuyerModal
        cycleId="c1"
        targetRow={COM_COMPRA}
        onExcluded={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const aviso = screen.getByTestId("ultimates-exclude-sale-warning");
    expect(aviso).toBeTruthy();
    expect(aviso.textContent).not.toMatch(/compras/);
  });
});
