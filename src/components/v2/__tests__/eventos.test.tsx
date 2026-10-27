/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import type { FilterRecord, FilterStatus } from "@/types/indicadores";
import { EventosLista } from "../eventos/eventos-lista";
import { MetricasCelulas } from "../eventos/metricas-celulas";
import { EventosErro, EventosVazio } from "../eventos/estados";
import { hrefDoEvento } from "../eventos/pastas";
import type { AcoesPastas } from "../eventos/pastas-regras";
import type { PastaUsuario } from "../eventos/pastas-servidor";
import { folhasVisiveis } from "../eventos/pasta-arquivo";
import { mockReducedMotion } from "./helpers";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
// O assistente real é de outro módulo: aqui basta um dialog que expõe accountId e onFechar.
jest.mock("../eventos/novo-evento/assistente", () => ({
  AssistenteNovoEvento: ({ accountId, onFechar }: { accountId: string; onFechar: () => void }) => (
    <div role="dialog" aria-label="Assistente simulado" data-conta={accountId}>
      <button onClick={onFechar}>Fechar assistente</button>
    </div>
  ),
}), { virtual: true });

beforeEach(() => mockReducedMotion(false));

function evento(id: string, name: string, status: FilterStatus, extra: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id,
    account_id: "acc",
    name,
    hotmart_products: [{ product_id: "1", product_name: "P" }],
    meta_ads_terms: ["PC", "  "],
    captacao_leads_eventos: [],
    is_organic: false,
    status,
    status_changed_at: "2026-07-02T15:00:00Z",
    created_at: "2026-06-01T15:00:00Z",
    updated_at: "2026-07-02T15:00:00Z",
    ...extra,
  };
}

const filtros = [
  evento("a1", "Imersão Alfa", "ativo"),
  evento("a2", "Imersão Beta", "ativo"),
  evento("f1", "Encontro 2025", "finalizado"),
  evento("c1", "Evento Cancelado", "cancelado"),
];

const pastas: PastaUsuario[] = [
  { id: "p1", nome: "Imersões", cor: "violeta", eventoIds: ["a1", "a2"] },
  { id: "p2", nome: "Encontros", cor: "verde", eventoIds: ["f1"] },
  { id: "p3", nome: "Arquivo", cor: "azul", eventoIds: [] },
];

const acoes: AcoesPastas = {
  criar: jest.fn().mockResolvedValue({ ok: true, id: "novo" }),
  atualizar: jest.fn().mockResolvedValue({ ok: true }),
  excluir: jest.fn().mockResolvedValue({ ok: true }),
  definirPastasDoEvento: jest.fn().mockResolvedValue({ ok: true }),
};

/** Com pastas: só o c1 fica fora delas. */
function renderLista(lista = filtros, pastasUsuario = pastas) {
  return render(<EventosLista accountId="conta-1" filters={lista} pastasUsuario={pastasUsuario} pastasDisponiveis acoes={acoes} />);
}

const pasta = (nome: RegExp) => screen.getByRole("button", { name: nome });

