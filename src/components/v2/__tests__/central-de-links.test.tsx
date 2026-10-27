/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TelaDeLinks } from "../central-de-links/tela-de-links";
import { PapelProvider } from "../central-de-links/papel-context";
import { estadoDoArquivo } from "../central-de-links/estado-arquivo";
import type { PapelCentral } from "@/lib/central-de-links/papel";
import type { GrupoDaCentral, LinkDaCentral } from "@/lib/central-de-links/tipos";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";

const mockDados = {
  lerTudo: jest.fn(),
  salvarLink: jest.fn(),
  excluirLink: jest.fn(),
  criarGrupo: jest.fn(),
  excluirGrupo: jest.fn(),
  reordenarGrupos: jest.fn(),
  renomearPasta: jest.fn(),
  definirCorDaPasta: jest.fn(),
  urlsDeMiniaturas: jest.fn(),
  enviarArquivo: jest.fn(),
  removerArquivo: jest.fn(),
  baixarCopia: jest.fn(),
  definirPaginaAtiva: jest.fn(),
  lerLink: jest.fn(),
};
jest.mock("@/lib/central-de-links/dados", () => ({
  __esModule: true,
  enviarArquivo: (...a: unknown[]) => mockDados.enviarArquivo(...a),
  removerArquivo: (...a: unknown[]) => mockDados.removerArquivo(...a),
  baixarCopia: (...a: unknown[]) => mockDados.baixarCopia(...a),
  definirPaginaAtiva: (...a: unknown[]) => mockDados.definirPaginaAtiva(...a),
  lerLink: (...a: unknown[]) => mockDados.lerLink(...a),
  lerTudo: (...a: unknown[]) => mockDados.lerTudo(...a),
  salvarLink: (...a: unknown[]) => mockDados.salvarLink(...a),
  excluirLink: (...a: unknown[]) => mockDados.excluirLink(...a),
  criarGrupo: (...a: unknown[]) => mockDados.criarGrupo(...a),
  excluirGrupo: (...a: unknown[]) => mockDados.excluirGrupo(...a),
  reordenarGrupos: (...a: unknown[]) => mockDados.reordenarGrupos(...a),
  renomearPasta: (...a: unknown[]) => mockDados.renomearPasta(...a),
  definirCorDaPasta: (...a: unknown[]) => mockDados.definirCorDaPasta(...a),
  urlsDeMiniaturas: (...a: unknown[]) => mockDados.urlsDeMiniaturas(...a),
}));
jest.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ fake: true }) }));

beforeAll(() => {
  mockReducedMotion(false);
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

function link(p: Partial<LinkDaCentral> & Pick<LinkDaCentral, "id" | "label" | "url" | "grupo">): LinkDaCentral {
  return {
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
    miniatura_path: null,
    ...p,
  };
}

const LINKS: LinkDaCentral[] = [
  link({ id: "1", label: "Captação Outubro", url: "https://ex.com/cap", grupo: "Lançamento" }),
  link({ id: "2", label: "Vendas Outubro", url: "https://ex.com/vendas", grupo: "Lançamento", tipo: "vnd" }),
  link({ id: "3", label: "Aula Aberta", url: "https://ex.com/aula", grupo: "Perpétuo", tipo: "aula" }),
  link({ id: "4", label: "Solto", url: "https://outro.com/x", grupo: "Avulsos", tipo: "outro" }),
];
// Cada grupo é uma pasta. O campo `pasta` é o antigo e a V2 só o preserva.
const GRUPOS: GrupoDaCentral[] = [
  { nome: "Lançamento", position: 0, pasta: "2026", cor: "rosa" },
  { nome: "Perpétuo", position: 1, pasta: "2026", cor: null },
  { nome: "Avulsos", position: 2, pasta: null, cor: "verde" },
];

beforeEach(() => {
  Object.values(mockDados).forEach((f) => f.mockReset());
  // link novo dispara o arquivamento automático; o servidor não é o assunto destes testes
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }) as unknown as typeof fetch;
  mockDados.lerLink.mockResolvedValue(null);
  mockDados.lerTudo.mockResolvedValue({ links: LINKS, grupos: GRUPOS, pastas: [] });
  mockDados.urlsDeMiniaturas.mockResolvedValue({});
  mockDados.salvarLink.mockResolvedValue("id-salvo");
  mockDados.enviarArquivo.mockResolvedValue({ arquivo_path: "paginas/id-salvo.html", arquivo_tam: 10, arquivado_em: "2026-10-01T00:00:00Z" });
  mockDados.baixarCopia.mockResolvedValue("<html><body>cópia</body></html>");
  [mockDados.excluirLink, mockDados.removerArquivo, mockDados.definirPaginaAtiva, mockDados.criarGrupo, mockDados.excluirGrupo,
    mockDados.reordenarGrupos, mockDados.renomearPasta, mockDados.definirCorDaPasta,
  ].forEach((f) => f.mockResolvedValue(undefined));
});

