/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AtualizarAgora, ATUALIZAR_POLL_MS } from "../evento/atualizar-agora";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const AGORA = new Date("2026-10-16T12:00:00.000Z");
const atras = (m: number) => new Date(AGORA.getTime() - m * 60_000).toISOString();

type Status = {
  running: boolean;
  last_finished_at: string | null;
  has_current_error: boolean;
  errors: unknown[];
  can_refresh: boolean;
};
const OCIOSO: Status = { running: false, last_finished_at: atras(30), has_current_error: false, errors: [], can_refresh: true };
const RODANDO: Status = { ...OCIOSO, running: true, can_refresh: false };

let servidor: { status: Status; post: () => Promise<Partial<Response>> };
let chamadas: { url: string; method: string }[];
let invalidar: jest.SpyInstance;

function resp(status: number, corpo: unknown): Promise<Partial<Response>> {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) });
}

beforeEach(() => {
  jest.useFakeTimers();
  refresh.mockClear();
  chamadas = [];
  servidor = { status: OCIOSO, post: () => resp(202, { accepted: true }) };
  global.fetch = jest.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const method = init?.method ?? "GET";
    chamadas.push({ url, method });
    if (url === "/api/indicadores/refresh-status") return resp(200, servidor.status);
    if (url === "/api/indicadores/refresh" && method === "POST") return servidor.post();
    return resp(404, {});
  }) as unknown as typeof fetch;
});
afterEach(() => jest.useRealTimers());

const botao = () => screen.getByTestId("atualizar-agora-botao") as HTMLButtonElement;
const posts = () => chamadas.filter((c) => c.method === "POST").length;

async function avancar(ms = ATUALIZAR_POLL_MS) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}
async function montar() {
  const client = new QueryClient();
  invalidar = jest.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <AtualizarAgora agora={() => AGORA} />
    </QueryClientProvider>,
  );
  await avancar(0);
}
async function clicar() {
  fireEvent.click(botao());
  await avancar(0);
}

describe("AtualizarAgora", () => {
  it("ocioso: habilitado e sem refresh", async () => {
    await montar();
    expect(botao().disabled).toBe(false);
    expect(botao()).toHaveTextContent("Atualizar Agora");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("clique dispara a coleta e mostra Atualizando…", async () => {
    await montar();
    await clicar();
    expect(posts()).toBe(1);
    expect(botao().disabled).toBe(true);
    expect(botao()).toHaveTextContent("Atualizando…");
  });

  it("ao fim da coleta atualiza servidor e cliente uma vez", async () => {
    await montar();
    await clicar();
    servidor.status = { ...OCIOSO, last_finished_at: atras(0), can_refresh: false };
    await avancar();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledTimes(1);
    await avancar(ATUALIZAR_POLL_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("não atualiza enquanto a coleta segue rodando", async () => {
    await montar();
    await clicar();
    servidor.status = RODANDO;
    await avancar(ATUALIZAR_POLL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
    expect(botao()).toHaveTextContent("Atualizando…");
  });

  it("atualiza mesmo quando termina com erro e lista as contas", async () => {
    await montar();
    await clicar();
    servidor.status = {
      ...OCIOSO,
      has_current_error: true,
      errors: [{ account_id: "a1", name: "Conta X", platform: "meta-ads", last_error_message: "token expirado" }],
    };
    await avancar();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("atualizar-agora-erro")).toHaveTextContent("Conta X (Meta Ads): token expirado");
  });

  it("coleta já em andamento ao abrir é acompanhada e atualiza ao fim", async () => {
    servidor.status = RODANDO;
    await montar();
    expect(botao().disabled).toBe(true);
    expect(botao()).toHaveTextContent("Já há uma coleta em andamento…");
    servidor.status = OCIOSO;
    await avancar();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(posts()).toBe(0);
  });

  it("202 skipped: acompanha a rodada de outro", async () => {
    await montar();
    servidor.post = () => resp(202, { skipped: "em andamento" });
    await clicar();
    expect(botao()).toHaveTextContent("Já há uma coleta em andamento…");
  });

  it("intervalo: botão desabilitado com a dica de idade", async () => {
    servidor.status = { ...OCIOSO, last_finished_at: atras(3), can_refresh: false };
    await montar();
    expect(botao().disabled).toBe(true);
    expect(screen.getByTestId("atualizar-agora-dica")).toHaveTextContent("Dados atualizados");
    expect(posts()).toBe(0);
  });

  it("429 mostra mensagem e não atualiza", async () => {
    await montar();
    servidor.post = () => resp(429, { error: "Atualizado há pouco" });
    await clicar();
    expect(screen.getByTestId("atualizar-agora-mensagem")).toHaveTextContent("atualizados há pouco");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("403 e erro de rede têm mensagens próprias", async () => {
    await montar();
    servidor.post = () => resp(403, {});
    await clicar();
    expect(screen.getByTestId("atualizar-agora-mensagem")).toHaveTextContent("Sem permissão");
    servidor.post = () => Promise.reject(new Error("net"));
    await clicar();
    expect(screen.getByTestId("atualizar-agora-mensagem")).toHaveTextContent("Falha de rede");
  });

  it("duplo clique antes da resposta dispara um só POST", async () => {
    await montar();
    let liberar!: () => void;
    servidor.post = () =>
      new Promise((ok) => {
        liberar = () => ok({ ok: true, status: 202, json: () => Promise.resolve({ accepted: true }) });
      });
    fireEvent.click(botao());
    fireEvent.click(botao());
    await avancar(0);
    liberar();
    await avancar(0);
    expect(posts()).toBe(1);
  });
});
