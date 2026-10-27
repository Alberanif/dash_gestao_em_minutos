/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { GestaoDeUsuarios } from "../ajustes/usuarios/gestao-de-usuarios";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";

beforeAll(() => {
  mockReducedMotion(false);
  // Radix Select usa APIs que o jsdom não implementa.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const EU = { id: "u-eu", email: "eu@igt.com", name: "Eu Mesmo", role: "gestor", central_role: "admin", created_at: "2026-01-01T12:00:00Z", last_sign_in_at: "2026-02-01T12:00:00Z" };
const ANA = { id: "u-ana", email: "ana@igt.com", name: null, role: "comum", central_role: null, created_at: "2026-01-02T12:00:00Z", last_sign_in_at: null };
const PEDRO = { id: "u-pedro", email: "pedro@igt.com", name: "Pedro Lima", role: "pendente", central_role: null, created_at: "2026-03-01T12:00:00Z", last_sign_in_at: null };

type Chamada = { url: string; method: string; body?: unknown };
let chamadas: Chamada[];
let usuarios: unknown[];
let respostas: Record<string, { ok: boolean; status?: number; body?: unknown }>;

function resp(ok: boolean, body: unknown, status = ok ? 200 : 400) {
  return Promise.resolve({ ok, status, json: async () => body } as Response);
}

beforeEach(() => {
  chamadas = [];
  usuarios = [EU, ANA, PEDRO];
  respostas = {};
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    chamadas.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const chave = `${method} ${url}`;
    if (respostas[chave]) return resp(respostas[chave].ok, respostas[chave].body, respostas[chave].status);
    if (url === "/api/auth/user") return resp(true, { id: "u-eu" });
    if (url === "/api/admin/users" && method === "GET") return resp(true, usuarios);
    return resp(true, {});
  }) as unknown as typeof fetch;
});

async function montar() {
  render(
    <V2Root>
      <GestaoDeUsuarios />
    </V2Root>,
  );
  await screen.findByRole("list", { name: "Usuários com acesso" });
}

const chamadasDe = (method: string) => chamadas.filter((c) => c.method === method);

async function escolherFuncao(dialogo: HTMLElement, rotulo: string) {
  const gatilho = within(dialogo).getByRole("combobox", { name: "Função" });
  fireEvent.keyDown(gatilho, { key: "Enter" });
  const opcao = await screen.findByRole("option", { name: rotulo });
  fireEvent.click(opcao);
}

