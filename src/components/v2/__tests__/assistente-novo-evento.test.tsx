/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { AssistenteNovoEvento } from "../eventos/novo-evento/assistente";
import { estadoInicial, montarCorpo, type EstadoAssistente } from "../eventos/novo-evento/estado";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// Etapas mínimas: o que importa aqui é a casca (navegação, trilho, criação).
jest.mock("../eventos/novo-evento/etapa-identificacao", () => ({
  EtapaIdentificacao: ({ estado, atualizar }: { estado: EstadoAssistente; atualizar: (p: Partial<EstadoAssistente>) => void }) => (
    <input aria-label="Nome do evento" value={estado.nome} onChange={(e) => atualizar({ nome: e.target.value })} />
  ),
}));
jest.mock("../eventos/novo-evento/etapa-captacao", () => ({
  EtapaCaptacao: ({ estado, atualizar }: { estado: EstadoAssistente; atualizar: (p: Partial<EstadoAssistente>) => void }) => (
    <div>
      <p>conteudo captacao</p>
      <button type="button" onClick={() => atualizar({ eventosLeads: ["Evento A"] })}>
        adicionar fonte
      </button>
      <span data-testid="fontes">{estado.eventosLeads.join(",")}</span>
    </div>
  ),
}));
jest.mock(
  "../eventos/novo-evento/etapa-produto-principal",
  () => ({ EtapaProdutoPrincipal: () => <p>conteudo produto</p> }),
  { virtual: true },
);
jest.mock("../eventos/novo-evento/etapa-trafego", () => ({ EtapaTrafego: () => <p>conteudo trafego</p> }));
jest.mock("../eventos/novo-evento/etapa-revisao", () => ({
  EtapaRevisao: ({ problemas }: { problemas: { mensagem: string }[] }) => (
    <ul aria-label="problemas">
      {problemas.map((p) => (
        <li key={p.mensagem}>{p.mensagem}</li>
      ))}
    </ul>
  ),
}));

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  push.mockReset();
  global.fetch = jest.fn();
});

const trilho = () => within(screen.getByRole("navigation", { name: "Etapas" }));
const continuar = () => screen.getByRole("button", { name: "Continuar" });

function abrir(onFechar = jest.fn()) {
  render(<AssistenteNovoEvento accountId="acc-1" onFechar={onFechar} />);
  return onFechar;
}

function digitarNome(nome: string) {
  fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: nome } });
}

/** Percorre até a Revisão com o nome preenchido. */
function irAteRevisao() {
  digitarNome("Imersão 2026");
  for (let i = 0; i < 4; i++) fireEvent.click(continuar());
}

