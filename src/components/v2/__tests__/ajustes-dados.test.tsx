/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DadosAjustes } from "../ajustes/dados/dados-ajustes";
import { CONFIG_LOTE, dividirEmMeses, executarLote, type EstadoLote } from "../ajustes/dados/lote";
import { tempoRelativo } from "../ajustes/dados/logs";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";

beforeAll(() => {
  mockReducedMotion(false);
  // O Select do Radix usa APIs que o jsdom não implementa.
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.releasePointerCapture = jest.fn();
});

describe("dividirEmMeses", () => {
  it("um mês inteiro vira um chunk", () => {
    expect(dividirEmMeses("2026-02-01", "2026-02-28")).toEqual([{ start: "2026-02-01", end: "2026-02-28" }]);
  });

  it("atravessa a virada de ano e termina no mês parcial", () => {
    expect(dividirEmMeses("2025-11-15", "2026-02-10")).toEqual([
      { start: "2025-11-15", end: "2025-11-30" },
      { start: "2025-12-01", end: "2025-12-31" },
      { start: "2026-01-01", end: "2026-01-31" },
      { start: "2026-02-01", end: "2026-02-10" },
    ]);
  });

  it("começar no dia 31 não pula fevereiro", () => {
    const c = dividirEmMeses("2026-01-31", "2026-03-05");
    expect(c.map((x) => x.start)).toEqual(["2026-01-31", "2026-02-01", "2026-03-01"]);
    expect(c[1].end).toBe("2026-02-28");
  });

  it("fevereiro bissexto tem 29 dias", () => {
    expect(dividirEmMeses("2028-02-01", "2028-03-01")[0].end).toBe("2028-02-29");
  });

  it("intervalo invertido ou data inválida não gera chunks", () => {
    expect(dividirEmMeses("2026-03-01", "2026-02-01")).toEqual([]);
    expect(dividirEmMeses("", "2026-02-01")).toEqual([]);
  });
});

function resposta(ok: boolean, json: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(json) } as Response);
}

