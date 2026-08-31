/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RefreshControls } from "../refresh-controls";

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof global.fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("RefreshControls — botão Atualizar agora (critério 8)", () => {
  it("mostra estado de progresso enquanto a requisição está em voo e desabilita o botão", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = jest.fn(
      () => new Promise((resolve) => { resolveFetch = resolve; })
    ) as unknown as typeof global.fetch;

    const onRefreshed = jest.fn();
    render(
      <RefreshControls cycleId="c1" cycleStatus="ativo" lastRefreshAt={null} onRefreshed={onRefreshed} />
    );

    fireEvent.click(screen.getByTestId("ultimates-refresh-btn"));
    expect(await screen.findByText("Atualizando...")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-refresh-btn")).toBeDisabled();

    resolveFetch({ ok: true, status: 200, json: async () => ({ upserted: 3, lastRefreshAt: "2026-07-19T10:00:00Z" }) });
    await waitFor(() => expect(onRefreshed).toHaveBeenCalledTimes(1));
  });

  it("429 exibe mensagem amigável com o retry-after e NÃO chama onRefreshed", async () => {
    mockFetchOnce(429, { error: "Atualização muito recente.", retryAfterSeconds: 37 });
    const onRefreshed = jest.fn();
    render(
      <RefreshControls cycleId="c1" cycleStatus="ativo" lastRefreshAt={null} onRefreshed={onRefreshed} />
    );

    fireEvent.click(screen.getByTestId("ultimates-refresh-btn"));
    const feedback = await screen.findByTestId("ultimates-refresh-feedback");
    expect(feedback).toHaveTextContent("37");
    expect(onRefreshed).not.toHaveBeenCalled();
  });

  it("409 exibe 'atualização já em andamento' e NÃO chama onRefreshed", async () => {
    mockFetchOnce(409, { error: "refresh em andamento" });
    const onRefreshed = jest.fn();
    render(
      <RefreshControls cycleId="c1" cycleStatus="ativo" lastRefreshAt={null} onRefreshed={onRefreshed} />
    );

    fireEvent.click(screen.getByTestId("ultimates-refresh-btn"));
    const feedback = await screen.findByTestId("ultimates-refresh-feedback");
    expect(feedback).toHaveTextContent("refresh em andamento");
    expect(onRefreshed).not.toHaveBeenCalled();
  });

  it("sucesso chama onRefreshed e atualiza o rótulo 'Vendas atualizadas'", async () => {
    mockFetchOnce(200, { upserted: 5, lastRefreshAt: "2026-07-19T10:00:00Z" });
    const onRefreshed = jest.fn();
    render(
      <RefreshControls cycleId="c1" cycleStatus="ativo" lastRefreshAt={null} onRefreshed={onRefreshed} />
    );

    fireEvent.click(screen.getByTestId("ultimates-refresh-btn"));
    await waitFor(() => expect(onRefreshed).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("ultimates-refresh-label")).toBeInTheDocument();
  });

  it("oculta o rótulo 'Vendas atualizadas' quando não há last_refresh_at disponível", () => {
    render(<RefreshControls cycleId="c1" cycleStatus="ativo" lastRefreshAt={null} onRefreshed={jest.fn()} />);
    expect(screen.queryByTestId("ultimates-refresh-label")).not.toBeInTheDocument();
  });

  it("desabilita o botão quando o ciclo está encerrado", () => {
    render(
      <RefreshControls cycleId="c1" cycleStatus="encerrado" lastRefreshAt={null} onRefreshed={jest.fn()} />
    );
    expect(screen.getByTestId("ultimates-refresh-btn")).toBeDisabled();
  });
});
