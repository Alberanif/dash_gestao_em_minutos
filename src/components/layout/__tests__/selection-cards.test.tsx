import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { SelectionCards } from "@/components/layout/selection-cards";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ── SelectionCards ────────────────────────────────────────────────────────────

describe("SelectionCards — email do usuário", () => {
  it("exibe o email passado via prop", () => {
    const html = render(
      <SelectionCards role="gestor" userEmail="gestor@igt.com" />
    );
    expect(html).toContain("gestor@igt.com");
  });
});

describe("SelectionCards — botão de logout", () => {
  it("contém form de logout com action /api/auth/signout e method post", () => {
    const html = render(
      <SelectionCards role="gestor" userEmail="x@x.com" />
    );
    expect(html).toContain('action="/api/auth/signout"');
    expect(html).toContain('method="post"');
  });
});

describe("SelectionCards — role: gestor", () => {
  let html: string;

  beforeAll(() => {
    html = render(<SelectionCards role="gestor" userEmail="gestor@igt.com" />);
  });

  it("Gestão à Vista é link acessível (href=/dashboard)", () => {
    expect(html).toContain('href="/dashboard"');
  });

  it("Indicadores leva à tela de eventos (href=/indicadores/eventos)", () => {
    expect(html).toContain('href="/indicadores/eventos"');
  });

  it("Indicadores NÃO aponta direto para o dashboard", () => {
    expect(html).not.toContain('href="/indicadores"');
  });

  it("Base de Dados é link acessível (href=/base-de-dados)", () => {
    expect(html).toContain('href="/base-de-dados"');
  });

  it("Ajustes é link acessível (href=/ajustes)", () => {
    expect(html).toContain('href="/ajustes"');
  });

  it("nenhum módulo é marcado como Restrito", () => {
    expect(html).not.toContain("Restrito");
  });

  it("Dash Ultimates é link acessível (href=/ultimates)", () => {
    expect(html).toContain('href="/ultimates"');
  });
});

describe("SelectionCards — role: analista", () => {
  let html: string;

  beforeAll(() => {
    html = render(
      <SelectionCards role="analista" userEmail="analista@igt.com" />
    );
  });

  it("Gestão à Vista NÃO é link (sem href=/dashboard)", () => {
    expect(html).not.toContain('href="/dashboard"');
  });

  it("Indicadores NÃO é link (sem href=/indicadores)", () => {
    expect(html).not.toContain('href="/indicadores');
  });

  it("Base de Dados é link acessível (href=/base-de-dados)", () => {
    expect(html).toContain('href="/base-de-dados"');
  });

  it("Ajustes é link acessível (href=/ajustes)", () => {
    expect(html).toContain('href="/ajustes"');
  });

  it("Dash Ultimates é link acessível (href=/ultimates)", () => {
    expect(html).toContain('href="/ultimates"');
  });

  it("módulos restritos exibem badge Restrito", () => {
    // Gestão à Vista e Indicadores são restritos — badge deve aparecer pelo menos 2 vezes
    const matches = html.match(/Restrito/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("SelectionCards — role: comum", () => {
  let html: string;

  beforeAll(() => {
    html = render(<SelectionCards role="comum" userEmail="comum@igt.com" />);
  });

  it("Gestão à Vista NÃO é link (sem href=/dashboard)", () => {
    expect(html).not.toContain('href="/dashboard"');
  });

  it("Indicadores NÃO é link (sem href=/indicadores)", () => {
    expect(html).not.toContain('href="/indicadores');
  });

  it("Base de Dados é link acessível (href=/base-de-dados)", () => {
    expect(html).toContain('href="/base-de-dados"');
  });

  it("Ajustes NÃO é link (sem href=/ajustes)", () => {
    expect(html).not.toContain('href="/ajustes"');
  });

  it("Dash Ultimates NÃO é link (sem href=/ultimates)", () => {
    expect(html).not.toContain('href="/ultimates"');
  });

  it("módulos restritos exibem badge Restrito", () => {
    // Gestão à Vista, Indicadores, Ajustes e Dash Ultimates são restritos — badge aparece pelo menos 4 vezes
    const matches = html.match(/Restrito/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});
