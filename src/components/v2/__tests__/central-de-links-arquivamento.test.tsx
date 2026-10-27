/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TelaDeLinks } from "../central-de-links/tela-de-links";
import { PapelProvider } from "../central-de-links/papel-context";
import type { PapelCentral } from "@/lib/central-de-links/papel";
import type { GrupoDaCentral, LinkDaCentral } from "@/lib/central-de-links/tipos";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";

const mockDados = {
  lerTudo: jest.fn(),
  lerLink: jest.fn(),
  salvarLink: jest.fn(),
  enviarArquivo: jest.fn(),
  definirPaginaAtiva: jest.fn(),
};
jest.mock("@/lib/central-de-links/dados", () => ({
  __esModule: true,
  lerTudo: (...a: unknown[]) => mockDados.lerTudo(...a),
  lerLink: (...a: unknown[]) => mockDados.lerLink(...a),
  salvarLink: (...a: unknown[]) => mockDados.salvarLink(...a),
  enviarArquivo: (...a: unknown[]) => mockDados.enviarArquivo(...a),
  definirPaginaAtiva: (...a: unknown[]) => mockDados.definirPaginaAtiva(...a),
  baixarCopia: jest.fn(),
  removerArquivo: jest.fn(),
  excluirLink: jest.fn(),
  criarGrupo: jest.fn(),
  excluirGrupo: jest.fn(),
  reordenarGrupos: jest.fn(),
  renomearPasta: jest.fn(),
  definirCorDaPasta: jest.fn(),
  urlsDeMiniaturas: jest.fn().mockResolvedValue({}),
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
    ...p,
  };
}

const LINKS: LinkDaCentral[] = [
  link({ id: "1", label: "Captação Outubro", url: "https://ex.com/cap", grupo: "Lançamento" }),
  link({ id: "2", label: "Vendas Outubro", url: "https://ex.com/vendas", grupo: "Lançamento", tipo: "vnd" }),
  link({ id: "3", label: "Aula Aberta", url: "https://ex.com/aula", grupo: "Perpétuo", tipo: "aula" }),
  link({ id: "4", label: "Solto", url: "https://outro.com/x", grupo: "Avulsos", tipo: "outro" }),
];
const GRUPOS: GrupoDaCentral[] = [
  { nome: "Lançamento", position: 0, pasta: "2026" },
  { nome: "Perpétuo", position: 1, pasta: "2026" },
  { nome: "Avulsos", position: 2, pasta: null },
];
const PASTAS: never[] = [];

const ha = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const resp = (status: number, corpo: unknown = { ok: true, tamanho: 10 }) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response;
const fetchMock = jest.fn();
const fetchOriginal = global.fetch;

beforeEach(() => {
  Object.values(mockDados).forEach((f) => f.mockReset());
  mockDados.lerTudo.mockResolvedValue({ links: LINKS, grupos: GRUPOS, pastas: PASTAS });
  mockDados.salvarLink.mockResolvedValue("id-salvo");
  mockDados.definirPaginaAtiva.mockResolvedValue(undefined);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(resp(200));
  global.fetch = fetchMock as unknown as typeof fetch;
  // a releitura devolve o link já arquivado
  mockDados.lerLink.mockImplementation(async (_sb: unknown, id: string) => {
    const l = LINKS.find((x) => x.id === id);
    return l
      ? { ...l, arquivo_status: "ok", arquivo_path: `paginas/${id}.html`, arquivo_tam: 2048, arquivado_em: "2026-10-01T15:00:00Z" }
      : null;
  });
});
afterAll(() => {
  global.fetch = fetchOriginal;
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

/** Abre a pasta (o botão tem o nome e a contagem). */
function abrir(nome: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${nome}\\s`) }));
}

/** Abre o menu "Mais ações" do cartão e devolve o menu. */
async function menuDe(nome: string) {
  fireEvent.click(screen.getByRole("button", { name: `Mais ações de ${nome}` }));
  return screen.findByTestId("mais-acoes");
}
async function fecharMenu() {
  fireEvent.keyDown(screen.getByTestId("mais-acoes"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByTestId("mais-acoes")).toBeNull());
}
/** Situação de um botão do menu do cartão: existe? está desabilitado? */
async function botao(link: string, nome: string) {
  const b = within(await menuDe(link)).queryByRole("button", { name: nome }) as HTMLButtonElement | null;
  const r = { existe: b !== null, desabilitado: b?.disabled ?? false };
  await fecharMenu();
  return r;
}
async function clicarNoMenu(link: string, nome: string) {
  fireEvent.click(within(await menuDe(link)).getByRole("button", { name: nome }));
}

function cartaoDe(nome: string) {
  return screen.getByRole("link", { name: `Abrir ${nome}` }).closest("[data-testid=cartao-de-link]") as HTMLElement;
}
const idsChamados = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).id as string);

function comEstados() {
  mockDados.lerTudo.mockResolvedValue({
    links: [
      link({ id: "p", label: "Pendente", url: "https://ex.com/p", grupo: "Lançamento", arquivo_status: "pendente" }),
      link({ id: "i", label: "Ignorado", url: "https://ex.com/i", grupo: "Lançamento", arquivo_status: "ignorado" }),
      link({ id: "n", label: "SemStatus", url: "https://ex.com/n", grupo: "Lançamento", arquivo_status: null }),
      link({ id: "f", label: "Falhou", url: "https://ex.com/f", grupo: "Lançamento", arquivo_status: "falhou", arquivo_erro: "A página respondeu com erro HTTP 404." }),
      link({ id: "a1", label: "Arquivando", url: "https://ex.com/a1", grupo: "Lançamento", arquivo_status: "arquivando", arquivo_tentativa_em: ha(1) }),
      link({ id: "a2", label: "Travado", url: "https://ex.com/a2", grupo: "Lançamento", arquivo_status: "arquivando", arquivo_tentativa_em: ha(10) }),
      link({
        id: "c", label: "ComCopia", url: "https://ex.com/c", grupo: "Lançamento", arquivo_status: "ok",
        arquivo_path: "paginas/c.html", arquivo_tam: 2048, arquivado_em: "2026-10-01T15:00:00Z",
      }),
      link({
        id: "c2", label: "CopiaMantida", url: "https://ex.com/c2", grupo: "Lançamento", arquivo_status: "ok",
        arquivo_path: "paginas/c2.html", arquivo_tam: 2048, arquivado_em: "2026-10-01T15:00:00Z",
        arquivo_erro: "A nova captura ficou muito menor que a cópia atual; a cópia anterior foi mantida.",
      }),
    ],
    grupos: GRUPOS,
    pastas: PASTAS,
  });
}

async function iniciarFila() {
  fireEvent.click(screen.getByRole("button", { name: /Arquivar pendentes/ }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Arquivar" }));
}

describe("Central de links: botões de arquivamento por papel e estado", () => {
  it("membro nunca vê os botões de arquivar nem a fila", async () => {
    comEstados();
    await montar("membro");
    abrir("Lançamento");
    for (const nome of [/^Arquivar$/, /^Tentar de novo$/, /^Arquivar de novo$/, /Arquivar pendentes/, /^Arquivando…$/]) {
      expect(screen.queryAllByRole("button", { name: nome })).toHaveLength(0);
    }
    // nem dentro do menu dos cartões que têm cópia (só "Ver cópia")
    const menu = await menuDe("ComCopia");
    expect(within(menu).queryAllByRole("button", { name: /Arquivar|Tentar de novo|Arquivando/ })).toHaveLength(0);
    expect(within(menu).getByRole("button", { name: "Ver cópia" })).toBeTruthy();
  });

  it("admin vê o botão certo em cada estado do cartão", async () => {
    comEstados();
    await montar("admin");
    abrir("Lançamento");
    expect((await botao("Pendente", "Arquivar")).existe).toBe(true);
    expect((await botao("Ignorado", "Arquivar")).existe).toBe(true);
    expect((await botao("SemStatus", "Arquivar")).existe).toBe(true);
    expect((await botao("Falhou", "Tentar de novo")).existe).toBe(true);
    expect(cartaoDe("Falhou").textContent).toContain("A página respondeu com erro HTTP 404.");
    expect(within(cartaoDe("Falhou")).queryByTestId("aviso-arquivo")).toBeNull(); // o motivo já está no selo
    expect(await botao("Arquivando", "Arquivando…")).toEqual({ existe: true, desabilitado: true });
    expect((await botao("Arquivando", "Tentar de novo")).existe).toBe(false);
    expect((await botao("Travado", "Tentar de novo")).existe).toBe(true);
    expect((await botao("Travado", "Arquivando…")).existe).toBe(false);
    expect((await botao("ComCopia", "Arquivar de novo")).existe).toBe(true);
    expect((await botao("ComCopia", "Arquivar")).existe).toBe(false);
    expect(within(cartaoDe("CopiaMantida")).getByTestId("aviso-arquivo").textContent).toContain("a cópia anterior foi mantida");
    expect(within(cartaoDe("ComCopia")).queryByTestId("aviso-arquivo")).toBeNull();
  });
});

describe("Central de links: arquivar um link", () => {
  it("chama o servidor só com o id, relê o link e atualiza o cartão", async () => {
    await montar("admin");
    abrir("Perpétuo");
    await clicarNoMenu("Aula Aberta", "Arquivar");
    await waitFor(async () => expect((await botao("Aula Aberta", "Arquivar de novo")).existe).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/central-de-links/arquivar");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ id: "3" });
    expect(mockDados.lerLink).toHaveBeenCalledWith({ fake: true }, "3");
    expect(cartaoDe("Aula Aberta").textContent).toContain("2 KB");
  });

  it("falha do servidor aparece inline e o cartão oferece nova tentativa", async () => {
    fetchMock.mockResolvedValue(resp(422, { erro: "A captura veio vazia ou inválida." }));
    mockDados.lerLink.mockImplementation(async (_sb: unknown, id: string) => ({
      ...(LINKS.find((x) => x.id === id) as LinkDaCentral),
      arquivo_status: "falhou",
      arquivo_erro: "A captura veio vazia ou inválida.",
    }));
    await montar("admin");
    abrir("Perpétuo");
    await clicarNoMenu("Aula Aberta", "Arquivar");
    expect((await screen.findByRole("alert")).textContent).toContain("A captura veio vazia ou inválida.");
    await waitFor(async () => expect((await botao("Aula Aberta", "Tentar de novo")).existe).toBe(true));
  });
});

describe("Central de links: fila Arquivar pendentes", () => {
  it("pede confirmação e só então dispara, na ordem", async () => {
    await montar("admin");
    fireEvent.click(screen.getByRole("button", { name: /Arquivar pendentes/ }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).toContain("4");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Arquivar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(idsChamados()).toEqual(["1", "2", "3", "4"]);
  });

  it("só conta pendentes sem cópia; sem nenhum, o botão some", async () => {
    comEstados();
    await montar("admin");
    expect(screen.getByRole("button", { name: "Arquivar pendentes (1)" })).toBeTruthy();
    cleanup();
    mockDados.lerTudo.mockResolvedValue({
      links: [{ ...LINKS[0], arquivo_status: "pendente", arquivo_path: "x.html" }],
      grupos: GRUPOS,
      pastas: PASTAS,
    });
    await montar("admin");
    expect(screen.queryByRole("button", { name: /Arquivar pendentes/ })).toBeNull();
  });

  it("roda um por vez, mostra o progresso e continua depois de um erro", async () => {
    const abertos: Array<(r: Response) => void> = [];
    fetchMock.mockImplementation(() => new Promise<Response>((ok) => abertos.push(ok)));
    await montar("admin");
    await iniciarFila();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const painel = screen.getByTestId("fila-arquivamento");
    expect(painel.textContent).toContain("1 de 4");
    expect(painel.textContent).toContain("Captação Outubro");
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1); // o segundo só começa quando o primeiro termina

    abertos[0](resp(422, { erro: "A página respondeu com erro HTTP 500." }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("fila-arquivamento").textContent).toContain("2 de 4");
    abertos[1](resp(200));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    abertos[2](resp(200));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    abertos[3](resp(200));

    const fim = await screen.findByTestId("resumo-fila");
    expect(fim.textContent).toContain("3 páginas arquivadas");
    expect(fim.textContent).toContain("1 falhou");
    expect(screen.queryByTestId("fila-arquivamento")).toBeNull();
  });

  it("Parar interrompe a fila depois do item atual", async () => {
    const abertos: Array<(r: Response) => void> = [];
    fetchMock.mockImplementation(() => new Promise<Response>((ok) => abertos.push(ok)));
    await montar("admin");
    await iniciarFila();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(await within(screen.getByTestId("fila-arquivamento")).findByRole("button", { name: "Parar" }));
    abertos[0](resp(200));
    const fim = await screen.findByTestId("resumo-fila");
    expect(fim.textContent).toContain("interrompida");
    expect(fim.textContent).toContain("1 página arquivada");
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("navegador de captura indisponível vira uma explicação clara no aviso final", async () => {
    fetchMock.mockResolvedValue(
      resp(422, { erro: "O navegador de captura não está disponível neste ambiente. Use um servidor com Chrome." }),
    );
    await montar("admin");
    await iniciarFila();
    const fim = await screen.findByTestId("resumo-fila");
    expect(fim.textContent).toContain("navegador de captura");
    expect(fim.textContent).toContain("4 falharam");
  });
});

describe("Central de links: novo link e arquivamento automático", () => {
  async function preencherNovoLink() {
    fireEvent.click(screen.getByRole("button", { name: "+ Link" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome"), { target: { value: "Novo" } });
    fireEvent.change(within(dlg).getByLabelText("URL"), { target: { value: "https://ex.com/novo" } });
    fireEvent.keyDown(within(dlg).getByRole("combobox", { name: "Pasta" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Perpétuo" }));
    return dlg;
  }
  const CAIXA = "Arquivar esta página automaticamente";

  it("caixa marcada por padrão: grava como automático e dispara o arquivamento dele, sem ligar a página pública", async () => {
    await montar("admin");
    const dlg = await preencherNovoLink();
    expect((within(dlg).getByRole("checkbox", { name: CAIXA }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(mockDados.salvarLink.mock.calls[0][1]).toMatchObject({ arquivoAutomatico: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ id: "id-salvo" });
    expect(mockDados.definirPaginaAtiva).not.toHaveBeenCalled();
  });

  it("caixa desmarcada: grava sem automático e não chama o servidor", async () => {
    await montar("admin");
    const dlg = await preencherNovoLink();
    fireEvent.click(within(dlg).getByRole("checkbox", { name: CAIXA }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockDados.salvarLink).toHaveBeenCalled());
    expect(mockDados.salvarLink.mock.calls[0][1]).toMatchObject({ arquivoAutomatico: false });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("editar link existente não mostra a caixa", async () => {
    await montar("admin");
    abrir("Lançamento");
    fireEvent.click(screen.getByRole("button", { name: "Editar Captação Outubro" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).queryByRole("checkbox", { name: CAIXA })).toBeNull();
  });
});
