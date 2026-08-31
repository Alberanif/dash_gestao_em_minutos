/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UploadBuyersModal } from "../upload-buyers-modal";

function typePaste(text: string) {
  fireEvent.change(screen.getByTestId("ultimates-upload-textarea"), {
    target: { value: text },
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("UploadBuyersModal — validação client-side antes do envio", () => {
  it("mostra erro de cabeçalho e desabilita a prévia quando falta coluna de email", () => {
    render(<UploadBuyersModal cycleId="c1" onCommitted={jest.fn()} onCancel={jest.fn()} />);
    typePaste("nome,telefone\nAna,119");
    expect(screen.getByTestId("ultimates-upload-header-error")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-upload-preview-btn")).toBeDisabled();
  });

  it("lista linhas inválidas e avisa sobre duplicados dedupados", () => {
    render(<UploadBuyersModal cycleId="c1" onCommitted={jest.fn()} onCancel={jest.fn()} />);
    typePaste("email,nome\n,SemEmail\ndup@ex.com,A\ndup@ex.com,B");
    expect(screen.getByTestId("ultimates-upload-invalid")).toHaveTextContent("SemEmail");
    expect(screen.getByTestId("ultimates-upload-duplicates")).toHaveTextContent("dup@ex.com");
    // 1 linha válida sobra (dedupe) ⇒ prévia habilitada.
    expect(screen.getByTestId("ultimates-upload-preview-btn")).not.toBeDisabled();
  });
});

describe("UploadBuyersModal — fluxo prévia → commit", () => {
  it("envia mode:preview com as linhas dedupadas e mostra a prévia de impacto", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        currentCount: 2,
        newCount: 3,
        leaving: ["saiu@ex.com"],
        entering: ["novo1@ex.com", "novo2@ex.com"],
        invalidRows: [],
        duplicates: [],
      }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<UploadBuyersModal cycleId="c1" onCommitted={jest.fn()} onCancel={jest.fn()} />);
    typePaste("email,nome\nnovo1@ex.com,A\nnovo2@ex.com,B\ndup@ex.com,X\ndup@ex.com,Y");
    fireEvent.click(screen.getByTestId("ultimates-upload-preview-btn"));

    await screen.findByTestId("ultimates-upload-impact");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/vendas/cycles/c1/buyers");
    const body = JSON.parse(init.body);
    expect(body.mode).toBe("preview");
    // 3 emails únicos enviados (dup dedupado).
    expect(body.rows).toHaveLength(3);

    expect(screen.getByTestId("ultimates-upload-impact")).toHaveTextContent("2");
    expect(screen.getByTestId("ultimates-upload-impact")).toHaveTextContent("3");
  });

  it("confirma com mode:commit e chama onCommitted", async () => {
    const onCommitted = jest.fn();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ currentCount: 0, newCount: 1, leaving: [], entering: ["a@ex.com"], invalidRows: [], duplicates: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ removed: 0, updated: 0, inserted: 1, invalidRows: [], duplicates: [] }),
      });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<UploadBuyersModal cycleId="c1" onCommitted={onCommitted} onCancel={jest.fn()} />);
    typePaste("email\na@ex.com");
    fireEvent.click(screen.getByTestId("ultimates-upload-preview-btn"));
    await screen.findByTestId("ultimates-upload-impact");
    fireEvent.click(screen.getByTestId("ultimates-upload-confirm-btn"));

    await waitFor(() => expect(onCommitted).toHaveBeenCalledTimes(1));
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.mode).toBe("commit");
  });

  it("exibe erro do servidor (ex: 409 ciclo encerrado) sem chamar onCommitted", async () => {
    const onCommitted = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Ciclo encerrado" }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<UploadBuyersModal cycleId="c1" onCommitted={onCommitted} onCancel={jest.fn()} />);
    typePaste("email\na@ex.com");
    fireEvent.click(screen.getByTestId("ultimates-upload-preview-btn"));

    await screen.findByTestId("ultimates-upload-error");
    expect(screen.getByTestId("ultimates-upload-error")).toHaveTextContent("Ciclo encerrado");
    expect(onCommitted).not.toHaveBeenCalled();
  });
});
