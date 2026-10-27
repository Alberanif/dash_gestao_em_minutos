/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TelaDeTestes } from "../indicadores/testes-ab/testes/tela-de-testes";
import { PapelProvider } from "../central-de-links/papel-context";
import type { PapelCentral } from "@/lib/central-de-links/papel";
import type { LinkDaCentral } from "@/lib/central-de-links/tipos";
import type { TesteAb } from "../indicadores/testes-ab/testes/api-testes";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";

const mockLerTudo = jest.fn();
jest.mock("@/lib/central-de-links/dados", () => ({
  __esModule: true,
  lerTudo: (...a: unknown[]) => mockLerTudo(...a),
}));
jest.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ fake: true }) }));

beforeAll(() => {
  mockReducedMotion(false);
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

function link(p: Partial<LinkDaCentral> & Pick<LinkDaCentral, "id" | "label">): LinkDaCentral {
  return {
    url: "https://ex.com/" + p.id,
    grupo: "G",
    tipo: "cap",
    deleted: false,
    slug: null,
    pagina_ativa: false,
    arquivo_path: null,
    arquivo_tam: null,
    arquivado_em: null,
    arquivo_status: "pendente",
    arquivo_erro: null,
    arquivo_tentativa_em: null,
    ...p,
  };
}
const PAGINAS = [
  link({ id: "l1", label: "Captação Alfa" }),
  link({ id: "l2", label: "Captação Beta" }),
  link({ id: "l3", label: "Vendas", tipo: "vnd" }),
  link({ id: "l4", label: "Excluída", deleted: true }),
];

function teste(p: Partial<TesteAb> & Pick<TesteAb, "id" | "nome" | "status">): TesteAb {
  return {
    created_at: "2026-10-01T15:00:00Z",
    iniciado_em: null,
    encerrado_em: null,
    vencedor_variante: null,
    anotacao: null,
    ab_variantes: [
      { id: p.id + "-a", link_id: "l1", rotulo: "A", controle: true, central_links: { label: "Captação Alfa", url: "https://ex.com/l1", tipo: "cap", deleted: false } },
      { id: p.id + "-b", link_id: "l2", rotulo: "B", controle: false, central_links: { label: "Captação Beta", url: "https://ex.com/l2", tipo: "cap", deleted: false } },
    ],
    ...p,
  };
}
const RASC = teste({ id: "t-r", nome: "Teste Rascunho", status: "rascunho" });
const ATIVO = teste({ id: "t-a", nome: "Teste Ativo", status: "ativo", iniciado_em: "2026-10-02T15:00:00Z" });
const ENCER = teste({
  id: "t-e", nome: "Teste Encerrado", status: "encerrado", iniciado_em: "2026-10-02T15:00:00Z",
  encerrado_em: "2026-10-09T15:00:00Z", vencedor_variante: "t-e-b", anotacao: "B ganhou folgado",
});

const resp = (status: number, corpo: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response;
const fetchMock = jest.fn();
const fetchOriginal = global.fetch;
let lista: TesteAb[];

beforeEach(() => {
  lista = [RASC, ATIVO, ENCER];
  mockLerTudo.mockReset();
  mockLerTudo.mockResolvedValue({ links: PAGINAS, grupos: [], pastas: [] });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/t.js") return { ok: true, status: 200, text: async () => "\n  /* rastreador */ var x=1;\n\n" } as unknown as Response;
    const corpo = JSON.parse((init?.body as string) ?? "{}");
    if (corpo.acao === "listar") return resp(200, { testes: lista });
    return resp(200, { teste: RASC, ok: true });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);
afterAll(() => {
  global.fetch = fetchOriginal;
});

async function montar(papel: PapelCentral | null) {
  render(
    <V2Root>
      <PapelProvider papel={papel}>
        <TelaDeTestes />
      </PapelProvider>
    </V2Root>,
  );
  await screen.findByText("Teste Rascunho");
}
const cartao = (nome: string) => screen.getByRole("heading", { name: nome }).closest("[data-testid=teste]") as HTMLElement;
const chamadasApi = () =>
  fetchMock.mock.calls.filter((c) => c[0] !== "/t.js").map((c) => ({ url: c[0] as string, init: c[1] as RequestInit, corpo: JSON.parse(c[1].body as string) }));
const acoesEnviadas = () => chamadasApi().map((c) => c.corpo.acao);

describe("lista", () => {
  it("mostra nome, estado, variantes com controle, datas e vencedor", async () => {
    await montar("membro");
    expect(within(cartao("Teste Rascunho")).getByText("Rascunho")).toBeTruthy();
    expect(within(cartao("Teste Ativo")).getByText("Ativo")).toBeTruthy();
    const enc = cartao("Teste Encerrado");
    expect(within(enc).getByText("Encerrado")).toBeTruthy();
    expect(within(enc).getByText("Vencedor: variante B")).toBeTruthy();
    expect(within(enc).getByText("B ganhou folgado")).toBeTruthy();
    expect(within(enc).getByText(/Encerrado em 09\/10\/2026/)).toBeTruthy();
    expect(within(enc).getByText("Controle")).toBeTruthy();
    expect(within(enc).getByText("Captação Alfa")).toBeTruthy();
  });

  it("teste encerrado sem vencedor aparece como sem diferença", async () => {
    lista = [{ ...ENCER, vencedor_variante: null }, RASC];
    await montar("membro");
    expect(within(cartao("Teste Encerrado")).getByText("Sem diferença")).toBeTruthy();
  });

  it("lista usa a ação listar da API", async () => {
    await montar("membro");
    expect(chamadasApi()[0].url).toBe("/api/central-de-links/ab-testes");
    expect(chamadasApi()[0].corpo).toEqual({ acao: "listar" });
  });

  it("erro 403 vem na chave error (sem erro) e a mensagem não se perde", async () => {
    fetchMock.mockResolvedValue(resp(403, { error: "Forbidden" }));
    render(
      <V2Root>
        <PapelProvider papel="membro">
          <TelaDeTestes />
        </PapelProvider>
      </V2Root>,
    );
    expect(await screen.findByText("Forbidden")).toBeTruthy();
  });

  it("mostra o erro da API ao falhar a carga", async () => {
    fetchMock.mockResolvedValue(resp(500, { erro: "Erro ao acessar o banco de dados." }));
    render(
      <V2Root>
        <PapelProvider papel="membro">
          <TelaDeTestes />
        </PapelProvider>
      </V2Root>,
    );
    expect(await screen.findByText("Erro ao acessar o banco de dados.")).toBeTruthy();
  });
});

describe("membro", () => {
  it("só lê: sem botões de escrita, com Ver resultado apontando para a rota do bloco 5", async () => {
    await montar("membro");
    for (const nome of ["Novo teste", "Editar", "Iniciar", "Encerrar", "Excluir"]) {
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
    }
    const ver = within(cartao("Teste Ativo")).getByRole("link", { name: "Ver resultado" });
    expect(ver.getAttribute("href")).toBe("/v2/indicadores/testes-ab/t-a");
    expect(mockLerTudo).not.toHaveBeenCalled();
  });
});

describe("admin", () => {
  it("vê os botões certos por estado", async () => {
    await montar("admin");
    expect(screen.getByRole("button", { name: "Novo teste" })).toBeTruthy();
    const r = within(cartao("Teste Rascunho"));
    expect(r.getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(r.getByRole("button", { name: "Iniciar" })).toBeTruthy();
    expect(r.getByRole("button", { name: "Excluir" })).toBeTruthy();
    expect(r.queryByRole("button", { name: "Encerrar" })).toBeNull();
    const a = within(cartao("Teste Ativo"));
    expect(a.getByRole("button", { name: "Encerrar" })).toBeTruthy();
    expect(a.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(a.queryByRole("button", { name: "Excluir" })).toBeNull();
    const e = within(cartao("Teste Encerrado"));
    expect(e.getByRole("button", { name: "Excluir" })).toBeTruthy();
    expect(e.queryByRole("button", { name: "Editar" })).toBeNull();
  });

  it("cria: envia nome e variantes e recarrega a lista", async () => {
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: "Novo teste" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome do teste"), { target: { value: "  Meu teste  " } });
    for (const [i, pagina] of [[1, "Captação Alfa"], [2, "Captação Beta"]] as const) {
      fireEvent.keyDown(within(dlg).getByRole("combobox", { name: `Página da variante ${i}` }), { key: "Enter" });
      const opcoes = await screen.findAllByRole("option");
      // só links cap e não excluídos
      expect(opcoes.map((o) => o.textContent)).toEqual(["Captação Alfa", "Captação Beta"]);
      fireEvent.click(screen.getByRole("option", { name: pagina }));
    }
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(acoesEnviadas()).toContain("criar"));
    const criar = chamadasApi().find((c) => c.corpo.acao === "criar")!;
    expect(criar.init.method).toBe("POST");
    expect(criar.corpo).toEqual({
      acao: "criar",
      nome: "Meu teste",
      variantes: [
        { link_id: "l1", rotulo: "A", controle: true },
        { link_id: "l2", rotulo: "B", controle: false },
      ],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(acoesEnviadas().filter((a) => a === "listar").length).toBe(2);
  });

  it("erro da API aparece inline no modal e o modal continua aberto", async () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => {
      const c = JSON.parse(init?.body as string);
      return c.acao === "listar" ? resp(200, { testes: lista }) : resp(409, { erro: "A página já está em um teste ativo." });
    });
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: "Novo teste" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    expect(await within(dlg).findByText("A página já está em um teste ativo.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("variantes: mínimo 2, máximo 8 e um único controle", async () => {
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: "Novo teste" }));
    const dlg = await screen.findByRole("dialog");
    expect((within(dlg).getByRole("button", { name: "Remover variante 1" }) as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 6; i++) fireEvent.click(within(dlg).getByRole("button", { name: "Adicionar variante" }));
    expect(within(dlg).getAllByTestId("variante")).toHaveLength(8);
    expect((within(dlg).getByRole("button", { name: "Adicionar variante" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dlg).getByLabelText("Controle: variante 3"));
    expect((within(dlg).getByLabelText("Controle: variante 3") as HTMLInputElement).checked).toBe(true);
    expect((within(dlg).getByLabelText("Controle: variante 1") as HTMLInputElement).checked).toBe(false);
    // remover o controle passa o controle para a primeira
    fireEvent.click(within(dlg).getByRole("button", { name: "Remover variante 3" }));
    expect(within(dlg).getAllByTestId("variante")).toHaveLength(7);
    expect((within(dlg).getByLabelText("Controle: variante 1") as HTMLInputElement).checked).toBe(true);
  });

  it("edita rascunho: abre com os dados atuais e envia editar com o id", async () => {
    await montar("admin");
    fireEvent.click(within(cartao("Teste Rascunho")).getByRole("button", { name: "Editar" }));
    const dlg = await screen.findByRole("dialog");
    expect((within(dlg).getByLabelText("Nome do teste") as HTMLInputElement).value).toBe("Teste Rascunho");
    expect((within(dlg).getByLabelText("Rótulo da variante 2") as HTMLInputElement).value).toBe("B");
    fireEvent.change(within(dlg).getByLabelText("Nome do teste"), { target: { value: "Novo nome" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(acoesEnviadas()).toContain("editar"));
    const ed = chamadasApi().find((c) => c.corpo.acao === "editar")!;
    expect(ed.corpo).toEqual({
      acao: "editar",
      id: "t-r",
      nome: "Novo nome",
      variantes: [
        { link_id: "l1", rotulo: "A", controle: true },
        { link_id: "l2", rotulo: "B", controle: false },
      ],
    });
  });

  it("inicia o teste", async () => {
    await montar("admin");
    fireEvent.click(within(cartao("Teste Rascunho")).getByRole("button", { name: "Iniciar" }));
    await waitFor(() => expect(acoesEnviadas()).toContain("iniciar"));
    expect(chamadasApi().find((c) => c.corpo.acao === "iniciar")!.corpo).toEqual({ acao: "iniciar", id: "t-r" });
  });

  it("erro ao iniciar aparece na tela", async () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => {
      const c = JSON.parse(init?.body as string);
      return c.acao === "listar" ? resp(200, { testes: lista }) : resp(409, { erro: "Esta página já está em outro teste ativo." });
    });
    await montar("admin");
    fireEvent.click(within(cartao("Teste Rascunho")).getByRole("button", { name: "Iniciar" }));
    expect(await screen.findByText("Esta página já está em outro teste ativo.")).toBeTruthy();
  });

  it("encerra com vencedor e anotação", async () => {
    await montar("admin");
    fireEvent.click(within(cartao("Teste Ativo")).getByRole("button", { name: "Encerrar" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByLabelText(/Variante B/));
    fireEvent.change(within(dlg).getByLabelText(/Anotação/), { target: { value: " B converteu mais " } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Encerrar teste" }));
    await waitFor(() => expect(acoesEnviadas()).toContain("encerrar"));
    expect(chamadasApi().find((c) => c.corpo.acao === "encerrar")!.corpo).toEqual({
      acao: "encerrar",
      id: "t-a",
      vencedor_variante: "t-a-b",
      anotacao: "B converteu mais",
    });
  });

  it("encerra como sem diferença (vencedor vazio)", async () => {
    await montar("admin");
    fireEvent.click(within(cartao("Teste Ativo")).getByRole("button", { name: "Encerrar" }));
    const dlg = await screen.findByRole("dialog");
    expect((within(dlg).getByLabelText("Sem diferença") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(dlg).getByRole("button", { name: "Encerrar teste" }));
    await waitFor(() => expect(acoesEnviadas()).toContain("encerrar"));
    expect(chamadasApi().find((c) => c.corpo.acao === "encerrar")!.corpo).toEqual({
      acao: "encerrar",
      id: "t-a",
      vencedor_variante: null,
      anotacao: "",
    });
  });

  it("excluir rascunho pede confirmação e só então chama a API (sem confirmar:true)", async () => {
    await montar("admin");
    fireEvent.click(within(cartao("Teste Rascunho")).getByRole("button", { name: "Excluir" }));
    const dlg = await screen.findByRole("dialog");
    expect(acoesEnviadas()).not.toContain("excluir");
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(acoesEnviadas()).toContain("excluir"));
    expect(chamadasApi().find((c) => c.corpo.acao === "excluir")!.corpo).toEqual({ acao: "excluir", id: "t-r", confirmar: false });
  });

  it("excluir encerrado avisa do histórico e envia confirmar:true", async () => {
    await montar("admin");
    fireEvent.click(within(cartao("Teste Encerrado")).getByRole("button", { name: "Excluir" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText(/apaga todo o histórico/)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(acoesEnviadas()).toContain("excluir"));
    expect(chamadasApi().find((c) => c.corpo.acao === "excluir")!.corpo).toEqual({ acao: "excluir", id: "t-e", confirmar: true });
  });

  it("cancelar a confirmação não exclui", async () => {
    await montar("admin");
    fireEvent.click(within(cartao("Teste Rascunho")).getByRole("button", { name: "Excluir" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(acoesEnviadas()).not.toContain("excluir");
  });
});

describe("Como instalar", () => {
  it("mostra o aviso do domínio com o origin e os snippets", async () => {
    await montar("membro");
    fireEvent.click(screen.getByRole("button", { name: "Como instalar" }));
    const dlg = await screen.findByRole("dialog");
    const origem = window.location.origin;
    expect(
      within(dlg).getByText(`O endereço do snippet é o deste domínio (${origem}). Se o painel mudar de endereço, reinstale o snippet nas páginas.`),
    ).toBeTruthy();
    expect(dlg.querySelector("#snippet-externo")!.textContent).toBe(`<script src="${origem}/t.js" async></script>`);
    await waitFor(() => expect(dlg.querySelector("#snippet-inline")!.textContent).toContain("/* rastreador */ var x=1;"));
    expect(dlg.querySelector("#snippet-inline")!.textContent).toBe(`<script data-origem="${origem}">\n/* rastreador */ var x=1;\n</script>`);
    expect(dlg.querySelector("#snippet-form")!.textContent).toContain("data-ab-form");
  });

  it("copia o snippet do arquivo hospedado", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await montar("membro");
    fireEvent.click(screen.getByRole("button", { name: "Como instalar" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Copiar opção 1" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`<script src="${window.location.origin}/t.js" async></script>`));
    expect(await within(dlg).findByText("Código copiado.")).toBeTruthy();
  });

  it("falha ao carregar o t.js mostra mensagem no bloco inline", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/t.js") return { ok: false, status: 500, text: async () => "" } as unknown as Response;
      return resp(200, { testes: lista });
    });
    await montar("membro");
    fireEvent.click(screen.getByRole("button", { name: "Como instalar" }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Não consegui carregar o bloco completo. Tente de novo.")).toBeTruthy();
  });
});