describe("executarLote", () => {
  it("Hotmart para no primeiro erro, com a mensagem do chunk, e não chama os seguintes", async () => {
    const fetcher = jest
      .fn()
      .mockImplementationOnce(() => resposta(true, { salesRecords: 10 }))
      .mockImplementationOnce(() => resposta(false, { error: "limite excedido" }));
    const esperar = jest.fn().mockResolvedValue(undefined);
    const estados: EstadoLote[] = [];
    const final = await executarLote({
      config: CONFIG_LOTE.hotmart,
      contaId: "c1",
      inicio: "2026-01-01",
      fim: "2026-04-30",
      aoMudar: (e) => estados.push(e),
      fetcher: fetcher as unknown as typeof fetch,
      esperar,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(final.status).toBe("error");
    expect(final.erro).toBe("Falha no chunk 2026-02-01→2026-02-28: limite excedido");
    expect(final.chunks?.map((c) => c.status)).toEqual(["success", "error", "pending", "pending"]);
    expect(final.acumulado).toBe(10);
    expect(esperar).toHaveBeenCalledTimes(1);
  });

  it("pausa 1500 ms entre chunks, e não depois do último", async () => {
    const fetcher = jest.fn().mockImplementation(() => resposta(true, { salesRecords: 5 }));
    const esperar = jest.fn().mockResolvedValue(undefined);
    const final = await executarLote({
      config: CONFIG_LOTE.hotmart,
      contaId: "c1",
      inicio: "2026-01-10",
      fim: "2026-03-10",
      aoMudar: () => {},
      fetcher: fetcher as unknown as typeof fetch,
      esperar,
    });
    expect(esperar.mock.calls).toEqual([[1500], [1500]]);
    expect(final.status).toBe("success");
    expect(final.resultado).toBe("15 registros coletados em 3 lotes");
  });

  it("manda account_id, start_date e end_date de cada chunk", async () => {
    const fetcher = jest.fn().mockImplementation(() => resposta(true, { salesRecords: 1 }));
    await executarLote({
      config: CONFIG_LOTE.hotmart,
      contaId: "c9",
      inicio: "2025-12-20",
      fim: "2026-01-05",
      aoMudar: () => {},
      fetcher: fetcher as unknown as typeof fetch,
      esperar: async () => {},
    });
    const corpos = fetcher.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(corpos).toEqual([
      { account_id: "c9", start_date: "2025-12-20", end_date: "2025-12-31" },
      { account_id: "c9", start_date: "2026-01-01", end_date: "2026-01-05" },
    ]);
  });

  it("falha de rede em plataforma de chamada única devolve a mensagem de comunicação", async () => {
    const final = await executarLote({
      config: CONFIG_LOTE.youtube,
      contaId: "c1",
      inicio: "2026-01-01",
      fim: "2026-01-31",
      aoMudar: () => {},
      fetcher: (() => Promise.reject(new Error("off"))) as unknown as typeof fetch,
    });
    expect(final).toMatchObject({ status: "error", erro: "Falha na comunicação com o servidor", chunks: null });
  });
});

describe("tempoRelativo", () => {
  it("formata minutos, horas e dias", () => {
    const agora = Date.parse("2026-10-25T12:00:00Z");
    expect(tempoRelativo("2026-10-25T11:30:00Z", agora)).toBe("há 30 min");
    expect(tempoRelativo("2026-10-25T10:00:00Z", agora)).toBe("há 2 h");
    expect(tempoRelativo("2026-10-22T12:00:00Z", agora)).toBe("há 3 d");
  });
});

const agoraIso = (minAtras: number) => new Date(Date.now() - minAtras * 60000).toISOString();

type Rotas = Record<string, (init?: RequestInit) => Promise<Response>>;

function instalarFetch(extra: Rotas = {}, logs: unknown[] = []) {
  const rotas: Rotas = {
    "/api/logs": () => resposta(true, { logs }),
    "/api/accounts": () => resposta(true, [{ id: "a1", name: "Conta Um" }]),
    ...extra,
  };
  const mock = jest.fn((url: string, init?: RequestInit) => {
    const caminho = url.split("?")[0];
    const r = rotas[caminho];
    return r ? r(init) : resposta(false, { error: `sem rota ${caminho}` });
  });
  (global as unknown as { fetch: unknown }).fetch = mock;
  return mock;
}

function montar() {
  return render(
    <V2Root className="v2">
      <DadosAjustes />
    </V2Root>,
  );
}

async function trocarAba(nome: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name: nome }), { button: 0 });
  await waitFor(() => expect(screen.getByRole("tab", { name: nome }).getAttribute("data-state")).toBe("active"));
  // A troca é "wait": o painel antigo sai antes de o novo entrar.
  await screen.findByRole("button", { name: `Sincronizar ${nome}` });
}

function preencherDatas(inicio: string, fim: string) {
  fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: inicio } });
  fireEvent.change(screen.getByLabelText("Data final"), { target: { value: fim } });
}

const chamadasPara = (mock: jest.Mock, caminho: string) =>
  mock.mock.calls.filter((c) => String(c[0]).split("?")[0] === caminho);

