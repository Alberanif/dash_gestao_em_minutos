import { renderToStaticMarkup } from "react-dom/server";
import { CockpitTile } from "@/components/gv/cockpit-tile";
import React from "react";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("CockpitTile", () => {
  it("severity 'critical' adds class 'ctile red'", () => {
    const html = render(
      CockpitTile({ severity: "critical", label: "Crítico", value: "Reels ↓ 22%", description: "Queda forte" })
    );
    expect(html).toContain("ctile red");
  });

  it("severity 'attention' adds class 'ctile amber'", () => {
    const html = render(
      CockpitTile({ severity: "attention", label: "Atenção", value: "CPL ↑ 15%", description: "Acima do limite" })
    );
    expect(html).toContain("ctile amber");
  });

  it("severity 'ok' adds class 'ctile green'", () => {
    const html = render(
      CockpitTile({ severity: "ok", label: "Ok", value: "ROAS 4.2", description: "Dentro do alvo" })
    );
    expect(html).toContain("ctile green");
  });

  it("renders label and value in DOM", () => {
    const html = render(
      CockpitTile({ severity: "ok", label: "Estável", value: "CPL R$12", description: "Dentro do alvo" })
    );
    expect(html).toContain("Estável");
    expect(html).toContain("CPL R$12");
  });

  it("renders footer when owner, actionLabel and actionHref are all present", () => {
    const html = render(
      CockpitTile({
        severity: "critical",
        label: "Crítico",
        value: "Reels ↓ 22%",
        description: "Queda forte",
        owner: "João",
        actionLabel: "Ver plano",
        actionHref: "/plano",
      })
    );
    expect(html).toContain("João");
    expect(html).toContain("Ver plano");
    expect(html).toContain('href="/plano"');
    expect(html).toContain("crow");
  });

  it("does not render footer when owner is omitted", () => {
    const html = render(
      CockpitTile({
        severity: "critical",
        label: "Crítico",
        value: "Reels ↓ 22%",
        description: "Queda forte",
        actionLabel: "Ver plano",
        actionHref: "/plano",
      })
    );
    expect(html).not.toContain("crow");
    expect(html).not.toContain("Ver plano");
  });
});
