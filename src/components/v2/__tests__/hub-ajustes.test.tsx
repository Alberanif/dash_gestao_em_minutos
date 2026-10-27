/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { CARTOES_DE_AJUSTES, HubAjustes } from "../ajustes/hub";
import { ajustesAccessRedirect } from "../../../app/v2/ajustes/acesso";

describe("hub de Ajustes", () => {
  it("tem Dados (grande), Contas e Usuários (pequenos), nessa ordem", () => {
    expect(CARTOES_DE_AJUSTES.map((c) => [c.titulo, c.tamanho])).toEqual([
      ["Dados e sincronização", "grande"],
      ["Contas conectadas", "pequeno"],
      ["Usuários e acessos", "pequeno"],
    ]);
  });

  it("cada cartão leva à sua tela dentro de /v2/ajustes", () => {
    render(<HubAjustes />);
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/v2/ajustes/dados",
      "/v2/ajustes/contas",
      "/v2/ajustes/usuarios",
      "/v2",
    ]);
  });

  it("título Configurações e volta ao menu da V2", () => {
    render(<HubAjustes />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Configurações");
    expect(screen.getByRole("link", { name: /Voltar ao menu/ }).getAttribute("href")).toBe("/v2");
  });
});

describe("ajustesAccessRedirect", () => {
  const com = (role: string) => ({ app_metadata: { role } });
  it("sem sessão vai ao login; pendente à aprovação", () => {
    expect(ajustesAccessRedirect(null)).toBe("/login");
    expect(ajustesAccessRedirect(com("pendente"))).toBe("/aguardando-aprovacao");
  });
  it("gestor e analista entram; comum não", () => {
    expect(ajustesAccessRedirect(com("gestor"))).toBeNull();
    expect(ajustesAccessRedirect(com("analista"))).toBeNull();
    expect(ajustesAccessRedirect(com("comum"))).not.toBeNull();
  });
});
