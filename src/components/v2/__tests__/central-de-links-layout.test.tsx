/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import CentralDeLinksLayout from "@/app/v2/central-de-links/layout";

let usuario: { app_metadata?: object } | null = null;
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: usuario } }) } }),
}));
// O jest não lê CSS; os estilos das pastas só importam no navegador.
jest.mock("@/components/v2/eventos/pastas.css", () => ({}));
jest.mock("@/components/v2/central-de-links/central-de-links.css", () => ({}));
jest.mock("@/components/v2/evento/voltar.css", () => ({}));
jest.mock("next/navigation", () => ({ usePathname: () => "/v2/central-de-links" }));

async function montar() {
  const el = await CentralDeLinksLayout({ children: <p>conteúdo da central</p> });
  render(el);
}

describe("layout da Central de links", () => {
  it("sem central_role mostra o aviso e não renderiza o conteúdo", async () => {
    usuario = { app_metadata: { role: "gestor" } };
    await montar();
    expect(screen.getByText(/Você ainda não tem acesso à Central de Links\. Peça a um administrador\./)).toBeTruthy();
    expect(screen.queryByText("conteúdo da central")).toBeNull();
    expect(screen.queryByRole("link", { name: "Links" })).toBeNull();
  });

  it("papel desconhecido também é sem acesso", async () => {
    usuario = { app_metadata: { central_role: "dono" } };
    await montar();
    expect(screen.queryByText("conteúdo da central")).toBeNull();
  });

  it.each(["membro", "admin"])("com papel %s mostra o conteúdo, sem barra de abas (o Teste A/B mora nos Indicadores)", async (papel) => {
    usuario = { app_metadata: { central_role: papel } };
    await montar();
    expect(screen.getByText("conteúdo da central")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "Testes A/B" })).toBeNull();
  });
});
