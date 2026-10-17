/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CronFreshnessIndicator } from "../cron-freshness-indicator";

const NOW = new Date("2026-10-16T12:00:00.000Z");
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function mockAccounts(accounts: unknown[]) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ accounts }) }),
  ) as unknown as typeof fetch;
}

const acc = (over: object) => ({
  account_id: "a1",
  name: "Conta A",
  platform: "hotmart",
  last_success_at: ago(10),
  last_error_at: null,
  last_error_message: null,
  ...over,
});

describe("CronFreshnessIndicator", () => {
  it("mostra 'Atualizado há X min' com a faixa verde", async () => {
    mockAccounts([acc({})]);
    render(<CronFreshnessIndicator now={() => NOW} />);
    const btn = await screen.findByTestId("cron-freshness-button");
    expect(btn.textContent).toContain("Atualizado há 10 min");
    expect(btn.getAttribute("data-level")).toBe("green");
  });

  it("conta sem log deixa o indicador vermelho", async () => {
    mockAccounts([acc({}), acc({ account_id: "a2", name: "Nova", last_success_at: null })]);
    render(<CronFreshnessIndicator now={() => NOW} />);
    const btn = await screen.findByTestId("cron-freshness-button");
    expect(btn.getAttribute("data-level")).toBe("red");
  });

  it("ao clicar lista as contas com o erro mais recente", async () => {
    mockAccounts([acc({ last_error_at: ago(30), last_error_message: "token expirado" })]);
    render(<CronFreshnessIndicator now={() => NOW} />);
    fireEvent.click(await screen.findByTestId("cron-freshness-button"));
    await waitFor(() => expect(screen.getByTestId("cron-freshness-list")).toBeTruthy());
    expect(screen.getByText("Conta A")).toBeTruthy();
    expect(screen.getByTestId("cron-freshness-error").textContent).toBe("token expirado");
  });

  it("nao renderiza nada se a API falhar", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 })) as unknown as typeof fetch;
    const { container } = render(<CronFreshnessIndicator now={() => NOW} />);
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBe(1));
    await Promise.resolve();
    expect(container.innerHTML).toBe("");
  });
});