describe("tela Dados e sincronização", () => {
  it.each([
    ["YouTube", "/api/youtube/batch-collect", { channelRecords: 12, videoRecords: 4 }, "12 dias coletados + 4 vídeos atualizados"],
    ["Instagram", "/api/instagram/batch-collect", { profileRecords: 7, mediaRecords: 3 }, "7 dias de insights + 3 mídias coletados"],
    ["Meta Ads", "/api/meta-ads/batch-collect", { dailyRecords: 9, campaignDailyRecords: 20 }, "9 dias + 20 registros de campanha coletados"],
    ["Hotmart", "/api/hotmart/batch-collect", { salesRecords: 1500 }, "1.500 registros coletados em 1 lotes"],
  ])("%s: o lote chama %s com o payload da conta e do intervalo", async (aba, endpoint, json, mensagem) => {
    const mock = instalarFetch({ [endpoint]: () => resposta(true, json) });
    montar();
    if (aba !== "YouTube") await trocarAba(aba);
    await waitFor(() => expect((screen.getByRole("button", { name: "Executar coleta" }) as HTMLButtonElement)).toBeTruthy());
    preencherDatas("2026-03-01", "2026-03-20");
    await waitFor(() => expect((screen.getByRole("button", { name: "Executar coleta" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Executar coleta" }));
    await screen.findByText(mensagem);
    const chamada = chamadasPara(mock, endpoint);
    expect(chamada).toHaveLength(1);
    expect(chamada[0][1].method).toBe("POST");
    expect(JSON.parse(chamada[0][1].body)).toEqual({ account_id: "a1", start_date: "2026-03-01", end_date: "2026-03-20" });
    // O histórico é recarregado depois do sucesso.
    await waitFor(() => expect(chamadasPara(mock, "/api/logs").length).toBeGreaterThanOrEqual(2));
  });

  it("Hotmart: erro no chunk mostra a mensagem e o progresso falho", async () => {
    instalarFetch({ "/api/hotmart/batch-collect": () => resposta(false, { error: "token expirado" }) });
    montar();
    await trocarAba("Hotmart");
    await waitFor(() => expect((screen.getByRole("button", { name: "Executar coleta" }) as HTMLButtonElement).disabled).toBe(true));
    preencherDatas("2026-03-01", "2026-03-20");
    await waitFor(() => expect((screen.getByRole("button", { name: "Executar coleta" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Executar coleta" }));
    await screen.findByText("Falha no chunk 2026-03-01→2026-03-20: token expirado");
    expect(screen.getByText("Falhou")).toBeTruthy();
  });

  it("mudar as datas apaga o progresso e o resultado", async () => {
    instalarFetch({ "/api/hotmart/batch-collect": () => resposta(true, { salesRecords: 3 }) });
    montar();
    await trocarAba("Hotmart");
    await waitFor(() => expect(screen.getByRole("button", { name: "Executar coleta" })).toBeTruthy());
    preencherDatas("2026-03-01", "2026-03-20");
    await waitFor(() => expect((screen.getByRole("button", { name: "Executar coleta" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Executar coleta" }));
    await screen.findByText("3 registros coletados em 1 lotes");
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-03-25" } });
    expect(screen.queryByText("3 registros coletados em 1 lotes")).toBeNull();
    expect(screen.queryByLabelText("Progresso da coleta")).toBeNull();
  });

  it("Sincronizar chama /api/sync com a plataforma da aba ativa", async () => {
    const mock = instalarFetch({ "/api/sync": () => resposta(true, {}) });
    montar();
    await trocarAba("Instagram");
    fireEvent.click(await screen.findByRole("button", { name: "Sincronizar Instagram" }));
    await screen.findByText("Sincronização concluída");
    const chamada = chamadasPara(mock, "/api/sync");
    expect(chamada).toHaveLength(1);
    expect(JSON.parse(chamada[0][1].body)).toEqual({ platform: "instagram" });
  });

  it("Sincronizar mostra o erro devolvido pela API", async () => {
    instalarFetch({ "/api/sync": () => resposta(false, { error: "cota esgotada" }) });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Sincronizar YouTube" }));
    await screen.findByText("cota esgotada");
  });

  it("Última coleta reflete o log mais recente, mesmo fora de ordem", async () => {
    instalarFetch(
      {},
      [
        { id: "1", status: "error", account_name: "X", started_at: agoraIso(60 * 30), finished_at: null, duration_s: 1, records_collected: 5, error_message: "ruim" },
        { id: "2", status: "success", account_name: "X", started_at: agoraIso(120), finished_at: null, duration_s: 2, records_collected: 340, error_message: null },
      ],
    );
    montar();
    await screen.findByText("há 2 h, 340 registros");
    expect(screen.getByText("Última coleta:").parentElement?.textContent).toContain("Concluída");
  });

  it("sem logs mostra o estado vazio", async () => {
    instalarFetch();
    montar();
    await screen.findByText("Nenhuma coleta registrada");
  });

  it("falha ao carregar os logs diz o que fazer e permite tentar de novo", async () => {
    let tentativa = 0;
    instalarFetch({
      "/api/logs": () => (tentativa++ === 0 ? Promise.reject(new Error("off")) : resposta(true, { logs: [] })),
    });
    montar();
    await screen.findByText(/Não foi possível carregar o histórico/);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("Nenhuma coleta registrada");
  });

  it("copia a mensagem de erro do log", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    instalarFetch(
      {},
      [{ id: "1", status: "error", account_name: "X", started_at: agoraIso(5), finished_at: null, duration_s: 3, records_collected: null, error_message: "token inválido" }],
    );
    montar();
    const tabela = await screen.findByRole("table");
    fireEvent.click(within(tabela).getByRole("button", { name: "Copiar mensagem de erro" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("token inválido"));
    await within(tabela).findByRole("button", { name: "Mensagem copiada" });
  });

  it("Hotmart: o catálogo chama sync-products e mostra os totais", async () => {
    const mock = instalarFetch({
      "/api/hotmart/sync-products": () => resposta(true, { productsRecords: 8, offersRecords: 21 }),
    });
    montar();
    await trocarAba("Hotmart");
    const botao = await screen.findByRole("button", { name: "Sincronizar produtos" });
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(botao);
    await screen.findByText("8 produtos e 21 ofertas sincronizados");
    expect(JSON.parse(chamadasPara(mock, "/api/hotmart/sync-products")[0][1].body)).toEqual({ account_id: "a1" });
  });

  it("Meta Ads: o diálogo de ajustes sincroniza campanhas da conta escolhida", async () => {
    const mock = instalarFetch({
      "/api/meta-ads/campaigns-sync": () => resposta(true, { campaignsCollected: 14 }),
    });
    montar();
    await trocarAba("Meta Ads");
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ajustes" }));
    const dialogo = await screen.findByRole("dialog");
    expect((within(dialogo).getByRole("button", { name: "Sincronizar campanhas" }) as HTMLButtonElement).disabled).toBe(true);
    // Radix Select abre por pointerdown/teclado; o teclado funciona no jsdom.
    const gatilho = within(dialogo).getByRole("combobox", { name: "Conta do Meta Ads" });
    await act(async () => {
      gatilho.focus();
      fireEvent.keyDown(gatilho, { key: "Enter" });
    });
    const opcao = await screen.findByRole("option", { name: "Conta Um" });
    fireEvent.click(opcao);
    await waitFor(() =>
      expect((within(dialogo).getByRole("button", { name: "Sincronizar campanhas" }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(within(dialogo).getByRole("button", { name: "Sincronizar campanhas" }));
    await within(dialogo).findByText("14 campanhas sincronizadas");
    expect(JSON.parse(chamadasPara(mock, "/api/meta-ads/campaigns-sync")[0][1].body)).toEqual({ account_id: "a1" });
  });

  it("recarrega logs e contas da plataforma ao trocar de aba", async () => {
    const mock = instalarFetch();
    montar();
    await screen.findByText("Nenhuma coleta registrada");
    await trocarAba("Hotmart");
    await waitFor(() => {
      expect(mock.mock.calls.some((c) => c[0] === "/api/logs?platform=hotmart")).toBe(true);
      expect(mock.mock.calls.some((c) => c[0] === "/api/accounts?platform=hotmart")).toBe(true);
    });
  });
});
