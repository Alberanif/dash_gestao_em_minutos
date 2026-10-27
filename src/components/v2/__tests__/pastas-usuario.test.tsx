/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { FilterRecord, FilterStatus } from "@/types/indicadores";
import { EventosLista } from "../eventos/eventos-lista";
import { colunasDaFileira } from "../eventos/pastas";
import {
  LIMITE_PASTAS,
  PALETA,
  erroDoNomePasta,
  normalizarNomePasta,
  type AcoesPastas,
} from "../eventos/pastas-regras";
import { carregarPastasUsuario, tabelaAusente, type PastaUsuario } from "../eventos/pastas-servidor";
import { mockReducedMotion } from "./helpers";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

beforeEach(() => mockReducedMotion(true));

function evento(id: string, name: string, status: FilterStatus): FilterRecord {
  return {
    id,
    account_id: "acc",
    name,
    hotmart_products: [{ product_id: "1", product_name: "P" }],
    meta_ads_terms: ["PC"],
    captacao_leads_eventos: [],
    is_organic: false,
    status,
    status_changed_at: null,
    created_at: "2026-06-01T15:00:00Z",
    updated_at: "2026-07-02T15:00:00Z",
  };
}

const filtros = [evento("a1", "Imersão Alfa", "ativo"), evento("f1", "Encontro 2025", "finalizado"), evento("c1", "Evento Cancelado", "cancelado")];

const imersoes: PastaUsuario = { id: "p1", nome: "Imersões", cor: "violeta", eventoIds: ["a1", "f1"] };

function acoesFalsas(): jest.Mocked<AcoesPastas> {
  return {
    criar: jest.fn().mockResolvedValue({ ok: true, id: "novo" }),
    atualizar: jest.fn().mockResolvedValue({ ok: true }),
    excluir: jest.fn().mockResolvedValue({ ok: true }),
    definirPastasDoEvento: jest.fn().mockResolvedValue({ ok: true }),
  };
}

function renderLista(pastas: PastaUsuario[] = [], acoes = acoesFalsas(), disponivel = true) {
  render(<EventosLista accountId="conta-1" filters={filtros} pastasUsuario={pastas} pastasDisponiveis={disponivel} acoes={acoes} />);
  return acoes;
}

/** Abre o menu de três pontos do cartão e entra em "Adicionar a uma pasta". */
function abrirPastas(cartao: ReturnType<typeof within>, nome: string) {
  fireEvent.click(cartao.getByRole("button", { name: `Opções de ${nome}` }));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar a uma pasta" }));
}

describe("regras das pastas", () => {
  it("o nome perde espaços sobrando e precisa ter de 1 a 30 caracteres", () => {
    expect(normalizarNomePasta("  Imersões   2026 ")).toBe("Imersões 2026");
    expect(erroDoNomePasta("   ", [])).toBe("Dê um nome à pasta.");
    expect(erroDoNomePasta("a".repeat(31), [])).toBe("Use até 30 caracteres.");
    expect(erroDoNomePasta("a".repeat(30), [])).toBeNull();
  });

  it("nome repetido é barrado sem diferenciar maiúsculas nem espaços", () => {
    expect(erroDoNomePasta(" imersões ", ["Imersões"])).toBe("Já existe uma pasta com esse nome.");
    expect(erroDoNomePasta("Parceiros", ["Imersões"])).toBeNull();
  });

  it("a paleta tem 8 cores e nenhuma é o âmbar do dado vivo", () => {
    expect(PALETA).toHaveLength(8);
    expect(PALETA.map((c) => c.hex.toLowerCase())).not.toContain("#fbac00");
  });
});