describe("Usuários e acessos", () => {
  it("mostra as solicitações pendentes no topo, antes da lista de usuários", async () => {
    await montar();
    const pendentes = screen.getByRole("region", { name: /Solicitações pendentes/ });
    const lista = screen.getByRole("list", { name: "Usuários com acesso" });
    expect(within(pendentes).getByText("pedro@igt.com")).toBeTruthy();
    expect(within(pendentes).getByText(/Solicitado em/)).toBeTruthy();
    expect(within(lista).queryByText("pedro@igt.com")).toBeNull();
    expect(pendentes.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sem pendentes não mostra o painel de solicitações", async () => {
    usuarios = [EU, ANA];
    await montar();
    expect(screen.queryByRole("region", { name: /Solicitações pendentes/ })).toBeNull();
  });

  it("mostra a função como selo com texto", async () => {
    await montar();
    const lista = screen.getByRole("list", { name: "Usuários com acesso" });
    expect(within(lista).getByText("Gestor")).toBeTruthy();
    expect(within(lista).getByText("Comum")).toBeTruthy();
  });

  it("aprovar faz PATCH com a função escolhida", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar Pedro Lima" }));
    const dialogo = await screen.findByRole("dialog");
    await escolherFuncao(dialogo, "Analista");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(chamadasDe("PATCH")).toHaveLength(1));
    expect(chamadasDe("PATCH")[0]).toMatchObject({ url: "/api/admin/users/u-pedro", body: { role: "analista" } });
  });

  it("aprovar sem mexer na função usa Comum", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar Pedro Lima" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(chamadasDe("PATCH")[0]?.body).toEqual({ role: "comum" }));
  });

  it("erro da API ao aprovar aparece no diálogo e o diálogo continua aberto", async () => {
    respostas["PATCH /api/admin/users/u-pedro"] = { ok: false, body: { error: "Falha do servidor" } };
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar Pedro Lima" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Aprovar" }));
    expect((await within(dialogo).findByRole("alert")).textContent).toBe("Falha do servidor");
  });

  it("rejeitar só chama DELETE depois de confirmar", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar Pedro Lima" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/Rejeitar a solicitação de Pedro Lima/)).toBeTruthy();
    expect(chamadasDe("DELETE")).toHaveLength(0);
    fireEvent.click(within(dialogo).getByRole("button", { name: "Rejeitar solicitação" }));
    await waitFor(() => expect(chamadasDe("DELETE")).toHaveLength(1));
    expect(chamadasDe("DELETE")[0].url).toBe("/api/admin/users?id=u-pedro");
  });

  it("cancelar a rejeição não chama a API", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar Pedro Lima" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(chamadasDe("DELETE")).toHaveLength(0);
  });

  it("excluir só chama DELETE depois de confirmar, nomeando a pessoa", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Excluir ana@igt.com" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/Excluir o acesso de ana@igt.com/)).toBeTruthy();
    expect(chamadasDe("DELETE")).toHaveLength(0);
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir acesso" }));
    await waitFor(() => expect(chamadasDe("DELETE")).toHaveLength(1));
    expect(chamadasDe("DELETE")[0].url).toBe("/api/admin/users?id=u-ana");
  });

  it("falha ao excluir mostra o erro da API na página", async () => {
    respostas["DELETE /api/admin/users?id=u-ana"] = { ok: false, status: 403, body: { error: "Sem permissão" } };
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Excluir ana@igt.com" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Excluir acesso" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Sem permissão");
  });

  it("alterar função faz PATCH com a função escolhida, começando pela atual", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Alterar função de ana@igt.com" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByRole("combobox", { name: "Função" }).textContent).toContain("Comum");
    await escolherFuncao(dialogo, "Gestor");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Alterar função" }));
    await waitFor(() => expect(chamadasDe("PATCH")).toHaveLength(1));
    expect(chamadasDe("PATCH")[0]).toMatchObject({ url: "/api/admin/users/u-ana", body: { role: "gestor" } });
  });

  it("cria usuário com POST de e-mail, senha e função", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("E-mail"), { target: { value: "novo@igt.com" } });
    fireEvent.change(within(dialogo).getByLabelText("Senha"), { target: { value: "segredo123" } });
    await escolherFuncao(dialogo, "Analista");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Criar usuário" }));
    await waitFor(() => expect(chamadasDe("POST")).toHaveLength(1));
    expect(chamadasDe("POST")[0]).toMatchObject({
      url: "/api/admin/users",
      body: { email: "novo@igt.com", password: "segredo123", role: "analista" },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("erro ao criar usuário aparece no diálogo", async () => {
    respostas["POST /api/admin/users"] = { ok: false, body: { error: "E-mail já cadastrado" } };
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("E-mail"), { target: { value: "a@b.com" } });
    fireEvent.change(within(dialogo).getByLabelText("Senha"), { target: { value: "123456" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Criar usuário" }));
    expect((await within(dialogo).findByRole("alert")).textContent).toBe("E-mail já cadastrado");
  });

  it("a própria conta não tem Alterar função nem Excluir", async () => {
    await montar();
    expect(screen.queryByRole("button", { name: /Alterar função de Eu Mesmo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excluir Eu Mesmo/ })).toBeNull();
    expect(screen.getByText("Você")).toBeTruthy();
    // as outras contas continuam com as ações
    expect(screen.getByRole("button", { name: "Excluir ana@igt.com" })).toBeTruthy();
  });

  it("pendentes não aparecem na lista de ativos nem ganham Alterar função", async () => {
    await montar();
    expect(screen.queryByRole("button", { name: /Alterar função de Pedro/ })).toBeNull();
  });

  it("lista vazia explica o próximo passo", async () => {
    usuarios = [];
    render(
      <V2Root>
        <GestaoDeUsuarios />
      </V2Root>,
    );
    expect(await screen.findByText(/Nenhum usuário com acesso ainda/)).toBeTruthy();
  });

  it("falha ao carregar diz o que fazer e permite tentar de novo", async () => {
    respostas["GET /api/admin/users"] = { ok: false, status: 500, body: {} };
    render(
      <V2Root>
        <GestaoDeUsuarios />
      </V2Root>,
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/Não foi possível carregar/);
    delete respostas["GET /api/admin/users"];
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("list", { name: "Usuários com acesso" });
  });

  it("mostra estado de carregamento antes da resposta", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(
      <V2Root>
        <GestaoDeUsuarios />
      </V2Root>,
    );
    expect(screen.getByRole("status").textContent).toMatch(/Carregando/);
  });
});

describe("Acesso à Central de Links", () => {
  async function escolherAcesso(rotuloSelect: string, opcao: string) {
    const gatilho = screen.getByRole("combobox", { name: rotuloSelect });
    fireEvent.keyDown(gatilho, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: opcao }));
  }

  it("mostra o selo da Central de cada usuário", async () => {
    usuarios = [EU, { ...ANA, central_role: "membro" }];
    await montar();
    const lista = screen.getByRole("list", { name: "Usuários com acesso" });
    expect(within(lista).getByText("Central: Admin")).toBeTruthy();
    expect(within(lista).getByText("Central: Membro")).toBeTruthy();
  });

  it("usuário sem papel aparece como Sem acesso", async () => {
    await montar();
    expect(screen.getByText("Central: Sem acesso")).toBeTruthy();
  });

  it("admin da Central vê o seletor nas outras linhas, mas não na própria", async () => {
    await montar();
    expect(screen.getByRole("combobox", { name: "Acesso à Central de ana@igt.com" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /Acesso à Central de Eu Mesmo/ })).toBeNull();
  });

  it("quem não é admin da Central não vê seletor algum", async () => {
    usuarios = [{ ...EU, central_role: "membro" }, ANA];
    await montar();
    expect(screen.queryByRole("combobox", { name: /Acesso à Central/ })).toBeNull();
  });

  it("quem não tem papel na Central não vê seletor algum", async () => {
    usuarios = [{ ...EU, central_role: null }, ANA];
    await montar();
    expect(screen.queryByRole("combobox", { name: /Acesso à Central/ })).toBeNull();
  });

  it("escolher Membro faz PATCH em /api/central-de-links/acesso e recarrega a lista", async () => {
    await montar();
    await escolherAcesso("Acesso à Central de ana@igt.com", "Membro");
    await waitFor(() => expect(chamadasDe("PATCH")).toHaveLength(1));
    expect(chamadasDe("PATCH")[0]).toMatchObject({
      url: "/api/central-de-links/acesso",
      body: { userId: "u-ana", centralRole: "membro" },
    });
    await waitFor(() => expect(chamadasDe("GET").filter((c) => c.url === "/api/admin/users").length).toBeGreaterThan(1));
  });

  it("escolher Sem acesso manda centralRole null", async () => {
    usuarios = [EU, { ...ANA, central_role: "membro" }];
    await montar();
    await escolherAcesso("Acesso à Central de ana@igt.com", "Sem acesso");
    await waitFor(() => expect(chamadasDe("PATCH")).toHaveLength(1));
    expect(chamadasDe("PATCH")[0].body).toEqual({ userId: "u-ana", centralRole: null });
  });

  it("erro da API aparece na linha, sem alert do navegador", async () => {
    respostas["PATCH /api/central-de-links/acesso"] = { ok: false, status: 403, body: { error: "Sem permissão" } };
    await montar();
    await escolherAcesso("Acesso à Central de ana@igt.com", "Administrador");
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe("Sem permissão");
  });
});
