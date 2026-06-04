import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("a", null, children),
}));

import { FunnelCard } from "@/components/gv/funnel-card";
import { EventCard } from "@/components/gv/event-card";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

const baseSteps = [
  { label: "Leads", value: 1000, conv: 100 },
  { label: "Qualif", value: 300, conv: 30 },
  { label: "Proposta", value: 50, conv: 17 },
];

describe("FunnelCard", () => {
  it("renders label inside fbar when conv >= 18", () => {
    const html = render(
      <FunnelCard
        name="Funil Teste"
        period="Mai 2026"
        steps={baseSteps}
        status="green"
        verdict="Tudo certo"
      />
    );
    const fbarMatches = html.match(/class="fbar[^"]*"/g) ?? [];
    expect(fbarMatches[0]).toContain("fbar");
    expect(html).toContain(">Leads<");
    expect(html).toContain(">Qualif<");
  });

  it("does not render label inside fbar when conv < 18", () => {
    const html = render(
      <FunnelCard
        name="Funil Teste"
        period="Mai 2026"
        steps={baseSteps}
        status="amber"
        verdict="Atenção"
      />
    );
    const fbarSection = html.match(/class="fbar[^"]*"[^>]*>([^<]*)</)?.[1] ?? "";
    const propostoFbar = html.match(/fbar[^>]*>([^<]{0,30})<\/div>/g) ?? [];
    const lastFbar = propostoFbar[propostoFbar.length - 1] ?? "";
    expect(lastFbar).not.toContain("Proposta");
  });

  it("applies muted class to fbar when conv < 30", () => {
    const html = render(
      <FunnelCard
        name="Funil Teste"
        period="Mai 2026"
        steps={baseSteps}
        status="amber"
        verdict="Atenção"
      />
    );
    expect(html).toContain("fbar muted");
  });

  it("renders verdict in .tip", () => {
    const html = render(
      <FunnelCard
        name="Funil Teste"
        period="Mai 2026"
        steps={baseSteps}
        status="green"
        verdict="Conversão acima da meta"
      />
    );
    expect(html).toContain("Conversão acima da meta");
    expect(html).toContain('class="tip"');
  });

  it("sets width style on fbar equal to conv%", () => {
    const html = render(
      <FunnelCard
        name="Funil Teste"
        period="Mai 2026"
        steps={[{ label: "Leads", value: 500, conv: 45 }]}
        status="green"
        verdict="OK"
      />
    );
    expect(html).toContain("width:45%");
  });
});

describe("EventCard", () => {
  it("renders conv value with var(--gn) color when conv >= target", () => {
    const html = render(
      <EventCard
        name="Evento Teste"
        date="15 Jun 2026"
        presence={80}
        conv={35}
        target={30}
        status="green"
      />
    );
    expect(html).toContain("var(--gn)");
    expect(html).toContain("35%");
  });

  it("renders conv value with var(--rd) color when conv < target", () => {
    const html = render(
      <EventCard
        name="Evento Teste"
        date="15 Jun 2026"
        presence={60}
        conv={20}
        target={30}
        status="amber"
      />
    );
    expect(html).toContain("var(--rd)");
    expect(html).toContain("20%");
  });
});
