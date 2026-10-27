/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import TestesAbLayout from "@/app/v2/indicadores/testes-ab/layout";
import TestesAbPage from "@/app/v2/indicadores/testes-ab/page";

let usuario: { app_metadata?: object } | null = null;
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: usuario } }) } }),
}));
jest.mock("@/components/v2/indicadores/testes-ab/testes/tela-de-testes", () => ({
  TelaDeTestes: () => <p>lista de testes</p>,
}));

async function montar() {
  render(await TestesAbLayout({ children: <p>conteúdo dos testes</p> }));
}

describe("layout do Testes A/B (dentro dos Indicadores)", () => {
  it("sem central_role mostra o aviso e não renderiza o conteúdo", async () => {
    usuario = { app_metadata: { role: "gestor" } };
    await montar();
    expect(screen.getByText(/Você ainda não tem acesso à Central de Links/)).toBeTruthy();
    expect(screen.queryByText("conteúdo dos testes")).toBeNull();
  });

  it("papel desconhecido também é sem acesso", async () => {
    usuario = { app_metadata: { central_role: "dono" } };
    await montar();
    expect(screen.queryByText("conteúdo dos testes")).toBeNull();
  });

  it("sem usuário logado é sem acesso", async () => {
    usuario = null;
    await montar();
    expect(screen.queryByText("conteúdo dos testes")).toBeNull();
  });

  it.each(["membro", "admin"])("com papel %s renderiza o conteúdo", async (papel) => {
    usuario = { app_metadata: { central_role: papel } };
    await montar();
    expect(screen.getByText("conteúdo dos testes")).toBeTruthy();
  });

  it("a lista tem o botão de voltar para o hub de Indicadores", () => {
    render(<TestesAbPage />);
    const voltar = screen.getByRole("link", { name: "Voltar aos indicadores" });
    expect(voltar.getAttribute("href")).toBe("/v2/indicadores");
    expect(screen.getByText("lista de testes")).toBeTruthy();
  });
});
