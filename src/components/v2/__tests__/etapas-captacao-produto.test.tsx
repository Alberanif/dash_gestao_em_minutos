/** @jest-environment jsdom */
import React, { useState } from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { EtapaCaptacao } from "../eventos/novo-evento/etapa-captacao";
import { EtapaProdutoPrincipal } from "../eventos/novo-evento/etapa-produto-principal";
import { estadoInicial, type EstadoAssistente, type PropsEtapa } from "../eventos/novo-evento/estado";

const PRODUTOS = [
  { product_id: "111", product_name: "Mentoria Alfa" },
  { product_id: "222", product_name: "Curso Beta" },
];
const OFERTAS = [
  { offer_code: "of1", offer_name: "Oferta Cheia", is_active: true },
  { offer_code: "of2", offer_name: "Oferta Promo", is_active: true },
  { offer_code: "of3", offer_name: "Oferta Antiga", is_active: false },
];

let estadoAtual: EstadoAssistente;
let fetchMock: jest.Mock;
let respostas: {
  leads: () => Promise<unknown> | unknown;
  ofertas: () => Promise<unknown> | unknown;
};

function json(dados: unknown, ok = true) {
  return { ok, json: async () => dados };
}

beforeEach(() => {
  jest.useFakeTimers();
  respostas = {
    leads: () => json(["Live 1", "Live 2"]),
    ofertas: () => json(OFERTAS),
  };
  fetchMock = jest.fn(async (url: string) => {
    if (url.startsWith("/api/funnels/products")) return json(PRODUTOS);
    if (url.startsWith("/api/indicadores/leads/events")) return respostas.leads();
    if (url.startsWith("/api/hotmart/offers")) return respostas.ofertas();
    throw new Error("url inesperada " + url);
  });
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});

afterEach(() => {
  jest.useRealTimers();
});

function Casca({ Etapa, inicial }: { Etapa: React.ComponentType<PropsEtapa>; inicial?: Partial<EstadoAssistente> }) {
  const [estado, setEstado] = useState<EstadoAssistente>({ ...estadoInicial, ...inicial });
  estadoAtual = estado;
  return <Etapa estado={estado} atualizar={(p) => setEstado((e) => ({ ...e, ...p }))} />;
}

async function fluxo(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {});
}

async function buscarEEscolher(rotulo: RegExp, nomeProduto: string) {
  const campo = screen.getByRole("combobox", { name: rotulo });
  fireEvent.focus(campo);
  fireEvent.change(campo, { target: { value: "men" } });
  await fluxo(300);
  fireEvent.mouseDown(screen.getByRole("option", { name: new RegExp(nomeProduto) }));
}

