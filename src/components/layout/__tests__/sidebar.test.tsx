import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/posicionamento",
}));

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { NavLinks } from "@/components/layout/nav-links";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ── DashboardSidebar ──────────────────────────────────────────────────────────

describe("DashboardSidebar", () => {
  it("renderiza aside com className sidebar", () => {
    const html = render(<DashboardSidebar userEmail="test@test.com" role="gestor" />);
    expect(html).toContain('class="sidebar"');
  });

  it("renderiza sb-brand com logo IGT e título", () => {
    const html = render(<DashboardSidebar userEmail="test@test.com" role="gestor" />);
    expect(html).toContain("sb-brand");
    expect(html).toContain("sb-logo");
    expect(html).toContain("IGT");
    expect(html).toContain("Gestão à Vista");
  });

  it("renderiza sb-nav", () => {
    const html = render(<DashboardSidebar userEmail="test@test.com" role="gestor" />);
    expect(html).toContain("sb-nav");
  });

  it("renderiza sb-footer com email do usuário", () => {
    const html = render(<DashboardSidebar userEmail="alguem@igt.com" role="gestor" />);
    expect(html).toContain("sb-footer");
    expect(html).toContain("sb-footer");
    expect(html).toContain("alguem@igt.com");
  });

  it("renderiza link Trocar módulo apontando para /dashboard", () => {
    const html = render(<DashboardSidebar userEmail="x@x.com" role="gestor" />);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Trocar módulo");
  });

  it("renderiza form de logout com action /api/auth/signout method post", () => {
    const html = render(<DashboardSidebar userEmail="x@x.com" role="gestor" />);
    expect(html).toContain('action="/api/auth/signout"');
    expect(html).toContain('method="post"');
    expect(html).toContain("icon-btn");
  });

  it("não tem botão de toggle/collapse", () => {
    const html = render(<DashboardSidebar userEmail="x@x.com" role="gestor" />);
    expect(html).not.toContain("Colapsar");
    expect(html).not.toContain("Expandir");
    expect(html).not.toContain("sidebar-collapsed");
  });

  it("não usa variáveis --color-*", () => {
    const html = render(<DashboardSidebar userEmail="x@x.com" role="gestor" />);
    expect(html).not.toContain("--color-");
  });
});

// ── NavLinks ──────────────────────────────────────────────────────────────────

describe("NavLinks", () => {
  it("renderiza 7 links", () => {
    const html = render(<NavLinks />);
    const matches = html.match(/class="nav-link/g) ?? [];
    expect(matches.length).toBe(7);
  });

  it("link ativo tem className nav-link active", () => {
    const html = render(<NavLinks />);
    expect(html).toContain("nav-link active");
  });

  it("links inativos têm className nav-link sem active", () => {
    const html = render(<NavLinks />);
    const withoutActive = html.replace(/nav-link active/g, "");
    const inactive = (withoutActive.match(/nav-link(?! active)/g) ?? []).length;
    expect(inactive).toBe(6);
  });

  it("renderiza todos os 7 labels de módulo", () => {
    const html = render(<NavLinks />);
    expect(html).toContain("Posicionamento");
    expect(html).toContain("Relacionamento");
    expect(html).toContain("Prestar Atenção");
    expect(html).toContain("EQA");
    expect(html).toContain("Convite");
    expect(html).toContain("Entrega Nível A");
    expect(html).toContain("LTV");
  });

  it("renderiza todos os 7 hrefs de módulo", () => {
    const html = render(<NavLinks />);
    expect(html).toContain("/dashboard/posicionamento");
    expect(html).toContain("/dashboard/relacionamento");
    expect(html).toContain("/dashboard/prestar-atencao");
    expect(html).toContain("/dashboard/eqa");
    expect(html).toContain("/dashboard/convite");
    expect(html).toContain("/dashboard/entrega-nivel-a");
    expect(html).toContain("/dashboard/ltv");
  });

  it("ícones SVG têm width e height 14", () => {
    const html = render(<NavLinks />);
    const svgMatches = html.match(/width="14" height="14"/g) ?? [];
    expect(svgMatches.length).toBe(7);
  });

  it("não tem prop collapsed", () => {
    // NavLinks não deve aceitar prop collapsed — sem collapsed no output
    const html = render(<NavLinks />);
    expect(html).not.toContain("collapsed");
  });
});
