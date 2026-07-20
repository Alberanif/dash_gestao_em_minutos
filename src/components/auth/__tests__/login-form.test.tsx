/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: jest.fn() },
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

import { LoginForm } from "@/components/auth/login-form";

describe("LoginForm — porta de entrada do auto-cadastro", () => {
  it("oferece a quem não tem conta o caminho para solicitar acesso", () => {
    render(<LoginForm />);

    const link = screen.getByRole("link", { name: /solicitar acesso/i });

    expect(link).toHaveAttribute("href", "/cadastro");
  });

  it("não afirma mais que as credenciais vêm do gestor", () => {
    render(<LoginForm />);

    expect(
      screen.queryByText(/use as credenciais fornecidas pelo seu gestor/i)
    ).not.toBeInTheDocument();
  });
});