async function montar(papel: PapelCentral | null) {
  render(
    <V2Root>
      <PapelProvider papel={papel}>
        <TelaDeLinks />
      </PapelProvider>
    </V2Root>,
  );
  await screen.findByRole("main", { name: "Pastas" });
}

/** O botão da pasta (nome acessível: "Nome N links"). */
const pasta = (nome: string) => screen.getByRole("button", { name: new RegExp(`^${nome}\\s`) });

/** Abre a pasta e devolve o painel com os cartões. */
function abrir(nome: string) {
  fireEvent.click(pasta(nome));
  return screen.getByRole("region", { name: nome });
}

const cartaoDe = (nome: string) => screen.getByRole("link", { name: `Abrir ${nome}` }).closest("[data-testid=cartao-de-link]") as HTMLElement;

describe("Central de links: papel", () => {
  it("membro não vê nenhum botão de escrita", async () => {
    await montar("membro");
    abrir("Lançamento");
    for (const nome of [/^\+ Link$/, /^\+ Pasta$/, /^Editar /, /^Excluir /, /^Opções da pasta/]) {
      expect(screen.queryAllByRole("button", { name: nome })).toHaveLength(0);
    }
    // mas lê: copiar e abrir continuam
    expect(screen.getAllByRole("button", { name: /^Copiar link de / }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Abrir Captação Outubro" })).toBeTruthy();
  });

  it("admin vê os botões de escrita", async () => {
    await montar("admin");
    abrir("Lançamento");
    expect(screen.getByRole("button", { name: "+ Link" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Pasta" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Editar / })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Excluir / })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Opções da pasta / })).toHaveLength(3);
  });
});

describe("Central de links: pastas em linhas", () => {
  it("lista as pastas uma acima da outra, na ordem, com contagem e a relação dos links ao lado", async () => {
    await montar("membro");
    const nomes = screen.getAllByRole("button", { name: /\d+ links?$/ }).map((b) => b.textContent);
    expect(nomes).toEqual(["Lançamento2 links", "Perpétuo1 link", "Avulsos1 link"]);
    const previa = screen.getByTestId("previa-Lançamento");
    expect(previa.textContent).toContain("Captação Outubro");
    expect(previa.textContent).toContain("Vendas Outubro");
    // nada de cartão enquanto nenhuma pasta está aberta
    expect(screen.queryByTestId("cartao-de-link")).toBeNull();
  });

  it("a prévia lista TODOS os nomes da pasta, numa lista rolável", async () => {
    const muitos = Array.from({ length: 12 }, (_, i) => link({ id: `m${i}`, label: `Link ${i}`, url: `https://ex.com/${i}`, grupo: "Lançamento" }));
    mockDados.lerTudo.mockResolvedValue({ links: muitos, grupos: GRUPOS, pastas: [] });
    await montar("membro");
    const previa = screen.getByTestId("previa-Lançamento");
    expect(within(previa).getAllByRole("listitem").filter((li) => li.className.includes("v2-cl-previa-item"))).toHaveLength(12);
    expect(previa.textContent).toContain("Link 11");
    expect(within(previa).getByRole("list", { name: "Todos os links de Lançamento" }).className).toContain("v2-cl-lista");
  });

  it("onda: cada nome recebe o grau --w conforme a distância até o centro da janela da lista", async () => {
    const muitos = Array.from({ length: 12 }, (_, i) => link({ id: `m${i}`, label: `Link ${i}`, url: `https://ex.com/${i}`, grupo: "Lançamento" }));
    mockDados.lerTudo.mockResolvedValue({ links: muitos, grupos: GRUPOS, pastas: [] });
    // jsdom não faz layout: simula uma lista de 12 linhas de 20px numa janela de 100px
    const def = (prop: string, get: (this: HTMLElement) => number) =>
      Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get });
    def("scrollHeight", function () { return this.tagName === "UL" && this.className.includes("v2-cl-lista") ? 240 : 0; });
    def("clientHeight", function () { return this.tagName === "UL" && this.className.includes("v2-cl-lista") ? 100 : 0; });
    def("offsetHeight", function () { return this.tagName === "LI" ? 20 : 0; });
    def("offsetTop", function () { return this.tagName === "LI" ? Array.from(this.parentElement!.children).indexOf(this) * 20 : 0; });
    try {
      await montar("membro");
      const lista = screen.getByRole("list", { name: "Todos os links de Lançamento" });
      const itens = Array.from(lista.children) as HTMLElement[];
      const w = (i: number) => Number(itens[i].style.getPropertyValue("--w"));
      expect(lista.hasAttribute("data-onda")).toBe(true);
      // no topo a crista está na primeira linha
      expect(w(0)).toBeGreaterThan(w(5));
      // rolado até o fim, a crista desce para a última
      lista.scrollTop = 140;
      fireEvent.scroll(lista);
      await waitFor(() => expect(w(11)).toBeGreaterThan(w(0)));
    } finally {
      for (const p of ["scrollHeight", "clientHeight", "offsetHeight", "offsetTop"]) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[p];
    }
  });

  it("cada nome da relação é um botão: clicar abre a pasta e leva ao cartão do link", async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    await montar("membro");
    expect(screen.queryByTestId("cartao-de-link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver o cartão de Vendas Outubro" }));
    const cartao = await screen.findAllByTestId("cartao-de-link");
    expect(cartao.length).toBeGreaterThan(0);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect((scrollIntoView.mock.instances[0] as HTMLElement).id).toMatch(/^cartao-/);
  });

  it("pasta aberta some com a relação de nomes; ao fechar, ela volta", async () => {
    await montar("membro");
    expect(screen.getByTestId("previa-Lançamento")).toBeTruthy();
    expect(screen.getByTestId("previa-Lançamento").hasAttribute("data-oculta")).toBe(false);
    abrir("Lançamento");
    // fica no fluxo (a pasta não muda de altura), mas oculta e fora da árvore de acessibilidade
    const previa = screen.getByTestId("previa-Lançamento");
    expect(previa.hasAttribute("data-oculta")).toBe(true);
    expect(previa.getAttribute("aria-hidden")).toBe("true");
    // as outras pastas continuam com a relação à vista
    expect(screen.getByTestId("previa-Perpétuo").hasAttribute("data-oculta")).toBe(false);
    fireEvent.click(pasta("Lançamento"));
    expect(screen.getByTestId("previa-Lançamento").hasAttribute("data-oculta")).toBe(false);
  });

  it("lista curta (cabe sem rolar) não ativa a onda", async () => {
    await montar("membro");
    expect(screen.getByRole("list", { name: "Todos os links de Lançamento" }).hasAttribute("data-onda")).toBe(false);
  });

  it("clicar na pasta abre os links logo abaixo; outra pasta fecha a primeira; clicar de novo fecha", async () => {
    await montar("membro");
    const painel = abrir("Lançamento");
    expect(pasta("Lançamento").getAttribute("aria-expanded")).toBe("true");
    expect(within(painel).getAllByTestId("cartao-de-link")).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "Perpétuo" })).toBeNull();

    const outro = abrir("Perpétuo");
    expect(within(outro).getByRole("link", { name: "Abrir Aula Aberta" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Lançamento" })).toBeNull();

    fireEvent.click(pasta("Perpétuo"));
    expect(screen.queryByRole("region", { name: "Perpétuo" })).toBeNull();
  });

  it("clicar na relação de links ao lado da pasta também abre a pasta", async () => {
    await montar("membro");
    fireEvent.click(screen.getByTestId("previa-Perpétuo"));
    expect(screen.getByRole("region", { name: "Perpétuo" })).toBeTruthy();
  });

  it("cada pasta usa a cor dela; sem cor gravada usa a padrão", async () => {
    await montar("membro");
    const cor = (nome: string) => (pasta(nome).style.getPropertyValue("--pc") || "").toLowerCase();
    expect(cor("Lançamento")).toBe("#c4568f");
    expect(cor("Avulsos")).toBe("#2f9e6e");
    expect(cor("Perpétuo")).toBe("#2e8bb9");
  });

  it("o cartão mostra nome, tipo e endereço do link, com a página abrindo ao clicar", async () => {
    await montar("membro");
    abrir("Lançamento");
    const c = cartaoDe("Vendas Outubro");
    expect(within(c).getByText("Vendas")).toBeTruthy();
    expect(within(c).getByText("ex.com")).toBeTruthy();
    const abrirPagina = within(c).getByRole("link", { name: "Abrir Vendas Outubro" });
    expect(abrirPagina.getAttribute("href")).toBe("https://ex.com/vendas");
    expect(abrirPagina.getAttribute("target")).toBe("_blank");
  });

  it("copiar link grava a URL na área de transferência", async () => {
    const escrever = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
    await montar("membro");
    abrir("Lançamento");
    fireEvent.click(within(cartaoDe("Vendas Outubro")).getByRole("button", { name: "Copiar link de Vendas Outubro" }));
    await waitFor(() => expect(escrever).toHaveBeenCalledWith("https://ex.com/vendas"));
    expect(await screen.findByText("Link copiado")).toBeTruthy();
  });

  it("miniatura: com caminho gravado mostra a imagem assinada; sem ele, o espaço ilustrado", async () => {
    mockDados.lerTudo.mockResolvedValue({
      links: [
        link({ id: "1", label: "Com imagem", url: "https://ex.com/a", grupo: "Lançamento", miniatura_path: "miniaturas/1.png" }),
        link({ id: "2", label: "Sem imagem", url: "https://ex.com/b", grupo: "Lançamento" }),
      ],
      grupos: GRUPOS,
      pastas: [],
    });
    mockDados.urlsDeMiniaturas.mockResolvedValue({ "miniaturas/1.png": "https://storage/assinado.png" });
    await montar("membro");
    expect(mockDados.urlsDeMiniaturas).not.toHaveBeenCalled(); // pasta fechada: nada a baixar
    abrir("Lançamento");
    await waitFor(() => expect(within(cartaoDe("Com imagem")).getByTestId("miniatura").getAttribute("src")).toBe("https://storage/assinado.png"));
    expect(mockDados.urlsDeMiniaturas).toHaveBeenCalledWith({ fake: true }, ["miniaturas/1.png"]);
    expect(within(cartaoDe("Sem imagem")).getByTestId("miniatura-vazia")).toBeTruthy();
  });

  it("a busca filtra por nome ou URL, abre as pastas com resultado e esconde as outras", async () => {
    await montar("membro");
    fireEvent.change(screen.getByLabelText("Buscar links"), { target: { value: "outro.com" } });
    expect(screen.getByRole("region", { name: "Avulsos" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir Solto" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Lançamento\s/ })).toBeNull();
    expect(screen.queryByText("Captação Outubro")).toBeNull();
    // na busca o cartão diz a que pasta pertence
    expect(within(cartaoDe("Solto")).getByText("Avulsos")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Buscar links"), { target: { value: "outubro" } });
    expect(screen.getByRole("region", { name: "Lançamento" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Avulsos" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar links"), { target: { value: "zzz" } });
    expect(screen.getByText("Nenhum link encontrado.")).toBeTruthy();
  });

  it("mostra o estado do arquivamento; membro só lê, sem botões de arquivar", async () => {
    await montar("membro");
    abrir("Lançamento");
    expect(screen.getAllByText("Aguardando arquivamento")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Arquivar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Mais ações/ })).toBeNull();
  });

  it("erro de carga aparece com opção de tentar de novo; sem pastas tem mensagem", async () => {
    mockDados.lerTudo.mockRejectedValueOnce(new Error("rede caiu"));
    render(
      <V2Root>
        <PapelProvider papel="admin">
          <TelaDeLinks />
        </PapelProvider>
      </V2Root>,
    );
    expect((await screen.findByRole("alert")).textContent).toContain("rede caiu");
    mockDados.lerTudo.mockResolvedValueOnce({ links: [], grupos: [], pastas: [] });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Nenhuma pasta ainda")).toBeTruthy();
    expect(screen.getByText("Crie a primeira pasta para organizar seus links.")).toBeTruthy();
  });
});

describe("Central de links: escrita (admin)", () => {
  async function menuDaPasta(nome: string, item: string) {
    fireEvent.click(screen.getByRole("button", { name: `Opções da pasta ${nome}` }));
    fireEvent.click(await screen.findByRole("button", { name: item }));
  }

  it("excluir link pede confirmação e só então chama excluirLink", async () => {
    await montar("admin");
    abrir("Lançamento");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Captação Outubro" }));
    expect(mockDados.excluirLink).not.toHaveBeenCalled();
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).toContain("Captação Outubro");
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(mockDados.excluirLink).toHaveBeenCalledWith({ fake: true }, "1"));
  });

  it("subir pasta manda a lista inteira reindexada, mantendo o campo antigo `pasta`", async () => {
    await montar("admin");
    await menuDaPasta("Perpétuo", "Subir pasta");
    await waitFor(() => expect(mockDados.reordenarGrupos).toHaveBeenCalled());
    const itens = mockDados.reordenarGrupos.mock.calls[0][1] as GrupoDaCentral[];
    expect(itens.map((g) => [g.nome, g.position, g.pasta])).toEqual([
      ["Perpétuo", 0, "2026"],
      ["Lançamento", 1, "2026"],
      ["Avulsos", 2, null],
    ]);
  });

  it("a primeira pasta não sobe e a última não desce", async () => {
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: "Opções da pasta Lançamento" }));
    expect((await screen.findByRole("button", { name: "Subir pasta" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Subir pasta" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Opções da pasta Avulsos" }));
    expect((await screen.findByRole("button", { name: "Descer pasta" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("erro de escrita aparece inline na página, sem alert", async () => {
    mockDados.reordenarGrupos.mockRejectedValueOnce(new Error("Sem permissão para esta ação."));
    await montar("admin");
    await menuDaPasta("Lançamento", "Descer pasta");
    expect((await screen.findByRole("alert")).textContent).toContain("Sem permissão para esta ação.");
  });

  it("novo link: salva com os campos do formulário; erro do salvarLink fica no modal", async () => {
    mockDados.salvarLink.mockRejectedValueOnce(new Error("Essa URL já está cadastrada."));
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: "+ Link" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome"), { target: { value: "Novo" } });
    fireEvent.change(within(dlg).getByLabelText("URL"), { target: { value: "https://ex.com/novo" } });
    fireEvent.keyDown(within(dlg).getByRole("combobox", { name: "Pasta" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Perpétuo" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockDados.salvarLink).toHaveBeenCalled());
    expect(mockDados.salvarLink.mock.calls[0][1]).toEqual({ id: undefined, label: "Novo", url: "https://ex.com/novo", grupo: "Perpétuo", tipo: "cap", slug: undefined, arquivoAutomatico: true });
    expect(mockDados.enviarArquivo).not.toHaveBeenCalled();
    expect(mockDados.definirPaginaAtiva).not.toHaveBeenCalled();
    expect((await within(dlg).findByRole("alert")).textContent).toContain("Essa URL já está cadastrada.");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("\"Novo link nesta pasta\" abre o formulário já com a pasta escolhida", async () => {
    await montar("admin");
    await menuDaPasta("Perpétuo", "Novo link nesta pasta");
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByRole("combobox", { name: "Pasta" }).textContent).toContain("Perpétuo");
  });

  it("nova pasta pede nome e cor e chama criarGrupo com a cor; a pasta nova já abre", async () => {
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: "+ Pasta" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome da pasta"), { target: { value: "2027" } });
    fireEvent.click(within(dlg).getByLabelText("Coral"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar pasta" }));
    await waitFor(() => expect(mockDados.criarGrupo).toHaveBeenCalled());
    const [, nome, pastaAntiga, , cor] = mockDados.criarGrupo.mock.calls[0];
    expect([nome, pastaAntiga, cor]).toEqual(["2027", null, "coral"]);
  });

  it("nova pasta com nome repetido é barrada antes de ir ao banco", async () => {
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: "+ Pasta" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome da pasta"), { target: { value: "perpétuo" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar pasta" }));
    await waitFor(() => expect(within(dlg).getByRole("alert").textContent).toContain("Já existe uma pasta com esse nome."));
    expect(mockDados.criarGrupo).not.toHaveBeenCalled();
  });

  it("renomear a pasta chama renomearPasta; mudar só a cor chama só definirCorDaPasta", async () => {
    await montar("admin");
    await menuDaPasta("Avulsos", "Renomear ou mudar cor");
    let dlg = await screen.findByRole("dialog");
    expect((within(dlg).getByLabelText("Nome da pasta") as HTMLInputElement).value).toBe("Avulsos");
    fireEvent.change(within(dlg).getByLabelText("Nome da pasta"), { target: { value: "Diversos" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockDados.renomearPasta).toHaveBeenCalledWith({ fake: true }, "Avulsos", "Diversos"));
    expect(mockDados.definirCorDaPasta).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    mockDados.renomearPasta.mockClear();
    await menuDaPasta("Lançamento", "Renomear ou mudar cor");
    dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByLabelText("Violeta"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockDados.definirCorDaPasta).toHaveBeenCalledWith({ fake: true }, "Lançamento", "violeta"));
    expect(mockDados.renomearPasta).not.toHaveBeenCalled();
  });

  it("erro ao renomear fica no diálogo, que continua aberto", async () => {
    mockDados.renomearPasta.mockRejectedValueOnce(new Error("Aplique a migration 077 no Supabase para usar este recurso."));
    await montar("admin");
    await menuDaPasta("Avulsos", "Renomear ou mudar cor");
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome da pasta"), { target: { value: "Diversos" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(within(dlg).getByRole("alert").textContent).toContain("migration 077"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("pasta com links não pode ser excluída: avisa e não chama o banco", async () => {
    await montar("admin");
    await menuDaPasta("Lançamento", "Excluir pasta");
    expect((await screen.findByRole("alert")).textContent).toContain("Mova ou exclua os links da pasta antes de excluí-la.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockDados.excluirGrupo).not.toHaveBeenCalled();
  });

  it("pasta vazia é excluída depois da confirmação", async () => {
    mockDados.lerTudo.mockResolvedValue({ links: LINKS, grupos: [...GRUPOS, { nome: "Vazia", position: 3, pasta: null, cor: null }], pastas: [] });
    await montar("admin");
    await menuDaPasta("Vazia", "Excluir pasta");
    const dlg = await screen.findByRole("dialog");
    expect(mockDados.excluirGrupo).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(mockDados.excluirGrupo).toHaveBeenCalled());
    expect(mockDados.excluirGrupo.mock.calls[0][1]).toBe("Vazia");
  });
});

describe("Central de links: página arquivada", () => {
  const ARQ = {
    arquivo_path: "paginas/5.html",
    arquivo_tam: 2048,
    arquivado_em: "2026-10-01T15:00:00Z",
    arquivo_status: "ok" as const,
    slug: "captacao-outubro",
  };

  function comArquivos(ativa: boolean) {
    mockDados.lerTudo.mockResolvedValue({
      links: [link({ id: "5", label: "Com cópia", url: "https://ex.com/c", grupo: "Lançamento", pagina_ativa: ativa, ...ARQ }), LINKS[2]],
      grupos: GRUPOS,
      pastas: [],
    });
  }

  async function maisAcoes(nome: string) {
    fireEvent.click(screen.getByRole("button", { name: `Mais ações de ${nome}` }));
    return screen.findByTestId("mais-acoes");
  }

  it("cartão com cópia ativa: selo, Ver cópia, Copiar endereço, Abrir página e Remover arquivo (admin)", async () => {
    comArquivos(true);
    await montar("admin");
    abrir("Lançamento");
    expect(within(cartaoDe("Com cópia")).getByText("Pública ativa")).toBeTruthy();
    const menu = await maisAcoes("Com cópia");
    expect(within(menu).getByRole("button", { name: "Ver cópia" })).toBeTruthy();
    expect(within(menu).getByRole("button", { name: "Copiar endereço" })).toBeTruthy();
    expect(within(menu).getByRole("link", { name: "Abrir página" }).getAttribute("href")).toBe(`${window.location.origin}/p/captacao-outubro`);
    expect(within(menu).getByRole("button", { name: "Remover arquivo" })).toBeTruthy();
  });

  it("link sem arquivo não oferece nenhuma dessas ações", async () => {
    comArquivos(true);
    await montar("admin");
    abrir("Perpétuo");
    const menu = await maisAcoes("Aula Aberta");
    for (const n of ["Ver cópia", "Copiar endereço", "Remover arquivo"]) expect(within(menu).queryByRole("button", { name: n })).toBeNull();
    expect(within(menu).getByRole("button", { name: "Arquivar" })).toBeTruthy();
  });

  it("cópia inativa não oferece endereço nem abrir página; membro não remove, mas vê a cópia", async () => {
    comArquivos(false);
    await montar("membro");
    abrir("Lançamento");
    expect(within(cartaoDe("Com cópia")).getByText("Pública inativa")).toBeTruthy();
    const menu = await maisAcoes("Com cópia");
    expect(within(menu).queryByRole("button", { name: "Copiar endereço" })).toBeNull();
    expect(within(menu).queryByRole("link", { name: "Abrir página" })).toBeNull();
    expect(within(menu).queryByRole("button", { name: "Remover arquivo" })).toBeNull();
    expect(within(menu).getByRole("button", { name: "Ver cópia" })).toBeTruthy();
  });

  it("título: cópia pública leva ao endereço da cópia; sem cópia, à página original", async () => {
    comArquivos(true);
    await montar("membro");
    abrir("Lançamento");
    const salvo = within(cartaoDe("Com cópia")).getByRole("link", { name: "Abrir Com cópia" });
    expect(salvo.getAttribute("href")).toBe(`${window.location.origin}/p/captacao-outubro`);
    expect(salvo.getAttribute("target")).toBe("_blank");
    fireEvent.click(pasta("Perpétuo"));
    expect(within(cartaoDe("Aula Aberta")).getByRole("link", { name: "Abrir Aula Aberta" }).getAttribute("href")).toBe("https://ex.com/aula");
  });

  it("título: cópia só interna (página inativa) abre o visualizador da cópia, não a página original", async () => {
    comArquivos(false);
    await montar("membro");
    abrir("Lançamento");
    const titulo = within(cartaoDe("Com cópia")).getByRole("link", { name: "Abrir Com cópia" });
    expect(fireEvent.click(titulo)).toBe(false); // preventDefault: o navegador não segue o href
    await waitFor(() => expect(mockDados.baixarCopia).toHaveBeenCalled());
  });

  it("Copiar endereço grava o endereço público na área de transferência", async () => {
    comArquivos(true);
    const escrever = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
    await montar("admin");
    abrir("Lançamento");
    fireEvent.click(within(await maisAcoes("Com cópia")).getByRole("button", { name: "Copiar endereço" }));
    await waitFor(() => expect(escrever).toHaveBeenCalledWith(`${window.location.origin}/p/captacao-outubro`));
    expect(await screen.findByText("Endereço copiado")).toBeTruthy();
  });

  it("Ver cópia baixa o arquivo e mostra num iframe com sandbox exato, sem allow-same-origin", async () => {
    comArquivos(true);
    await montar("membro");
    abrir("Lançamento");
    fireEvent.click(within(await maisAcoes("Com cópia")).getByRole("button", { name: "Ver cópia" }));
    const quadro = (await screen.findByTitle("Cópia de Com cópia")) as HTMLIFrameElement;
    expect(mockDados.baixarCopia).toHaveBeenCalledWith({ fake: true }, "paginas/5.html");
    const sandbox = quadro.getAttribute("sandbox") as string;
    expect(sandbox).toBe("allow-scripts allow-popups allow-popups-to-escape-sandbox");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(quadro.getAttribute("srcdoc")).toContain("cópia");
  });

  it("falha ao baixar a cópia aparece inline", async () => {
    comArquivos(true);
    mockDados.baixarCopia.mockRejectedValueOnce(new Error("Arquivo não encontrado."));
    await montar("membro");
    abrir("Lançamento");
    fireEvent.click(within(await maisAcoes("Com cópia")).getByRole("button", { name: "Ver cópia" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Arquivo não encontrado.");
  });

  it("Remover arquivo no cartão pede confirmação e só então chama removerArquivo", async () => {
    comArquivos(true);
    await montar("admin");
    abrir("Lançamento");
    fireEvent.click(within(await maisAcoes("Com cópia")).getByRole("button", { name: "Remover arquivo" }));
    expect(mockDados.removerArquivo).not.toHaveBeenCalled();
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(mockDados.removerArquivo).toHaveBeenCalledWith({ fake: true }, "5", "paginas/5.html", null));
  });

  it("Remover arquivo leva junto a miniatura do link", async () => {
    mockDados.lerTudo.mockResolvedValue({
      links: [link({ id: "5", label: "Com cópia", url: "https://ex.com/c", grupo: "Lançamento", miniatura_path: "miniaturas/5.png", ...ARQ })],
      grupos: GRUPOS,
      pastas: [],
    });
    await montar("admin");
    abrir("Lançamento");
    fireEvent.click(within(await maisAcoes("Com cópia")).getByRole("button", { name: "Remover arquivo" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(mockDados.removerArquivo).toHaveBeenCalledWith({ fake: true }, "5", "paginas/5.html", "miniaturas/5.png"));
  });

  async function abrirNovoLink() {
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: "+ Link" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome"), { target: { value: "Página Nova" } });
    fireEvent.change(within(dlg).getByLabelText("URL"), { target: { value: "https://ex.com/nova" } });
    fireEvent.keyDown(within(dlg).getByRole("combobox", { name: "Pasta" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Perpétuo" }));
    return dlg;
  }

  const html = () => new File(["<html></html>"], "pagina.html", { type: "text/html" });

  it("modal: slug acompanha o nome, mostra o endereço e o switch fica desabilitado sem arquivo", async () => {
    const dlg = await abrirNovoLink();
    expect((within(dlg).getByLabelText("Slug") as HTMLInputElement).value).toBe("pagina-nova");
    expect(dlg.textContent).toContain(`${window.location.origin}/p/pagina-nova`);
    const sw = within(dlg).getByRole("switch", { name: "Página pública ativa" }) as HTMLButtonElement;
    expect(sw.disabled).toBe(true);
    fireEvent.change(within(dlg).getByLabelText(/Arquivo da página/), { target: { files: [html()] } });
    expect(sw.disabled).toBe(false);
  });

  it("novo link com arquivo e página ativa: salvarLink, depois enviarArquivo, depois definirPaginaAtiva", async () => {
    const dlg = await abrirNovoLink();
    const arquivo = html();
    fireEvent.change(within(dlg).getByLabelText(/Arquivo da página/), { target: { files: [arquivo] } });
    fireEvent.click(within(dlg).getByRole("switch", { name: "Página pública ativa" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockDados.definirPaginaAtiva).toHaveBeenCalled());
    expect(mockDados.salvarLink.mock.calls[0][1]).toMatchObject({ label: "Página Nova", slug: undefined });
    expect(mockDados.enviarArquivo).toHaveBeenCalledWith({ fake: true }, "id-salvo", arquivo);
    expect(mockDados.definirPaginaAtiva).toHaveBeenCalledWith({ fake: true }, "id-salvo", true, "paginas/id-salvo.html");
    const ordem = [mockDados.salvarLink, mockDados.enviarArquivo, mockDados.definirPaginaAtiva].map((f) => f.mock.invocationCallOrder[0]);
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
  });

  it("pagina_ativa sem arquivo (dado inconsistente) aparece desligada e não é reenviada como ativa", async () => {
    mockDados.lerTudo.mockResolvedValue({
      links: [link({ id: "7", label: "Torta", url: "https://ex.com/t", grupo: "Lançamento", pagina_ativa: true })],
      grupos: GRUPOS,
      pastas: [],
    });
    await montar("admin");
    abrir("Lançamento");
    fireEvent.click(screen.getByRole("button", { name: "Editar Torta" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByRole("switch", { name: "Página pública ativa" }).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockDados.definirPaginaAtiva).toHaveBeenCalledWith({ fake: true }, "id-salvo", false, null));
  });

  it("slug editado à mão vai para salvarLink", async () => {
    const dlg = await abrirNovoLink();
    fireEvent.change(within(dlg).getByLabelText("Slug"), { target: { value: "meu-slug" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockDados.salvarLink).toHaveBeenCalled());
    expect(mockDados.salvarLink.mock.calls[0][1]).toMatchObject({ slug: "meu-slug" });
  });

  it("erro do envio do arquivo fica no modal; nova tentativa edita o mesmo link em vez de duplicar", async () => {
    mockDados.enviarArquivo.mockRejectedValueOnce(new Error("O arquivo passa de 50 MB."));
    const dlg = await abrirNovoLink();
    fireEvent.change(within(dlg).getByLabelText(/Arquivo da página/), { target: { files: [html()] } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    expect((await within(dlg).findByRole("alert")).textContent).toContain("O arquivo passa de 50 MB.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockDados.salvarLink).toHaveBeenCalledTimes(2));
    expect(mockDados.salvarLink.mock.calls[1][1]).toMatchObject({ id: "id-salvo" });
  });

  it("editar link com arquivo mostra nome e tamanho; Remover arquivo confirma e fecha o modal", async () => {
    comArquivos(true);
    await montar("admin");
    abrir("Lançamento");
    fireEvent.click(screen.getByRole("button", { name: "Editar Com cópia" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByTestId("arquivo-atual").textContent).toContain("5.html");
    expect(within(dlg).getByTestId("arquivo-atual").textContent).toContain("2 KB");
    expect((within(dlg).getByLabelText("Slug") as HTMLInputElement).value).toBe("captacao-outubro");
    expect(within(dlg).getByRole("switch", { name: "Página pública ativa" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(dlg).getByRole("button", { name: "Remover arquivo" }));
    expect(mockDados.removerArquivo).not.toHaveBeenCalled();
    const conf = (await screen.findAllByRole("dialog")).find((d) => d.textContent?.includes("será apagada")) as HTMLElement;
    fireEvent.click(within(conf).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(mockDados.removerArquivo).toHaveBeenCalledWith({ fake: true }, "5", "paginas/5.html", null));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("estadoDoArquivo", () => {
  const base = link({ id: "x", label: "x", url: "https://x.com", grupo: "g" });
  it("cobre cada estado", () => {
    expect(estadoDoArquivo({ ...base, arquivo_status: "pendente" }).texto).toBe("Aguardando arquivamento");
    expect(estadoDoArquivo({ ...base, arquivo_status: "ignorado" }).texto).toBe("Sem cópia arquivada");
    expect(estadoDoArquivo({ ...base, arquivo_status: "arquivando" }).texto).toBe("Arquivando…");
    expect(estadoDoArquivo({ ...base, arquivo_status: "falhou", arquivo_erro: "timeout" }).texto).toBe("Falhou: timeout");
    const arq = { ...base, arquivo_path: "a/b.html", arquivo_tam: 2048, arquivado_em: "2026-10-01T15:00:00Z", arquivo_status: "ok" as const };
    expect(estadoDoArquivo({ ...arq, pagina_ativa: true })).toMatchObject({ texto: "Pública ativa", tom: "ok" });
    expect(estadoDoArquivo({ ...arq, pagina_ativa: false })).toMatchObject({ texto: "Pública inativa", tom: "neutro" });
    expect(estadoDoArquivo(arq).detalhe).toContain("2 KB");
  });
});
