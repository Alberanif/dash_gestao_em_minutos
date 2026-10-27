/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { BotaoVoltarIcone } from "../ui/voltar-icone";

describe("BotaoVoltarIcone", () => {
  it("é um link com nome acessível que aponta para a tela anterior", () => {
    render(<BotaoVoltarIcone href="/v2" rotulo="Voltar ao menu" />);
    expect(screen.getByRole("link", { name: "Voltar ao menu" }).getAttribute("href")).toBe("/v2");
  });

  it("a seta é decorativa e não há texto visível", () => {
    const { container } = render(<BotaoVoltarIcone href="/v2" rotulo="Voltar ao menu" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".v2-voltar-icone-moldura")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.textContent).toBe("");
  });
});
