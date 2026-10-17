/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RefreshNowButton, REFRESH_POLL_MS } from "../refresh-now-button";

const NOW = new Date("2026-10-16T12:00:00.000Z");
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

type Status = {
  running: boolean;
  last_finished_at: string | null;
  has_current_error: boolean;
  errors: unknown[];
  can_refresh: boolean;
};
const IDLE: Status = { running: false, last_finished_at: ago(30), has_current_error: false, errors: [], can_refresh: true };
const RUNNING: Status = { ...IDLE, running: true, can_refresh: false };

interface Server {
  status: Status;
  post: () => Promise<Partial<Response>>;
  statusFails?: boolean;
}
let server: Server;
let calls: { url: string; method: string }[];

function res(status: number, body: unknown): Promise<Partial<Response>> {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  jest.useFakeTimers();
  calls = [];
  server = { status: IDLE, post: () => res(202, { accepted: true }) };
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url === "/api/indicadores/refresh-status") {
      return server.statusFails ? Promise.reject(new Error("net")) : res(200, server.status);
    }
    if (url === "/api/indicadores/refresh" && method === "POST") return server.post();
    return res(404, {});
  }) as unknown as typeof fetch;
});
afterEach(() => jest.useRealTimers());

const statusCalls = () => calls.filter((c) => c.url.endsWith("refresh-status")).length;
const postCalls = () => calls.filter((c) => c.method === "POST").length;
const btn = () => screen.getByTestId("refresh-now-button") as HTMLButtonElement;

async function tick(ms = REFRESH_POLL_MS) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}
async function mount(onRefreshed = jest.fn()) {
  const utils = render(<RefreshNowButton onRefreshed={onRefreshed} now={() => NOW} />);
  await tick(0);
  return { ...utils, onRefreshed };
}
async function click() {
  fireEvent.click(btn());
  await tick(0);
}

describe("RefreshNowButton", () => {
  it("ocioso: habilitado, sem polling", async () => {
    await mount();
    expect(btn().disabled).toBe(false);
    expect(btn().textContent).toBe("Atualizar Agora");
    await tick(30_000);
    expect(statusCalls()).toBe(1);
  });

  it("dentro do intervalo: desabilitado com Dados atualizados ha X min", async () => {
    server.status = { ...IDLE, last_finished_at: ago(2), can_refresh: false };
    await mount();
    expect(btn().disabled).toBe(true);
    expect(screen.getByTestId("refresh-now-hint").textContent).toBe("Dados atualizados há 2 min");
  });

  it("clique: POST, Atualizando, polling a cada 5 s e ao terminar recarrega", async () => {
    const { onRefreshed } = await mount();
    server.status = RUNNING;
    await click();
    expect(postCalls()).toBe(1);
    expect(btn().textContent).toBe("Atualizando…");
    expect(btn().disabled).toBe(true);

    await tick(REFRESH_POLL_MS - 1);
    expect(statusCalls()).toBe(1);
    await tick(1);
    expect(statusCalls()).toBe(2);
    expect(onRefreshed).not.toHaveBeenCalled();

    server.status = { ...IDLE, last_finished_at: ago(0), can_refresh: false };
    await tick();
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(btn().textContent).toBe("Atualizar Agora");
    expect(screen.getByTestId("refresh-now-hint").textContent).toBe("Dados atualizados agora há pouco");

    const before = statusCalls();
    await tick(20_000);
    expect(statusCalls()).toBe(before);
  });

  it("running ao montar: coleta em andamento, acompanha ate o fim", async () => {
    server.status = RUNNING;
    const { onRefreshed } = await mount();
    expect(btn().textContent).toBe("Já há uma coleta em andamento…");
    expect(btn().disabled).toBe(true);
    server.status = IDLE;
    await tick();
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(btn().textContent).toBe("Atualizar Agora");
  });

  it("202 skipped: acompanha a rodada em andamento", async () => {
    server.post = () => res(202, { skipped: "em andamento" });
    const { onRefreshed } = await mount();
    server.status = RUNNING;
    await click();
    expect(btn().textContent).toBe("Já há uma coleta em andamento…");
    server.status = IDLE;
    await tick();
    expect(onRefreshed).toHaveBeenCalledTimes(1);
  });

  it("erro vigente ao fim: lista o erro de cada conta", async () => {
    const { onRefreshed } = await mount();
    server.status = RUNNING;
    await click();
    server.status = {
      ...IDLE,
      has_current_error: true,
      errors: [
        { account_id: "a1", name: "Conta A", platform: "hotmart", last_error_at: ago(0), last_error_message: "token expirado" },
        { account_id: "a2", name: "Conta B", platform: "meta-ads", last_error_at: ago(0), last_error_message: "limite" },
      ],
    };
    await tick();
    const items = screen.getAllByTestId("refresh-now-error-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Conta A");
    expect(items[0].textContent).toContain("token expirado");
    expect(items[1].textContent).toContain("Meta Ads");
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(btn().disabled).toBe(false);
  });

  it.each([
    ["429", () => res(429, { error: "x", last_finished_at: ago(1) }), /há pouco/],
    ["500", () => res(500, { error: "x" }), /Não foi possível/],
    ["rede", () => Promise.reject(new Error("net")), /Falha de rede/],
  ])("falha %s: mensagem clara, botao normal, sem polling", async (_n, post, re) => {
    server.post = post as Server["post"];
    const { onRefreshed } = await mount();
    await click();
    expect(screen.getByTestId("refresh-now-message").textContent).toMatch(re);
    expect(btn().textContent).toBe("Atualizar Agora");
    expect(btn().disabled).toBe(false);
    expect(onRefreshed).not.toHaveBeenCalled();
    const before = statusCalls();
    await tick(20_000);
    expect(statusCalls() - before).toBe(0);
  });

  it("429 respeita o status do servidor e desabilita", async () => {
    server.post = () => res(429, { error: "x", last_finished_at: ago(1) });
    await mount();
    server.status = { ...IDLE, last_finished_at: ago(1), can_refresh: false };
    await click();
    expect(btn().disabled).toBe(true);
    expect(screen.getByTestId("refresh-now-hint").textContent).toBe("Dados atualizados há 1 min");
  });

  it("clique duplo antes do POST responder dispara uma so coleta", async () => {
    await mount();
    let resolve!: (v: Partial<Response>) => void;
    server.post = () => new Promise((r) => (resolve = r));
    // Dois cliques no mesmo tick, antes de o React repintar o botao desabilitado.
    act(() => {
      btn().click();
      btn().click();
    });
    expect(postCalls()).toBe(1);
    resolve({ ok: true, status: 202, json: () => Promise.resolve({ accepted: true }) });
    await tick(0);
  });

  it("falha de status durante o polling tenta de novo no proximo ciclo", async () => {
    const { onRefreshed } = await mount();
    server.status = RUNNING;
    await click();
    server.statusFails = true;
    await tick();
    expect(btn().textContent).toBe("Atualizando…");
    server.statusFails = false;
    server.status = IDLE;
    await tick();
    expect(onRefreshed).toHaveBeenCalledTimes(1);
  });

  it("desmontar cancela o polling", async () => {
    const { unmount, onRefreshed } = await mount();
    server.status = RUNNING;
    await click();
    const before = statusCalls();
    unmount();
    server.status = IDLE;
    await tick(30_000);
    expect(statusCalls()).toBe(before);
    expect(onRefreshed).not.toHaveBeenCalled();
  });
});
