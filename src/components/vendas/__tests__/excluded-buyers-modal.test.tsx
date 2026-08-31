/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ExcludedBuyersModal } from "../excluded-buyers-modal";

const LISTA = [
  {
    id: "eb-1",
    email: "teste@empresa.com",
    name: "Teste Interno",
    note: "email de teste",
    excluded_by: "user-9",
    excluded_by_email: "gestor@empresa.com",
    created_at: "2026-07-30T12:00:00Z",
  },
];

function mockList(buyers: unknown[]) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ buyers }),
  });
  global.fetch = fetchMock as unknown as typeof global.fetch;
  return fetchMock;
}

afterEach(() => jest.restoreAllMocks());

describe("ExcludedBuyersModal — listagem", () => {
  it("carrega a lista do ciclo e mostra email, nome, motivo e autor", async () => {
    mockList(LISTA);

    render(
      <ExcludedBuyersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    const item = await screen.findByTestId("ultimates-excluded-buyer-teste@empresa.com");
    expect(item).toHaveTextContent("Teste Interno");
    expect(item).toHaveTextContent("teste@empresa.com");
    expect(item).toHaveTextContent("email de teste");
    expect(item).toHaveTextContent("gestor@empresa.com");
  });

  it("mostra estado vazio quando ninguém está excluído", async () => {
    mockList([]);

    render(
      <ExcludedBuyersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    expect(await screen.findByTestId("ultimates-excluded-buyers-empty")).toBeInTheDocument();
  });

  it("mostra erro de carga sem quebrar o modal", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof global.fetch;

    render(
      <ExcludedBuyersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    expect(await screen.findByTestId("ultimates-excluded-buyers-load-error")).toBeInTheDocument();
  });

  it("cai de volta no email quando o lead não está mais na base", async () => {
    mockList([{ ...LISTA[0], name: null }]);

    render(
      <ExcludedBuyersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    const item = await screen.findByTestId("ultimates-excluded-buyer-teste@empresa.com");
    expect(item).toHaveTextContent("teste@empresa.com");
  });
});

describe("ExcludedBuyersModal — restaurar", () => {
  it("gestor restaura o lead com DELETE e o pai é avisado", async () => {
    const onChanged = jest.fn();
    const fetchMock = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ buyers: LISTA }) });
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(
      <ExcludedBuyersModal cycleId="c1" canWrite onChanged={onChanged} onClose={jest.fn()} />
    );

    fireEvent.click(await screen.findByTestId("ultimates-restore-buyer-teste@empresa.com"));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vendas/cycles/c1/excluded-buyers",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ email: "teste@empresa.com" }),
      })
    );
  });

  it("analista não vê o botão de restaurar", async () => {
    mockList(LISTA);

    render(
      <ExcludedBuyersModal
        cycleId="c1"
        canWrite={false}
        onChanged={jest.fn()}
        onClose={jest.fn()}
      />
    );

    await screen.findByTestId("ultimates-excluded-buyer-teste@empresa.com");
    expect(screen.queryByTestId("ultimates-restore-buyer-teste@empresa.com")).not.toBeInTheDocument();
  });

  it("fecha com Escape", async () => {
    mockList([]);
    const onClose = jest.fn();

    render(
      <ExcludedBuyersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={onClose} />
    );

    await screen.findByTestId("ultimates-excluded-buyers-empty");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
