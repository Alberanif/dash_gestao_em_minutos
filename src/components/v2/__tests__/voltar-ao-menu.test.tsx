/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { BotaoVoltarAoMenu } from "../central-de-links/voltar-ao-menu";

describe("BotaoVoltarAoMenu", () => {
  it("é um link para o menu principal, no estilo do Voltar dos indicadores", () => {
    render(<BotaoVoltarAoMenu />);
    const link = screen.getByRole("link", { name: /voltar ao menu/i });
    expect(link.getAttribute("href")).toBe("/v2");
    expect(link.className).toContain("v2-voltar");
  });
});