describe("EtapaCaptacao", () => {
  it("o switch orgânico esconde a seção de produtos e preserva os produtos ao desligar", async () => {
    render(<Casca Etapa={EtapaCaptacao} />);
    await fluxo();
    await buscarEEscolher(/produto de captura/i, "Mentoria Alfa");
    expect(screen.getByRole("button", { name: "Remover Mentoria Alfa" })).toBeTruthy();

    const sw = screen.getByRole("switch", { name: /captação orgânica/i });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);

    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover Mentoria Alfa" })).toBeNull();
    expect(screen.getByText(/captura Hotmart não conta/i)).toBeTruthy();
    // O estado nunca é apagado.
    expect(estadoAtual.produtosCaptura).toEqual([PRODUTOS[0]]);

    fireEvent.click(sw);
    expect(screen.getByRole("button", { name: "Remover Mentoria Alfa" })).toBeTruthy();
    expect(estadoAtual.produtosCaptura).toEqual([PRODUTOS[0]]);
  });

  it("busca produto (debounce de 300 ms), seleciona e remove o chip", async () => {
    render(<Casca Etapa={EtapaCaptacao} />);
    await fluxo();
    const campo = screen.getByRole("combobox", { name: /produto de captura/i });
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: "men" } });
    await fluxo(299);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("q=men"))).toBe(false);
    await fluxo(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/funnels/products?q=men");

    // Setas + Enter escolhem a segunda opção.
    fireEvent.keyDown(campo, { key: "ArrowDown" });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(estadoAtual.produtosCaptura).toEqual([PRODUTOS[1]]);
    expect(screen.getByRole("button", { name: "Remover Curso Beta" })).toBeTruthy();

    // Já escolhido não volta como opção.
    fireEvent.focus(campo);
    await fluxo(300);
    expect(screen.queryByRole("option", { name: /Curso Beta/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Remover Curso Beta" }));
    expect(estadoAtual.produtosCaptura).toEqual([]);
    expect(screen.queryByRole("button", { name: "Remover Curso Beta" })).toBeNull();
  });

  it("Esc fecha a lista de resultados", async () => {
    render(<Casca Etapa={EtapaCaptacao} />);
    const campo = screen.getByRole("combobox", { name: /produto de captura/i });
    fireEvent.focus(campo);
    await fluxo(300);
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(campo, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("carrega os eventos de Leads uma vez, marca e desmarca", async () => {
    render(<Casca Etapa={EtapaCaptacao} />);
    expect(screen.getByText(/carregando eventos/i)).toBeTruthy();
    await fluxo();
    const leadsCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes("leads/events")).length;
    expect(leadsCalls()).toBe(1);

    fireEvent.click(screen.getByRole("checkbox", { name: "Live 2" }));
    expect(estadoAtual.eventosLeads).toEqual(["Live 2"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Live 1" }));
    expect(estadoAtual.eventosLeads).toEqual(["Live 2", "Live 1"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Live 2" }));
    expect(estadoAtual.eventosLeads).toEqual(["Live 1"]);
    expect((screen.getByRole("checkbox", { name: "Live 1" }) as HTMLInputElement).checked).toBe(true);
    expect(leadsCalls()).toBe(1);
  });

  it("filtra a lista quando há muitos eventos", async () => {
    respostas.leads = () => json(Array.from({ length: 12 }, (_, i) => `Evento ${i + 1}`));
    render(<Casca Etapa={EtapaCaptacao} />);
    await fluxo();
    fireEvent.change(screen.getByRole("textbox", { name: /filtrar eventos/i }), { target: { value: "12" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "Evento 12" })).toBeTruthy();
  });

  it("mostra estado vazio quando não há eventos", async () => {
    respostas.leads = () => json([]);
    render(<Casca Etapa={EtapaCaptacao} />);
    await fluxo();
    expect(screen.getByText(/nenhum evento encontrado/i)).toBeTruthy();
  });

  it("mostra erro de rede e recarrega com Tentar de novo", async () => {
    respostas.leads = () => {
      throw new Error("rede");
    };
    render(<Casca Etapa={EtapaCaptacao} />);
    await fluxo();
    expect(screen.getByRole("alert").textContent).toMatch(/não foi possível carregar/i);

    respostas.leads = () => json(["Live 9"]);
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    await fluxo();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Live 9" })).toBeTruthy();
  });
});

describe("EtapaProdutoPrincipal", () => {
  it("adiciona e remove produto principal com selo Todas as ofertas", async () => {
    render(<Casca Etapa={EtapaProdutoPrincipal} />);
    await buscarEEscolher(/produto principal/i, "Mentoria Alfa");
    expect(estadoAtual.produtosPrincipais).toEqual([{ ...PRODUTOS[0], offer_codes: [] }]);
    expect(screen.getByText("Todas as ofertas")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remover Mentoria Alfa" }));
    expect(estadoAtual.produtosPrincipais).toEqual([]);
    expect(screen.queryByText("Todas as ofertas")).toBeNull();
  });

  it("escolher ofertas atualiza offer_codes e o selo, e reabrir usa o cache", async () => {
    render(
      <Casca
        Etapa={EtapaProdutoPrincipal}
        inicial={{ produtosPrincipais: [{ ...PRODUTOS[0], offer_codes: [] }] }}
      />,
    );
    const ofertasCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith("/api/hotmart/offers")).length;

    fireEvent.click(screen.getByRole("button", { name: /escolher ofertas de mentoria alfa/i }));
    await fluxo();
    const painel = screen.getByRole("dialog");
    expect(fetchMock).toHaveBeenCalledWith("/api/hotmart/offers?product_id=111&include_inactive=true");
    expect(within(painel).getByText("Todas as ofertas", { selector: "span" })).toBeTruthy();

    fireEvent.click(within(painel).getByRole("checkbox", { name: /Oferta Cheia/ }));
    expect(estadoAtual.produtosPrincipais[0].offer_codes).toEqual(["of1"]);
    expect(within(painel).getByText("1 oferta")).toBeTruthy();

    fireEvent.click(within(painel).getByRole("checkbox", { name: /Oferta Promo/ }));
    expect(estadoAtual.produtosPrincipais[0].offer_codes).toEqual(["of1", "of2"]);
    expect(within(painel).getByText("2 ofertas")).toBeTruthy();

    fireEvent.click(within(painel).getByRole("checkbox", { name: /Oferta Cheia/ }));
    expect(estadoAtual.produtosPrincipais[0].offer_codes).toEqual(["of2"]);

    fireEvent.click(within(painel).getByRole("button", { name: "Concluir" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("1 oferta")).toBeTruthy();

    // Reabrir: sem novo fetch.
    fireEvent.click(screen.getByRole("button", { name: /escolher ofertas de mentoria alfa/i }));
    await fluxo();
    expect(ofertasCalls()).toBe(1);
    expect(screen.getByRole("checkbox", { name: /Oferta Promo/ })).toBeTruthy();

    // Todas as ofertas limpa a seleção.
    fireEvent.click(screen.getByRole("button", { name: "Todas as ofertas" }));
    expect(estadoAtual.produtosPrincipais[0].offer_codes).toEqual([]);
  });

  it("erro ao carregar ofertas permite tentar de novo", async () => {
    respostas.ofertas = () => json({}, false);
    render(
      <Casca
        Etapa={EtapaProdutoPrincipal}
        inicial={{ produtosPrincipais: [{ ...PRODUTOS[0], offer_codes: [] }] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /escolher ofertas/i }));
    await fluxo();
    expect(screen.getByRole("alert").textContent).toMatch(/não foi possível carregar as ofertas/i);
    respostas.ofertas = () => json(OFERTAS);
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    await fluxo();
    expect(screen.getByRole("checkbox", { name: /Oferta Cheia/ })).toBeTruthy();
  });

  it("explica que a etapa é opcional", () => {
    render(<Casca Etapa={EtapaProdutoPrincipal} />);
    expect(screen.getByText(/opcional/i)).toBeTruthy();
  });
});
