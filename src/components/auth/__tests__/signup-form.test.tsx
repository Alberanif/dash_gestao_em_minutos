/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { SignupForm } from "@/components/auth/signup-form";

function fillForm({
  name = "Maria Solicitante",
  email = "maria@igtcoaching.com",
  password = "senha-forte-123",
  passwordConfirm = "senha-forte-123",
} = {}) {
  fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
    target: { value: passwordConfirm },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /solicitar acesso/i }));
}

function mockFetch(response: { ok: boolean; status?: number; body?: object }) {
  const fn = jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 201 : 400),
    json: async () => response.body ?? {},
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SignupForm", () => {
  it("pede nome, e-mail, senha e confirmação", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
  });

  it("envia a solicitação para a API de signup", async () => {
    const fetchMock = mockFetch({ ok: true, status: 201, body: { id: "novo-1" } });
    render(<SignupForm />);

    fillForm();
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/signup");
    expect(JSON.parse(init.body)).toEqual({
      name: "Maria Solicitante",
      email: "maria@igtcoaching.com",
      password: "senha-forte-123",
      passwordConfirm: "senha-forte-123",
    });
  });

  it("confirma o envio e explica que o acesso depende de aprovação", async () => {
    mockFetch({ ok: true, status: 201, body: { id: "novo-1" } });
    render(<SignupForm />);

    fillForm();
    submit();

    expect(await screen.findByText(/solicitação enviada/i)).toBeInTheDocument();
    expect(screen.getByText(/aprovar seu acesso/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /login|entrar/i })).toHaveAttribute("href", "/login");
  });

  it("barra senhas divergentes no cliente, sem chamar a API", async () => {
    const fetchMock = mockFetch({ ok: true });
    render(<SignupForm />);

    fillForm({ passwordConfirm: "outra-senha-123" });
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/não coincidem/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("barra senha curta no cliente, sem chamar a API", async () => {
    const fetchMock = mockFetch({ ok: true });
    render(<SignupForm />);

    fillForm({ password: "curta7", passwordConfirm: "curta7" });
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/8 caracteres/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mostra a mensagem do servidor quando o e-mail já existe", async () => {
    mockFetch({
      ok: false,
      status: 409,
      body: { error: "Este e-mail já possui conta ou solicitação em andamento" },
    });
    render(<SignupForm />);

    fillForm();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /já possui conta ou solicitação em andamento/i
    );
  });

  it("mostra a mensagem do servidor quando o limite de solicitações é atingido", async () => {
    mockFetch({
      ok: false,
      status: 429,
      body: { error: "Limite de solicitações atingido, tente mais tarde" },
    });
    render(<SignupForm />);

    fillForm();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/limite de solicitações atingido/i);
  });
});