describe("colunasDaFileira", () => {
  it("com a fileira cheia, a aberta vai para o meio e as outras seguem na ordem", () => {
    expect(colunasDaFileira(["a", "b", "c"], "a")).toEqual([1, 0, 2]);
    expect(colunasDaFileira(["a", "b", "c"], "b")).toEqual([0, 1, 2]);
    expect(colunasDaFileira(["a", "b", "c"], "c")).toEqual([0, 2, 1]);
  });

  it("fileira incompleta ou sem pasta aberta nela não desliza", () => {
    expect(colunasDaFileira(["a", "b"], "a")).toEqual([0, 1]);
    expect(colunasDaFileira(["a", "b", "c"], "z")).toEqual([0, 1, 2]);
    expect(colunasDaFileira(["a", "b", "c"], null)).toEqual([0, 1, 2]);
  });
});

describe("carregarPastasUsuario", () => {
  function banco(respostas: Record<string, { data?: unknown; error?: unknown }>) {
    return {
      from: (tabela: string) => {
        const r = respostas[tabela] ?? { data: [] };
        const cadeia: Record<string, unknown> = {};
        for (const m of ["select", "eq", "in", "order"]) cadeia[m] = () => cadeia;
        cadeia.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(ok);
        return cadeia;
      },
    };
  }

  it("junta cada pasta com os eventos dela", async () => {
    const r = await carregarPastasUsuario(
      banco({
        dash_gestao_event_folders: { data: [{ id: "p1", name: "Imersões", color: "violeta" }, { id: "p2", name: "Vazia", color: "cor-estranha" }] },
        dash_gestao_event_folder_items: { data: [{ folder_id: "p1", filter_id: "a1" }, { folder_id: "p1", filter_id: "f1" }] },
      }),
      "acc",
    );
    expect(r.disponivel).toBe(true);
    expect(r.pastas).toEqual([
      { id: "p1", nome: "Imersões", cor: "violeta", eventoIds: ["a1", "f1"] },
      { id: "p2", nome: "Vazia", cor: "azul", eventoIds: [] },
    ]);
  });

  it("sem a migration (tabela ausente) volta indisponível, sem lançar nem poluir o log", async () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const r = await carregarPastasUsuario(
      banco({ dash_gestao_event_folders: { error: { code: "42P01", message: 'relation "x" does not exist' } } }),
      "acc",
    );
    expect(r).toEqual({ disponivel: false, pastas: [] });
    expect(erro).not.toHaveBeenCalled();
    expect(tabelaAusente({ code: "PGRST205" })).toBe(true);
    expect(tabelaAusente({ code: "500", message: "timeout" })).toBe(false);
    erro.mockRestore();
  });
});

