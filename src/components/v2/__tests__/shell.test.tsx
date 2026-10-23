/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { V2Shell } from "../shell";
import { DESTINOS, ROTULO_EM_BREVE, destinoAtivo, tituloDaRota } from "../shell/nav-config";
import { mockReducedMotion } from "./helpers";

let pathnameAtual = "/v2";
jest.mock("next/navigation", () => ({ usePathname: () => pathnameAtual }));

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  pathnameAtual = "/v2";
  mockReducedMotion(false);
});

function renderShell() {
  return render(
    <V2Shell userEmail="gestor@igt.com">
      <p>conteúdo da página</p>
    </V2Shell>,
  );
}

describe("destinos de navegação", () => {
  it("só o Indicadores é destino ativo; as demais áreas não têm link", () => {
    const comLink = DESTINOS.filter((d) => d.href);
    expect(comLink.map((d) => d.id)).toEqual(["indicadores"]);
    expect(DESTINOS.filter((d) => !d.href).length).toBeGreaterThanOrEqual(5);
  });

  it("nenhum destino aponta para fora do /v2 (nunca para o V1)", () => {
    for (const d of DESTINOS) if (d.href) expect(d.href.startsWith("/v2")).toBe(true);
  });

  it("marca o Indicadores como ativo na home e nas rotas de indicadores", () => {
    const ind = DESTINOS[0];
    expect(destinoAtivo(ind, "/v2")).toBe(true);
    expect(destinoAtivo(ind, "/v2/")).toBe(true);
    expect(destinoAtivo(ind, "/v2/indicadores/eventos")).toBe(true);
    expect(destinoAtivo(ind, "/v2/_kit")).toBe(false);
    expect(destinoAtivo(DESTINOS[1], "/v2")).toBe(false);
  });

  it("dá título ao cabeçalho por rota", () => {
    expect(tituloDaRota("/v2")).toBe("Indicadores");
    expect(tituloDaRota("/v2/indicadores/eventos")).toBe("Indicadores");
    expect(tituloDaRota("/v2/_kit")).toBe("Kit de componentes");
    expect(tituloDaRota("/v2/outra")).toBe("Dash V2");
  });
});

describe("V2Shell", () => {
  it("mostra o título da rota e o conteúdo, com o landmark principal", () => {
    renderShell();
    expect(screen.getByRole("heading", { level: 1, name: "Indicadores" })).toBeTruthy();
    expect(within(screen.getByRole("main")).getByText("conteúdo da página")).toBeTruthy();
  });

  it("anuncia o item ativo com aria-current=page (trilho e barra de abas)", () => {
    renderShell();
    const ativos = screen
      .getAllByRole("link", { name: /Indicadores/ })
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(ativos).toHaveLength(2);
    ativos.forEach((a) => expect(a.getAttribute("href")).toBe("/v2"));
  });

  it("não marca o Indicadores como ativo em outra rota", () => {
    pathnameAtual = "/v2/_kit";
    renderShell();
    expect(screen.getByRole("heading", { level: 1, name: "Kit de componentes" })).toBeTruthy();
    for (const a of screen.getAllByRole("link", { name: /Indicadores/ })) {
      expect(a.getAttribute("aria-current")).toBeNull();
    }
  });

  it("áreas ainda não migradas ficam desabilitadas, rotuladas Em breve e sem link", () => {
    renderShell();
    const trilho = screen.getAllByRole("navigation", { name: "Áreas do dashboard" })[0];
    const desabilitados = trilho.querySelectorAll('[aria-disabled="true"]');
    expect(desabilitados.length).toBe(DESTINOS.filter((d) => !d.href).length);
    desabilitados.forEach((el) => {
      expect(el.closest("a")).toBeNull();
      expect(el.textContent).toContain(ROTULO_EM_BREVE);
    });
  });

  it("todo link do shell fica dentro do /v2", () => {
    renderShell();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href")!;
      expect(href.startsWith("/v2") || href.startsWith("#")).toBe(true);
    }
  });

  it("recolher e expandir o trilho alterna aria-expanded e o estado do trilho", () => {
    renderShell();
    const rail = document.querySelector("aside")!;
    expect(rail.hasAttribute("data-expandido")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Recolher navegação" }));
    expect(rail.hasAttribute("data-expandido")).toBe(false);
    const volta = screen.getByRole("button", { name: "Expandir navegação" });
    expect(volta.getAttribute("aria-expanded")).toBe("false");
  });

  it("oferece o atalho para pular ao conteúdo", () => {
    renderShell();
    const pular = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(pular.getAttribute("href")).toBe("#conteudo");
    expect(screen.getByRole("main").id).toBe("conteudo");
  });

  it("sair é um POST para o mesmo endpoint do V1", () => {
    renderShell();
    const form = document.querySelector('form[action="/api/auth/signout"]') as HTMLFormElement;
    expect(form.method).toBe("post");
  });

  it("os itens do shell têm anel de foco visível", () => {
    renderShell();
    for (const a of screen.getAllByRole("link", { name: /Indicadores/ })) {
      expect(a.className).toContain("focus-visible:outline-2");
    }
  });

  it("a página entra pela animação CSS v2-entra (opacity e transform)", () => {
    renderShell();
    const pagina = screen.getByText("conteúdo da página").parentElement as HTMLElement;
    expect(pagina.className).toContain("v2-entra");
  });

  it("com movimento reduzido o CSS desliga a entrada da página", () => {
    const css = readFileSync(join(__dirname, "../ui/ui.css"), "utf8");
    const reduzido = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduzido).toMatch(/\.v2 \.v2-entra\s*\{\s*animation: none !important/);
  });
});