describe("AssistenteNovoEvento", () => {
  it("(a) abre na etapa 1 e só o nome libera o Continuar, com o motivo visível", () => {
    abrir();
    expect(screen.getByRole("dialog", { name: "Novo evento" })).toBeTruthy();
    expect(trilho().getByRole("button", { name: /Identificação/ }).getAttribute("aria-current")).toBe("step");
    expect((continuar() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Dê um nome ao evento para continuar.")).toBeTruthy();

    digitarNome("   ");
    expect((continuar() as HTMLButtonElement).disabled).toBe(true);

    digitarNome("Imersão 2026");
    expect((continuar() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("Dê um nome ao evento para continuar.")).toBeNull();
  });

  it("(b) avança sem exigir nada nas etapas 2 a 4 e volta sem perder o estado", () => {
    abrir();
    digitarNome("Imersão 2026");
    fireEvent.click(continuar());
    expect(screen.getByText("conteudo captacao")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "adicionar fonte" }));
    fireEvent.click(continuar());
    expect(screen.getByText("conteudo produto")).toBeTruthy();
    fireEvent.click(continuar());
    expect(screen.getByText("conteudo trafego")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByTestId("fontes").textContent).toBe("Evento A");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect((screen.getByLabelText("Nome do evento") as HTMLInputElement).value).toBe("Imersão 2026");
  });

  it("(c) etapa visitada é clicável no trilho; a não visitada não", () => {
    abrir();
    expect((trilho().getByRole("button", { name: /Captação/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((trilho().getByRole("button", { name: /Revisão/ }) as HTMLButtonElement).disabled).toBe(true);

    digitarNome("Imersão 2026");
    fireEvent.click(continuar());
    fireEvent.click(continuar());
    // Voltou à etapa 3: a 1 e a 2 são clicáveis, a 4 ainda não.
    fireEvent.click(trilho().getByRole("button", { name: /Identificação/ }));
    expect(screen.getByLabelText("Nome do evento")).toBeTruthy();
    expect((trilho().getByRole("button", { name: /Produto principal/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((trilho().getByRole("button", { name: /Tráfego/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(trilho().getByRole("button", { name: /Produto principal/ }));
    expect(screen.getByText("conteudo produto")).toBeTruthy();
  });

  it("(d) na Revisão com problemas, desabilita Criar dashboard e marca a etapa no trilho", () => {
    abrir();
    irAteRevisao();
    expect(within(screen.getByRole("list", { name: "problemas" })).getAllByRole("listitem")).toHaveLength(1);
    const criar = screen.getByRole("button", { name: "Criar dashboard" }) as HTMLButtonElement;
    expect(criar.disabled).toBe(true);
    expect(screen.getByText(/Resolva 1 pendência/)).toBeTruthy();
    expect(trilho().getByRole("button", { name: /Captação.*com pendência/ })).toBeTruthy();
    expect(trilho().queryByRole("button", { name: /Identificação.*com pendência/ })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("(e) cria: POST com o corpo de montarCorpo e navega para o dashboard", async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "f-9" }) });
    const onFechar = abrir();
    digitarNome("Imersão 2026");
    fireEvent.click(continuar());
    fireEvent.click(screen.getByRole("button", { name: "adicionar fonte" }));
    fireEvent.click(continuar());
    fireEvent.click(continuar());
    fireEvent.click(continuar());

    const criar = screen.getByRole("button", { name: "Criar dashboard" }) as HTMLButtonElement;
    expect(criar.disabled).toBe(false);
    fireEvent.click(criar);
    fireEvent.click(criar);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/v2/indicadores/f-9"));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/indicadores/filters");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual(
      JSON.parse(JSON.stringify(montarCorpo({ ...estadoInicial, nome: "Imersão 2026", eventosLeads: ["Evento A"] }, "acc-1"))),
    );
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("(f) erro da API aparece e preserva o estado; permite tentar de novo", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "Nome já usado." }) });
    const onFechar = abrir();
    digitarNome("Imersão 2026");
    fireEvent.click(continuar());
    fireEvent.click(screen.getByRole("button", { name: "adicionar fonte" }));
    for (let i = 0; i < 3; i++) fireEvent.click(continuar());

    fireEvent.click(screen.getByRole("button", { name: "Criar dashboard" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Nome já usado.");
    expect(push).not.toHaveBeenCalled();
    expect(onFechar).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Criar dashboard" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(trilho().getByRole("button", { name: /Identificação/ }));
    expect((screen.getByLabelText("Nome do evento") as HTMLInputElement).value).toBe("Imersão 2026");

    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    fireEvent.click(continuar());
    for (let i = 0; i < 3; i++) fireEvent.click(continuar());
    fireEvent.click(screen.getByRole("button", { name: "Criar dashboard" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível criar o evento.");
  });

  it("mostra Criando... enquanto a requisição está em andamento", async () => {
    let resolver: (v: unknown) => void = () => {};
    (fetch as jest.Mock).mockReturnValue(new Promise((r) => (resolver = r)));
    abrir();
    digitarNome("X");
    fireEvent.click(continuar());
    fireEvent.click(screen.getByRole("button", { name: "adicionar fonte" }));
    for (let i = 0; i < 3; i++) fireEvent.click(continuar());
    fireEvent.click(screen.getByRole("button", { name: "Criar dashboard" }));
    const botao = (await screen.findByRole("button", { name: "Criando..." })) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    resolver({ ok: true, json: async () => ({ id: "1" }) });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("(g) Esc chama onFechar", () => {
    const onFechar = abrir();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("anuncia a etapa numa região aria-live", () => {
    abrir();
    const regiao = screen.getByRole("status");
    expect(regiao.textContent).toBe("Etapa 1 de 5: Identificação");
    digitarNome("A");
    fireEvent.click(continuar());
    expect(regiao.textContent).toBe("Etapa 2 de 5: Captação");
  });
});