describe("EventosLista com pastas do usuário", () => {
  it("sem a migration aplicada não aparece a casa de nova pasta nem o menu dos cartões", () => {
    renderLista([], acoesFalsas(), false);
    expect(screen.queryByRole("button", { name: /Nova pasta/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pastas de/ })).toBeNull();
    // Sem pastas, todos os eventos ficam à mostra numa lista só.
    for (const f of filtros) expect(screen.getByText(f.name)).not.toBeNull();
  });

  it("só existem as pastas do usuário, com a casa de nova pasta no fim", () => {
    renderLista([imersoes]);
    const botoes = screen.getAllByRole("button").filter((b) => b.classList.contains("v2-pasta") || b.classList.contains("v2-pasta-nova"));
    expect(botoes.map((b) => b.textContent)).toEqual([expect.stringContaining("Imersões"), expect.stringContaining("Nova pasta")]);
    expect(within(screen.getByRole("button", { name: /^Imersões/ })).getByText("2 eventos")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Eventos (ativos|finalizados|cancelados)/ })).toBeNull();
  });

  it("a pasta do usuário usa a cor escolhida", () => {
    renderLista([imersoes]);
    expect(screen.getByRole("button", { name: /^Imersões/ }).style.getPropertyValue("--pc")).toBe("#7b6fe0");
  });

  it("abrir a pasta do usuário mostra os eventos dela, com o status de cada evento no cartão", () => {
    renderLista([imersoes]);
    fireEvent.click(screen.getByRole("button", { name: /^Imersões/ }));
    expect(screen.getByRole("region", { name: "Imersões" })).not.toBeNull();
    // A pasta anterior ainda está saindo (e escondida): os cartões vistos são só os da pasta nova.
    const regiao = within(screen.getByRole("region", { name: "Imersões" }));
    expect(within(regiao.getByTestId("evento-card-a1")).getByText("Ativo")).not.toBeNull();
    expect(within(regiao.getByTestId("evento-card-f1")).getByText("Finalizado")).not.toBeNull();
    expect(regiao.queryByTestId("evento-card-c1")).toBeNull();
  });

  it("o painel abre logo abaixo da fileira da pasta aberta", () => {
    const vazia = (id: string): PastaUsuario => ({ id, nome: `Pasta ${id}`, cor: "azul", eventoIds: [] });
    renderLista([vazia("x1"), vazia("x2"), vazia("x3"), imersoes]);
    const fila = (el: HTMLElement) => el.style.getPropertyValue("--fila");
    fireEvent.click(screen.getByRole("button", { name: /^Pasta x1/ }));
    expect(fila(screen.getByRole("region", { name: "Pasta x1" }))).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: /^Imersões/ }));
    // Quarta casa: segunda fileira.
    expect(fila(screen.getByRole("region", { name: "Imersões" }))).toBe("1");
    expect(fila(screen.getByRole("button", { name: /^Imersões/ }).closest("[data-slot-pasta]") as HTMLElement)).toBe("1");
  });

  it("pasta vazia explica como colocar eventos nela", () => {
    renderLista([{ id: "p2", nome: "Vazia", cor: "azul", eventoIds: [] }]);
    fireEvent.click(screen.getByRole("button", { name: /^Vazia/ }));
    expect(screen.getByText(/Use o botão de pastas no cartão/)).not.toBeNull();
  });

  it("a busca também abre pasta do usuário quando é onde há mais resultados", async () => {
    renderLista([{ id: "p3", nome: "Parceiros", cor: "rosa", eventoIds: ["a1", "f1", "c1"] }]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar evento" }), { target: { value: "e" } });
    // "e" casa nos três eventos, todos em Parceiros.
    await waitFor(() => expect(screen.getByRole("button", { name: /^Parceiros/ }).getAttribute("aria-expanded")).toBe("true"));
  });

  it("criar: o diálogo pede nome, valida e chama a ação com a cor escolhida", async () => {
    const acoes = renderLista();
    fireEvent.click(screen.getByRole("button", { name: /Nova pasta/ }));
    const dialogo = await screen.findByRole("dialog");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Criar pasta" }));
    expect(within(dialogo).getByText("Dê um nome à pasta.")).not.toBeNull();
    expect(acoes.criar).not.toHaveBeenCalled();

    fireEvent.change(within(dialogo).getByLabelText("Nome da pasta"), { target: { value: "  Parceiros " } });
    fireEvent.click(within(dialogo).getByRole("radio", { name: "Coral" }));
    await act(async () => {
      fireEvent.click(within(dialogo).getByRole("button", { name: "Criar pasta" }));
    });
    expect(acoes.criar).toHaveBeenCalledWith("Parceiros", "coral");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("criar: a cor padrão é o azul e o erro do servidor aparece no diálogo", async () => {
    const acoes = acoesFalsas();
    acoes.criar.mockResolvedValue({ ok: false, erro: "Não foi possível salvar agora. Tente de novo." });
    renderLista([], acoes);
    fireEvent.click(screen.getByRole("button", { name: /Nova pasta/ }));
    const dialogo = await screen.findByRole("dialog");
    expect((within(dialogo).getByRole("radio", { name: "Azul" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(within(dialogo).getByLabelText("Nome da pasta"), { target: { value: "Teste" } });
    await act(async () => {
      fireEvent.click(within(dialogo).getByRole("button", { name: "Criar pasta" }));
    });
    expect(within(dialogo).getByRole("alert").textContent).toContain("Não foi possível salvar");
    expect(screen.getByRole("dialog")).not.toBeNull();
  });

  it("criar: nome repetido é barrado no cliente", async () => {
    const acoes = renderLista([imersoes]);
    fireEvent.click(screen.getByRole("button", { name: /Nova pasta/ }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("Nome da pasta"), { target: { value: "imersões" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Criar pasta" }));
    expect(within(dialogo).getByText("Já existe uma pasta com esse nome.")).not.toBeNull();
    expect(acoes.criar).not.toHaveBeenCalled();
  });

  it("no limite de pastas a casa de nova pasta fica desabilitada", () => {
    const muitas: PastaUsuario[] = Array.from({ length: LIMITE_PASTAS }, (_, i) => ({ id: `p${i}`, nome: `Pasta ${i}`, cor: "azul", eventoIds: [] }));
    renderLista(muitas);
    expect((screen.getByRole("button", { name: /Nova pasta/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("editar: o diálogo vem preenchido e salva nome e cor", async () => {
    const acoes = renderLista([imersoes]);
    fireEvent.click(screen.getByRole("button", { name: "Opções da pasta Imersões" }));
    fireEvent.click(await screen.findByRole("button", { name: "Renomear ou mudar cor" }));
    const dialogo = await screen.findByRole("dialog");
    expect((within(dialogo).getByLabelText("Nome da pasta") as HTMLInputElement).value).toBe("Imersões");
    expect((within(dialogo).getByRole("radio", { name: "Violeta" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(within(dialogo).getByLabelText("Nome da pasta"), { target: { value: "Imersões 2026" } });
    fireEvent.click(within(dialogo).getByRole("radio", { name: "Verde" }));
    await act(async () => {
      fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    });
    expect(acoes.atualizar).toHaveBeenCalledWith("p1", "Imersões 2026", "verde");
  });

  it("excluir: pede confirmação e avisa que os eventos voltam para a lista sem pasta", async () => {
    const acoes = renderLista([imersoes]);
    fireEvent.click(screen.getByRole("button", { name: "Opções da pasta Imersões" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir pasta" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/Os 2 eventos voltam para a lista sem pasta/)).not.toBeNull();
    expect(acoes.excluir).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir pasta" }));
    });
    expect(acoes.excluir).toHaveBeenCalledWith("p1");
  });

  it("cada pasta tem o seu menu de opções", () => {
    renderLista([imersoes]);
    expect(screen.getAllByRole("button", { name: /Opções da pasta/ })).toHaveLength(1);
  });

  it("o menu do cartão põe o evento em uma pasta só: escolher outra troca", async () => {
    const acoes = renderLista([imersoes, { id: "p2", nome: "Parceiros", cor: "rosa", eventoIds: [] }]);
    fireEvent.click(screen.getByRole("button", { name: /^Imersões/ }));
    abrirPastas(within(screen.getByTestId("evento-card-a1")), "Imersão Alfa");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect((await screen.findByRole("radio", { name: /Imersões/ })).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Parceiros/ }).getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: /Parceiros/ }));
    });
    // Substitui: manda só a pasta nova, nunca as duas.
    expect(acoes.definirPastasDoEvento).toHaveBeenLastCalledWith("a1", ["p2"]);
  });

  it("evento em pasta deixa de aparecer na lista sem pasta; só o que está fora de pastas fica lá", () => {
    renderLista([imersoes]);
    // a1 e f1 estão em Imersões: só o c1 sobra na lista sem pasta.
    expect(screen.getByRole("button", { name: /^Imersões/ }).textContent).toContain("2 eventos");
    const soltos = within(screen.getByRole("region", { name: "Eventos sem pasta" }));
    expect(soltos.getByTestId("evento-card-c1")).not.toBeNull();
    expect(screen.queryByTestId("evento-card-a1")).toBeNull();
    expect(screen.queryByTestId("evento-card-f1")).toBeNull();
  });

  it("colocar um evento solto numa pasta: ele se despede da lista sem pasta e passa a contar na pasta", async () => {
    const acoes = acoesFalsas();
    acoes.definirPastasDoEvento.mockReturnValue(new Promise(() => {}));
    renderLista([imersoes], acoes);
    const soltos = screen.getByRole("region", { name: "Eventos sem pasta" });
    abrirPastas(within(within(soltos).getByTestId("evento-card-c1")), "Evento Cancelado");
    await act(async () => {
      fireEvent.click(await screen.findByRole("radio", { name: /Imersões/ }));
    });

    expect(acoes.definirPastasDoEvento).toHaveBeenCalledWith("c1", ["p1"]);
    expect(within(soltos).getByTestId("evento-card-c1").closest("li")?.hasAttribute("data-movido")).toBe(true);
    expect(screen.getByRole("button", { name: /^Imersões/ }).textContent).toContain("3 eventos");
    // Era o último solto: depois da despedida a seção some.
    await waitFor(() => expect(screen.queryByRole("region", { name: "Eventos sem pasta" })).toBeNull());
  });

  it("tirar o evento da pasta devolve ele à lista sem pasta", async () => {
    renderLista([imersoes]);
    fireEvent.click(screen.getByRole("button", { name: /^Imersões/ }));
    abrirPastas(within(within(screen.getByRole("region", { name: "Imersões" })).getByTestId("evento-card-a1")), "Imersão Alfa");
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Remover desta pasta" }));
    });
    const soltos = within(screen.getByRole("region", { name: "Eventos sem pasta" }));
    expect(soltos.getByTestId("evento-card-a1")).not.toBeNull();
  });

  it("dentro da pasta do usuário o cartão ganha 'Remover desta pasta'", async () => {
    const acoes = renderLista([imersoes]);
    fireEvent.click(screen.getByRole("button", { name: /^Imersões/ }));
    abrirPastas(within(within(screen.getByRole("region", { name: "Imersões" })).getByTestId("evento-card-a1")), "Imersão Alfa");
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Remover desta pasta" }));
    });
    expect(acoes.definirPastasDoEvento).toHaveBeenCalledWith("a1", []);
  });

  it("ao mover o evento, ele se despede da pasta antiga na hora e passa a contar na nova", async () => {
    const acoes = acoesFalsas();
    // A gravação demora: a tela não pode esperar o servidor para tirar o cartão da pasta antiga.
    acoes.definirPastasDoEvento.mockReturnValue(new Promise(() => {}));
    renderLista([imersoes, { id: "p2", nome: "Parceiros", cor: "rosa", eventoIds: [] }], acoes);
    fireEvent.click(screen.getByRole("button", { name: /^Imersões/ }));
    const regiao = screen.getByRole("region", { name: "Imersões" });
    abrirPastas(within(within(regiao).getByTestId("evento-card-a1")), "Imersão Alfa");
    await act(async () => {
      fireEvent.click(await screen.findByRole("radio", { name: /Parceiros/ }));
    });

    expect(within(regiao).getByTestId("evento-card-a1").closest("li")?.hasAttribute("data-movido")).toBe(true);
    expect(screen.getByRole("button", { name: /^Parceiros/ }).textContent).toContain("1 evento");
    expect(screen.getByRole("button", { name: /^Imersões/ }).textContent).toContain("1 evento");
    await waitFor(() => expect(within(regiao).queryByTestId("evento-card-a1")).toBeNull());
    expect(within(regiao).getByTestId("evento-card-f1")).not.toBeNull();
  });

  it("sem pastas do usuário o menu do cartão manda criar uma", async () => {
    renderLista([]);
    abrirPastas(within(screen.getByTestId("evento-card-a1")), "Imersão Alfa");
    expect(await screen.findByText(/Você ainda não tem pastas/)).not.toBeNull();
  });
});
