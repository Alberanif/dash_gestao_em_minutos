/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ContasConectadas } from "../ajustes/contas/contas-conectadas";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";
import type { Account } from "@/types/accounts";

beforeAll(() => mockReducedMotion(false));

const contas: Account[] = [
  { id: "a1", platform: "youtube", name: "Canal Principal", is_active: true, created_at: "2026-01-01", credentials: { client_id: "c", client_secret: "s", refresh_token: "r", channel_id: "UC1", history_start_date: "2024-01-01" } },
  { id: "a2", platform: "hotmart", name: "Loja Hotmart", is_active: false, created_at: "2026-01-02", credentials: { client_id: "hid", client_secret: "hsec" } },
  { id: "a3", platform: "instagram", name: "Insta IGT", is_active: true, created_at: "2026-01-03", credentials: { access_token: "tok", user_id: "42" } },
];

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(async () => ({ ok: true, json: async () => contas }));
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});

const renderizar = (lista: Account[] = contas) =>
  render(
    <V2Root>
      <ContasConectadas contasIniciais={lista} />
    </V2Root>,
  );

const chamadas = (metodo: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === metodo);

describe("Contas conectadas", () => {
  it("agrupa as contas por plataforma, cada uma no seu painel", () => {
    renderizar();
    expect(within(screen.getByRole("group", { name: "YouTube" })).getByText("Canal Principal")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Hotmart" })).getByText("Loja Hotmart")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Instagram" })).getByText("Insta IGT")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "YouTube" })).queryByText("Loja Hotmart")).toBeNull();
  });

  it("mostra o status em texto", () => {
    renderizar();
    expect(within(screen.getByRole("group", { name: "YouTube" })).getByText("Ativa")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Hotmart" })).getByText("Inativa")).toBeTruthy();
  });

  it("plataforma sem conta mostra estado vazio com botão de adicionar", () => {
    renderizar();
    const painel = screen.getByRole("group", { name: "Meta Ads" });
    expect(within(painel).getByText(/Nenhuma conta de Meta Ads/)).toBeTruthy();
    fireEvent.click(within(painel).getByRole("button", { name: /Adicionar conta de Meta Ads/ }));
    expect(screen.getByLabelText("Ad Account ID")).toBeTruthy();
  });

  it("desativar conta ativa envia PATCH is_active=false e recarrega a lista", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Desativar Canal Principal" }));
    await waitFor(() => expect(chamadas("PATCH")).toHaveLength(1));
    const [url, init] = chamadas("PATCH")[0];
    expect(url).toBe("/api/accounts/a1");
    expect(JSON.parse(init.body)).toEqual({ is_active: false });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/accounts"));
  });

  it("ativar conta inativa envia is_active=true", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Ativar Loja Hotmart" }));
    await waitFor(() => expect(chamadas("PATCH")).toHaveLength(1));
    expect(JSON.parse(chamadas("PATCH")[0][1].body)).toEqual({ is_active: true });
  });

  it("excluir só dispara DELETE depois de confirmar, nomeando a conta", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Insta IGT" }));
    expect(screen.getByText(/Excluir a conta "Insta IGT"\?/)).toBeTruthy();
    expect(chamadas("DELETE")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(chamadas("DELETE")).toHaveLength(1));
    expect(chamadas("DELETE")[0][0]).toBe("/api/accounts/a3");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/accounts"));
  });

  it("cancelar a confirmação não exclui", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Insta IGT" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(chamadas("DELETE")).toHaveLength(0);
  });

  it("formulário cria conta com POST /api/accounts e recarrega", async () => {
    renderizar([]);
    fireEvent.click(within(screen.getByRole("group", { name: "Hotmart" })).getByRole("button", { name: /Adicionar conta de Hotmart/ }));
    fireEvent.change(screen.getByLabelText("Nome da conta"), { target: { value: "Nova Loja" } });
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "id1" } });
    fireEvent.change(screen.getByLabelText("Client Secret"), { target: { value: "sec1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    await waitFor(() => expect(chamadas("POST")).toHaveLength(1));
    const [url, init] = chamadas("POST")[0];
    expect(url).toBe("/api/accounts");
    expect(JSON.parse(init.body)).toEqual({
      name: "Nova Loja",
      platform: "hotmart",
      credentials: { client_id: "id1", client_secret: "sec1" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/accounts"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("formulário edita conta com PATCH /api/accounts/:id, plataforma travada", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Editar Insta IGT" }));
    expect(screen.getByRole("combobox", { name: "Plataforma" }).hasAttribute("disabled")).toBe(true);
    expect((screen.getByLabelText("Access Token") as HTMLInputElement).value).toBe("tok");
    fireEvent.change(screen.getByLabelText("Nome da conta"), { target: { value: "Insta Novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    await waitFor(() => expect(chamadas("PATCH")).toHaveLength(1));
    const [url, init] = chamadas("PATCH")[0];
    expect(url).toBe("/api/accounts/a3");
    expect(JSON.parse(init.body)).toEqual({
      name: "Insta Novo",
      platform: "instagram",
      credentials: { access_token: "tok", user_id: "42" },
    });
  });

  it("mostra o erro da API sem fechar o formulário", async () => {
    fetchMock.mockImplementation(async (_u: string, init?: { method?: string }) =>
      init?.method === "POST" ? { ok: false, json: async () => ({ error: "Credenciais inválidas" }) } : { ok: true, json: async () => [] },
    );
    renderizar([]);
    fireEvent.click(within(screen.getByRole("group", { name: "Instagram" })).getByRole("button", { name: /Adicionar conta de Instagram/ }));
    fireEvent.change(screen.getByLabelText("Nome da conta"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Access Token"), { target: { value: "t" } });
    fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "u" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Credenciais inválidas");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("YouTube conectado oferece reconectar com Google", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Editar Canal Principal" }));
    expect(screen.getByRole("button", { name: "Reconectar com Google" })).toBeTruthy();
    expect(screen.getByText(/Conectado — canal: UC1/)).toBeTruthy();
  });
});
