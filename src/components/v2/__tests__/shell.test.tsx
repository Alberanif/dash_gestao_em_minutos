/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { V2Shell } from "../shell";
import { tituloDaRota } from "../shell/nav-config";
import { mockReducedMotion } from "./helpers";

let pathnameAtual = "/v2/indicadores";
jest.mock("next/navigation", () => ({ usePathname: () => pathnameAtual }));

beforeEach(() => {
  pathnameAtual = "/v2/indicadores";
  mockReducedMotion(false);
});

function renderShell() {
  return render(
    <V2Shell>
      <p>conteúdo da página</p>
    </V2Shell>,
  );
}

describe("título da rota", () => {
  it("dá título ao cabeçalho por rota", () => {
    expect(tituloDaRota("/v2/indicadores")).toBe("Indicadores");
    expect(tituloDaRota("/v2/indicadores/")).toBe("Indicadores");
    expect(tituloDaRota("/v2/indicadores/eventos")).toBe("Indicadores");
    expect(tituloDaRota("/v2/_kit")).toBe("Kit de componentes");
    expect(tituloDaRota("/v2/central-de-links")).toBe("Central de links");
    expect(tituloDaRota("/v2/indicadores/testes-ab")).toBe("Testes A/B");
    expect(tituloDaRota("/v2/indicadores/testes-ab/abc/")).toBe("Testes A/B");
    expect(tituloDaRota("/v2/indicadores/testes-abx")).toBe("Indicadores");
    expect(tituloDaRota("/v2/central-de-linksx")).toBe("Dash V2");
    expect(tituloDaRota("/v2/outra")).toBe("Dash V2");
  });
});

describe("V2Shell", () => {
  it("mostra o título da rota e o conteúdo, com o landmark principal", () => {
    renderShell();
    expect(screen.getByRole("heading", { level: 1, name: "Indicadores" })).toBeTruthy();
    expect(within(screen.getByRole("main")).getByText("conteúdo da página")).toBeTruthy();
  });

  it("não tem barra lateral, barra de abas nem navegação própria", () => {
    renderShell();
    expect(document.querySelector("aside")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(document.querySelector('form[action="/api/auth/signout"]')).toBeNull();
  });

  it("oferece o atalho para pular ao conteúdo", () => {
    renderShell();
    const pular = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(pular.getAttribute("href")).toBe("#conteudo");
    expect(screen.getByRole("main").id).toBe("conteudo");
  });

  it("a página entra pela animação CSS v2-entra (opacity e transform)", () => {
    renderShell();
    const pagina = screen.getByText("conteúdo da página").parentElement as HTMLElement;
    expect(pagina.className).toContain("v2-entra");
  });

  it("com movimento reduzido o CSS desliga a entrada da página", () => {
    const css = readFileSync(join(__dirname, "../ui/ui.css"), "utf8");
    const reduzido = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    // A entrada da página, a dos blocos, o desenho dos gráficos e o brilho do esqueleto saem da mesma regra.
    for (const alvo of [".v2 .v2-entra", ".v2 .v2-entra-bloco", ".v2 .v2-g", ".v2 .v2-esq::after"]) {
      expect(reduzido).toContain(alvo);
    }
    expect(reduzido).toMatch(/\{\s*animation: none !important/);
  });
});
