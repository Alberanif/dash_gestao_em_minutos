/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import { UserManagement } from "@/components/settings/user-management";

interface FakeUser {
  id: string;
  email: string;
  name?: string | null;
  role: "gestor" | "analista" | "comum" | "pendente";
  created_at?: string;
  last_sign_in_at?: string | null;
}

const GESTOR: FakeUser = {
  id: "gestor-1",
  email: "gestor@igtcoaching.com",
  name: "Gestor Chefe",
  role: "gestor",
  created_at: "2026-01-01T09:00:00Z",
  last_sign_in_at: "2026-03-15T09:00:00Z",
};

const PENDENTE: FakeUser = {
  id: "pend-1",
  email: "novato@igtcoaching.com",
  name: "Novato Solicitante",
  role: "pendente",
  created_at: "2026-07-20T10:30:00Z",
  last_sign_in_at: null,
};

/**
 * Encena a API admin: GET devolve `users`; a resposta a PATCH/DELETE só precisa
 * ser ok. Registra as chamadas mutantes para inspeção.
 */
function mockApi(users: FakeUser[]) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fn = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url === "/api/auth/user") {
      return { ok: true, json: async () => ({ id: GESTOR.id }) };
    }
    if (url === "/api/admin/users" && method === "GET") {
      return { ok: true, json: async () => users };
    }
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return { ok: true, json: async () => ({}) };
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("UserManagement — fila de solicitações pendentes", () => {
  it("mostra a seção com contador quando há pendências", async () => {
    mockApi([GESTOR, PENDENTE]);
    render(<UserManagement />);

    const heading = await screen.findByText(/solicitações pendentes/i);

    expect(heading).toHaveTextContent("1");
  });

  it("exibe nome, e-mail e data de cada solicitação", async () => {
    mockApi([GESTOR, PENDENTE]);
    render(<UserManagement />);

    const queue = await screen.findByRole("list", { name: /solicitações pendentes/i });

    expect(within(queue).getByText("Novato Solicitante")).toBeInTheDocument();
    expect(within(queue).getByText("novato@igtcoaching.com")).toBeInTheDocument();
    expect(within(queue).getByText(/20\/07\/2026/)).toBeInTheDocument();
  });

  it("não mostra a seção quando não há pendências", async () => {
    mockApi([GESTOR]);
    render(<UserManagement />);

    await screen.findByText(GESTOR.email);

    expect(screen.queryByText(/solicitações pendentes/i)).not.toBeInTheDocument();
  });

  it("mantém o solicitante fora da lista de usuários ativos", async () => {
    mockApi([GESTOR, PENDENTE]);
    render(<UserManagement />);

    await screen.findByText(GESTOR.email);
    const activeList = screen.getByRole("list", { name: /usuários com acesso/i });

    expect(within(activeList).queryByText(PENDENTE.email)).not.toBeInTheDocument();
    expect(within(activeList).getByText(GESTOR.email)).toBeInTheDocument();
  });
});

describe("UserManagement — aprovar solicitação", () => {
  it("efetiva a aprovação com a role escolhida via PATCH no endpoint existente", async () => {
    const { calls } = mockApi([GESTOR, PENDENTE]);
    render(<UserManagement />);

    const queue = await screen.findByRole("list", { name: /solicitações pendentes/i });
    fireEvent.click(within(queue).getByRole("button", { name: /aprovar/i }));

    const roleSelect = await screen.findByRole("combobox", { name: /função|role/i });
    fireEvent.change(roleSelect, { target: { value: "analista" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar aprovação/i }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        url: `/api/admin/users/${PENDENTE.id}`,
        method: "PATCH",
        body: { role: "analista" },
      })
    );
  });

  it("propõe 'comum' como role padrão ao aprovar", async () => {
    const { calls } = mockApi([GESTOR, PENDENTE]);
    render(<UserManagement />);

    const queue = await screen.findByRole("list", { name: /solicitações pendentes/i });
    fireEvent.click(within(queue).getByRole("button", { name: /aprovar/i }));

    await screen.findByRole("combobox", { name: /função|role/i });
    fireEvent.click(screen.getByRole("button", { name: /confirmar aprovação/i }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ role: "comum" });
  });

  it("nunca oferece 'pendente' como opção no seletor de aprovação", async () => {
    mockApi([GESTOR, PENDENTE]);
    render(<UserManagement />);

    const queue = await screen.findByRole("list", { name: /solicitações pendentes/i });
    fireEvent.click(within(queue).getByRole("button", { name: /aprovar/i }));

    const roleSelect = await screen.findByRole("combobox", { name: /função|role/i });
    const options = within(roleSelect)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);

    expect(options).toEqual(expect.arrayContaining(["gestor", "analista", "comum"]));
    expect(options).not.toContain("pendente");
  });
});

describe("UserManagement — rejeitar solicitação", () => {
  it("remove a conta via DELETE após confirmação", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    const { calls } = mockApi([GESTOR, PENDENTE]);
    render(<UserManagement />);

    const queue = await screen.findByRole("list", { name: /solicitações pendentes/i });
    fireEvent.click(within(queue).getByRole("button", { name: /rejeitar/i }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        url: `/api/admin/users?id=${PENDENTE.id}`,
        method: "DELETE",
        body: undefined,
      })
    );
    confirmSpy.mockRestore();
  });

  it("não remove nada se o gestor cancelar a confirmação", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
    const { calls } = mockApi([GESTOR, PENDENTE]);
    render(<UserManagement />);

    const queue = await screen.findByRole("list", { name: /solicitações pendentes/i });
    fireEvent.click(within(queue).getByRole("button", { name: /rejeitar/i }));

    expect(calls).toHaveLength(0);
    confirmSpy.mockRestore();
  });
});
