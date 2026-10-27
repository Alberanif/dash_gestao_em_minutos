/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { BotaoVoltar, DURACAO_SAIDA } from "../evento/voltar";
import { mockReducedMotion } from "./helpers";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  jest.useFakeTimers();
  push.mockClear();
  mockReducedMotion(false);
  delete document.documentElement.dataset.v2Volta;
});
afterEach(() => jest.useRealTimers());

function renderPagina() {
  return render(
    <div data-pagina-evento>
      <BotaoVoltar />
    </div>,
  );
}

describe("BotaoVoltar", () => {
  it("aponta para a escolha de eventos", () => {
    renderPagina();
    expect(screen.getByRole("link", { name: "Voltar aos eventos" }).getAttribute("href")).toBe("/v2/indicadores/eventos");
  });

  it("a cópia escura do texto, usada no hover, fica fora da leitura de tela", () => {
    const { container } = renderPagina();
    expect(container.querySelector(".v2-voltar-texto-escuro")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("o clique afasta o dashboard (zoom out) e só depois navega, uma vez", () => {
    const { container } = renderPagina();
    const link = screen.getByRole("link", { name: "Voltar aos eventos" });
    fireEvent.click(link);
    fireEvent.click(link);
    expect(container.querySelector("[data-pagina-evento]")?.hasAttribute("data-saindo")).toBe(true);
    expect(document.documentElement.hasAttribute("data-v2-volta")).toBe(true);
    expect(push).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(DURACAO_SAIDA.completo);
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/v2/indicadores/eventos");
  });

  it("Ctrl+clique segue o link nativo", () => {
    renderPagina();
    fireEvent.click(screen.getByRole("link", { name: "Voltar aos eventos" }), { ctrlKey: true });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("com movimento reduzido navega na hora, sem animação", () => {
    mockReducedMotion(true);
    const { container } = renderPagina();
    fireEvent.click(screen.getByRole("link", { name: "Voltar aos eventos" }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-pagina-evento]")?.hasAttribute("data-saindo")).toBe(false);
  });
});