describe("EventosLista", () => {
  it("não existem pastas de status: só as do usuário e a casa de nova pasta", () => {
    renderLista();
    expect(screen.queryByRole("button", { name: /Eventos (ativos|finalizados|cancelados)/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /Eventos (ativos|finalizados|cancelados)/ })).toBeNull();
    expect(screen.getAllByRole("button").filter((b) => b.classList.contains("v2-pasta"))).toHaveLength(3);
    expect(pasta(/Nova pasta/)).not.toBeNull();
  });

  it("as pastas começam fechadas, com os eventos delas escondidos; o que está fora de pasta aparece em 'Sem pasta'", () => {
    renderLista();
    for (const nome of [/^Imersões/, /^Encontros/, /^Arquivo/]) expect(pasta(nome).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Imersão Alfa")).toBeNull();
    expect(screen.queryByText("Encontro 2025")).toBeNull();
    const soltos = within(screen.getByRole("region", { name: "Eventos sem pasta" }));
    expect(soltos.getByText("Sem pasta")).not.toBeNull();
    expect(soltos.getByText("Evento Cancelado")).not.toBeNull();
  });

  it("sem as pastas disponíveis a tela é só a lista de eventos, sem título", () => {
    render(<EventosLista accountId="conta-1" filters={filtros} />);
    expect(screen.queryByRole("button", { name: /Nova pasta/ })).toBeNull();
    expect(screen.queryByText("Sem pasta")).toBeNull();
    for (const f of filtros) expect(screen.getByText(f.name)).not.toBeNull();
  });

  it("cada pasta mostra a contagem dos seus eventos, mesmo fechada", () => {
    renderLista();
    expect(within(pasta(/^Imersões/)).getByText("2 eventos")).not.toBeNull();
    expect(within(pasta(/^Encontros/)).getByText("1 evento")).not.toBeNull();
    expect(within(pasta(/^Arquivo/)).getByText("0 eventos")).not.toBeNull();
  });

  it("selecionar outra pasta troca os eventos mostrados e fecha a anterior", async () => {
    renderLista();
    fireEvent.click(pasta(/^Imersões/));
    expect(screen.getByText("Imersão Alfa")).not.toBeNull();
    fireEvent.click(pasta(/^Encontros/));
    expect(screen.getByText("Encontro 2025")).not.toBeNull();
    // Os arquivos da pasta anterior saem rápido: ficam escondidos e sem clique até sumirem.
    expect(screen.getByText("Imersão Alfa").closest("[data-saindo]")?.getAttribute("aria-hidden")).toBe("true");
    await waitFor(() => expect(screen.queryByText("Imersão Alfa")).toBeNull());
    expect(pasta(/^Encontros/).getAttribute("aria-expanded")).toBe("true");
    expect(pasta(/^Imersões/).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("region", { name: "Encontros" })).not.toBeNull();
  });

  it("clicar de novo na pasta selecionada mantém a pasta aberta", () => {
    renderLista();
    fireEvent.click(pasta(/^Imersões/));
    fireEvent.click(pasta(/^Imersões/));
    expect(pasta(/^Imersões/).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Imersão Alfa")).not.toBeNull();
  });

  it("as folhas da pasta acompanham a quantidade de eventos, no máximo três", () => {
    expect(folhasVisiveis(0)).toBe(0);
    expect(folhasVisiveis(2)).toBe(2);
    expect(folhasVisiveis(9)).toBe(3);
    const { container } = renderLista();
    const folhas = (nome: RegExp) => pasta(nome).querySelectorAll(".v2-pasta-folha").length;
    expect(folhas(/^Imersões/)).toBe(2);
    expect(folhas(/^Encontros/)).toBe(1);
    expect(container.querySelectorAll(".v2-pasta")).toHaveLength(3);
  });

  it("cada cartão leva ao dashboard do evento e mostra só nome, período e status", () => {
    renderLista();
    fireEvent.click(pasta(/^Imersões/));
    const link = screen.getByRole("link", { name: "Imersão Alfa" });
    expect(link.getAttribute("href")).toBe(hrefDoEvento("a1"));
    const cartao = screen.getByTestId("evento-card-a1");
    expect(within(cartao).getByText("desde 1 jun 2026")).not.toBeNull();
    expect(within(cartao).getByText("Ativo")).not.toBeNull();
    expect(within(cartao).queryByText(/produto|campanha|Abrir dashboard/)).toBeNull();
  });

  it("o link cobre o cartão inteiro: nenhum ancestral dele, até o cartão, é posicionado", () => {
    renderLista();
    fireEvent.click(pasta(/^Imersões/));
    const cartao = screen.getByTestId("evento-card-a1");
    expect(screen.getByRole("link", { name: "Imersão Alfa" }).className).toContain("after:absolute after:inset-0");
    // Um ancestral `relative` entre o link e o cartão encolheria a área clicável ao título.
    for (let no = screen.getByRole("link", { name: "Imersão Alfa" }).parentElement; no && no !== cartao; no = no.parentElement) {
      expect(no.className).not.toMatch(/(relative|absolute|fixed|sticky)/);
    }
    expect(cartao.className).toContain("relative");
  });

  it("finalizado mostra o período fechado e cancelado fica esmaecido", () => {
    renderLista();
    fireEvent.click(pasta(/^Encontros/));
    expect(within(screen.getByTestId("evento-card-f1")).getByText("1 jun – 2 jul 2026")).not.toBeNull();
    expect(within(screen.getByTestId("evento-card-f1")).getByText("Finalizado")).not.toBeNull();
    const cartao = screen.getByTestId("evento-card-c1");
    expect(cartao.className).toContain("opacity-60");
    expect(within(cartao).getByText("Cancelado")).not.toBeNull();
  });

  it("a pasta aberta vai para o meio da fileira e as outras ficam nas pontas", () => {
    renderLista();
    const casa = (nome: RegExp) => pasta(nome).closest<HTMLElement>("[data-slot-pasta]")!.style.getPropertyValue("--d");
    const lugares = () => [casa(/^Imersões/), casa(/^Encontros/), casa(/^Arquivo/)];
    // Nenhuma aberta: ninguém desliza.
    expect(lugares()).toEqual(["0", "0", "0"]);
    fireEvent.click(pasta(/^Imersões/));
    expect(lugares()).toEqual(["1", "-1", "0"]);
    fireEvent.click(pasta(/^Arquivo/));
    expect(lugares()).toEqual(["0", "1", "-1"]);
  });

  it("a busca filtra por nome, abre a pasta com mais resultados e atualiza a contagem das pastas", () => {
    renderLista();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar evento" }), { target: { value: "encontro" } });
    expect(screen.getByText("Encontro 2025")).not.toBeNull();
    expect(pasta(/^Encontros/).getAttribute("aria-expanded")).toBe("true");
    const imersoes = pasta(/^Imersões/);
    expect(within(imersoes).getByText("0 eventos")).not.toBeNull();
    expect(imersoes.hasAttribute("data-esmaecida")).toBe(true);
    // O evento solto que não casa com a busca também sai da lista.
    expect(screen.queryByText("Evento Cancelado")).toBeNull();
  });

  it("pasta vazia selecionada durante a busca avisa que não achou nada ali", () => {
    renderLista();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar evento" }), { target: { value: "encontro" } });
    fireEvent.click(pasta(/^Imersões/));
    expect(screen.getByText("Nenhum evento encontrado nesta pasta.")).not.toBeNull();
  });

  it("busca sem resultado mostra a ação de limpar e a limpeza restaura a lista", () => {
    renderLista();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar evento" }), { target: { value: "zzz" } });
    expect(screen.getByText(/Nenhum evento com “zzz”/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(screen.getByText("Evento Cancelado")).not.toBeNull();
  });

  it("o âmbar marca só os cartões de eventos ativos, nunca finalizados ou cancelados", () => {
    const { container } = render(<EventosLista accountId="conta-1" filters={filtros} />);
    const ativos = filtros.filter((f) => f.status === "ativo").length;
    expect(container.querySelectorAll(".bg-v2-ponto").length).toBe(ativos);
    expect(container.querySelector("[data-testid='evento-card-c1'] .bg-v2-ponto")).toBeNull();
    expect(container.querySelector("[data-testid='evento-card-f1'] .bg-v2-ponto")).toBeNull();
  });
});

describe("MetricasCelulas", () => {
  it("formata leads, CPL e investimento em pt-BR", () => {
    mockReducedMotion(true);
    render(<MetricasCelulas metrics={{ leads: 1234, cpl: 5.5, spend: 6789.1 }} />);
    expect(screen.getByLabelText("1.234")).not.toBeNull();
    expect(screen.getByLabelText(/R\$\s?5,50/)).not.toBeNull();
    expect(screen.getByLabelText(/R\$\s?6\.789,10/)).not.toBeNull();
  });

  it("valor ausente aparece como traço, não como zero", () => {
    render(<MetricasCelulas metrics={{ leads: null, cpl: null, spend: 10 }} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("métricas indisponíveis (null) deixam as três células em traço", () => {
    render(<MetricasCelulas metrics={null} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});

describe("Novo evento na lista", () => {
  it("o cabeçalho tem o botão; clicar abre o assistente e onFechar fecha e devolve o foco", async () => {
    render(<EventosLista accountId="conta-1" filters={filtros} />);
    const botao = screen.getByRole("button", { name: "Novo evento" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(botao);
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.getAttribute("data-conta")).toBe("conta-1");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Fechar assistente" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(botao));
  });
});

describe("estados", () => {
  it("vazio com conta oferece o botão Novo evento e não aponta mais para a versão atual", async () => {
    render(<EventosVazio accountId="conta-1" />);
    expect(screen.getByRole("heading", { name: "Nenhum evento ainda" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Criar evento" })).toBeNull();
    expect(screen.queryByText(/versão atual/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Novo evento" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.getAttribute("data-conta")).toBe("conta-1");
  });

  it("vazio sem conta não mostra o botão e aponta para o cadastro de contas", () => {
    render(<EventosVazio accountId={null} />);
    expect(screen.queryByRole("button", { name: "Novo evento" })).toBeNull();
    expect(screen.getByRole("link", { name: "Cadastrar conta" }).getAttribute("href")).toBe("/v2/ajustes/contas");
  });

  it("erro é um alerta com ação de tentar de novo na mesma rota", () => {
    render(<EventosErro />);
    expect(screen.getByRole("alert")).not.toBeNull();
    expect((screen.getByRole("link", { name: "Tentar de novo" })).getAttribute("href")).toBe("/v2/indicadores/eventos");
  });
});
