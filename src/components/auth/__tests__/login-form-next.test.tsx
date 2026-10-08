/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const push = jest.fn();
let nextParam: string | null = null;

jest.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: jest.fn().mockResolvedValue({ error: null }) },
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: jest.fn() }),
  useSearchParams: () => {
    const p = new URLSearchParams();
    if (nextParam !== null) p.set("next", nextParam);
    return p;
  },
}));

import { LoginForm } from "@/components/auth/login-form";

async function submit() {
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: "a@b.com" },
  });
  fireEvent.change(screen.getByLabelText(/^senha/i), {
    target: { value: "x" },
  });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
  await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
}

describe("LoginForm - retorno via ?next=", () => {
  beforeEach(() => {
    push.mockClear();
    nextParam = null;
  });

  it("volta ao caminho do next", async () => {
    nextParam = "/indicadores/x?view=planilha";
    await submit();
    expect(push).toHaveBeenCalledWith("/indicadores/x?view=planilha");
  });

  it("sem next vai para /", async () => {
    await submit();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("next externo cai em /", async () => {
    nextParam = "//evil.com";
    await submit();
    expect(push).toHaveBeenCalledWith("/");
  });
});
