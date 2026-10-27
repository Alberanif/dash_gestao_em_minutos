/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MenuIndicadores } from "../indicadores/menu";
import { ITENS_DO_MENU, itensVisiveis } from "../indicadores/itens";
import { DURACAO_ENTRADA, calcularZoom, cliqueSimples } from "../indicadores/entrada-zoom";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/v2/indicadores" }));

beforeEach(() => {
  jest.useFakeTimers();
  push.mockClear();
  mockReducedMotion(false);
  // O jsdom não tem layout: o card informa uma caixa fixa.
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 100, top: 100, width: 288, height: 352, right: 388, bottom: 452, x: 100, y: 100, toJSON: () => ({}),
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function renderMenu(papelCentral: "admin" | "membro" | null = null) {
  return render(
    <V2Root>
      <MenuIndicadores papelCentral={papelCentral} />
    </V2Root>,
  );
}

describe("itens do menu", () => {
  it("Funis e depois Testes A/B, cada um com seu endereço", () => {
    expect(ITENS_DO_MENU.map((i) => i.titulo)).toEqual(["Funis", "Testes A/B"]);
    expect(ITENS_DO_MENU[0].href).toBe("/v2/indicadores/eventos");
    expect(ITENS_DO_MENU[1].href).toBe("/v2/indicadores/testes-ab");
  });

  it("o Testes A/B só é visível para quem tem papel na Central", () => {
    expect(itensVisiveis(null).map((i) => i.titulo)).toEqual(["Funis"]);
    expect(itensVisiveis("membro").map((i) => i.titulo)).toEqual(["Funis", "Testes A/B"]);
    expect(itensVisiveis("admin").map((i) => i.titulo)).toEqual(["Funis", "Testes A/B"]);
  });
});

describe("entrada-zoom", () => {
  it("leva o centro do card ao centro da janela e cobre a janela com escala uniforme", () => {
    const z = calcularZoom({ left: 100, top: 100, width: 200, height: 300 }, { width: 1000, height: 800 });
    expect(z.dx).toBe(500 - 200);
    expect(z.dy).toBe(400 - 250);
    // 1000/200 = 5 é maior que 800/300: a largura manda; margem de 8% para não sobrar borda
    expect(z.escala).toBeCloseTo(5 * 1.08);
  });

  it("só o clique simples é interceptado", () => {
    const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(cliqueSimples(base)).toBe(true);
    expect(cliqueSimples({ ...base, ctrlKey: true })).toBe(false);
    expect(cliqueSimples({ ...base, metaKey: true })).toBe(false);
    expect(cliqueSimples({ ...base, button: 1 })).toBe(false);
  });

  it("a aproximação é mais curta em aparelho fraco e mais curta ainda com movimento reduzido", () => {
    expect(DURACAO_ENTRADA.completo).toBeGreaterThan(DURACAO_ENTRADA.curto);
    expect(DURACAO_ENTRADA.curto).toBeGreaterThan(DURACAO_ENTRADA.reduzido);
  });
});

describe("MenuIndicadores", () => {
  it("mostra o card Funis como link para os eventos, com a descrição no DOM", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /Funis/ });
    expect(link.getAttribute("href")).toBe("/v2/indicadores/eventos");
    expect(screen.getByText("Acompanhe cada evento: leads, vendas e conversão.")).toBeTruthy();
  });

  it("no clique abre a aproximação e só navega quando ela termina", () => {
    const { container } = renderMenu();
    fireEvent.click(screen.getByRole("link", { name: /Funis/ }));
    expect(container.querySelector(".v2-entrada")).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(DURACAO_ENTRADA.completo - 1);
    });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/v2/indicadores/eventos");
  });

  it("Espaço entra no card como o Enter (que já dispara o clique do link)", () => {
    renderMenu();
    fireEvent.keyDown(screen.getByRole("link", { name: /Funis/ }), { key: " " });
    act(() => {
      jest.advanceTimersByTime(DURACAO_ENTRADA.completo);
    });
    expect(push).toHaveBeenCalledWith("/v2/indicadores/eventos");
  });

  it("clique repetido durante a aproximação navega uma vez só", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /Funis/ });
    fireEvent.click(link);
    fireEvent.click(link);
    act(() => {
      jest.advanceTimersByTime(DURACAO_ENTRADA.completo * 2);
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+clique segue o link nativo, sem aproximação", () => {
    const { container } = renderMenu();
    fireEvent.click(screen.getByRole("link", { name: /Funis/ }), { ctrlKey: true });
    expect(container.querySelector(".v2-entrada")).toBeNull();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("com movimento reduzido a navegação é quase imediata e o zoom não é desenhado", () => {
    mockReducedMotion(true);
    const { container } = renderMenu();
    fireEvent.click(screen.getByRole("link", { name: /Funis/ }));
    expect(container.querySelector(".v2-entrada")?.getAttribute("data-perfil")).toBe("reduzido");
    act(() => {
      jest.advanceTimersByTime(DURACAO_ENTRADA.reduzido);
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("não navega se o menu sair da tela durante a aproximação", () => {
    const { unmount } = renderMenu();
    fireEvent.click(screen.getByRole("link", { name: /Funis/ }));
    unmount();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(push).not.toHaveBeenCalled();
  });
});

describe("rotas", () => {
  const raiz = join(__dirname, "../../../..");
  const ler = (rel: string) => readFileSync(join(raiz, rel), "utf8");

  it("/v2 mostra o menu principal, sem redirecionar", () => {
    const src = ler("src/app/v2/page.tsx");
    expect(src).toContain("<MenuPrincipal");
    expect(src).not.toContain("redirect(");
  });

  it("/v2/indicadores titula a aba como Indicadores", () => {
    expect(ler("src/app/v2/indicadores/page.tsx")).toContain('title: "Indicadores"');
  });
});

describe("card Testes A/B no menu", () => {
  it("sem papel na Central o card não aparece", () => {
    renderMenu(null);
    expect(screen.queryByRole("link", { name: /Testes A\/B/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Funis/ })).toBeTruthy();
  });

  it.each(["membro", "admin"] as const)("com papel %s aparece como link, com a descrição e a arte própria", (papel) => {
    const { container } = renderMenu(papel);
    const link = screen.getByRole("link", { name: /Testes A\/B/ });
    expect(link.getAttribute("href")).toBe("/v2/indicadores/testes-ab");
    expect(link.textContent).toContain("Compare versões de uma página e veja qual converte mais.");
    expect(container.querySelector('svg[aria-label^="Prévia da tela de testes A/B"]')).toBeTruthy();
    expect(container.querySelectorAll('svg[aria-label^="Prévia da tela de funis"]')).toHaveLength(1);
  });

  it("o clique entra no card com a arte dele e navega para o endereço novo", () => {
    renderMenu("admin");
    fireEvent.click(screen.getByRole("link", { name: /Testes A\/B/ }));
    expect(document.querySelectorAll('svg[aria-label^="Prévia da tela de testes A/B"]')).toHaveLength(2);
    act(() => {
      jest.advanceTimersByTime(DURACAO_ENTRADA.completo);
    });
    expect(push).toHaveBeenCalledWith("/v2/indicadores/testes-ab");
  });
});
