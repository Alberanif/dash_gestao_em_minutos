import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { NarrLabel } from "../narr-label";
import { PulseBanner } from "../pulse-banner";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ── NarrLabel ─────────────────────────────────────────────────────────────────

describe("NarrLabel", () => {
  it("renderiza step e label", () => {
    const html = render(NarrLabel({ step: "01", label: "Leads Captados" }));
    expect(html).toContain("01");
    expect(html).toContain("Leads Captados");
  });

  it("renderiza desc quando fornecido", () => {
    const html = render(
      NarrLabel({ step: "02", label: "Conversão", desc: "Taxa de conversão do funil" })
    );
    expect(html).toContain("Taxa de conversão do funil");
    expect(html).toContain('class="nd"');
    expect(html).toContain('class="ndesc"');
  });

  it("não renderiza .nd e .ndesc quando desc é omitido", () => {
    const html = render(NarrLabel({ step: "01", label: "Leads Captados" }));
    expect(html).not.toContain('class="nd"');
    expect(html).not.toContain('class="ndesc"');
  });

  it("usa as classes corretas (.narr, .ns, .nl)", () => {
    const html = render(NarrLabel({ step: "03", label: "Vendas" }));
    expect(html).toContain('class="narr"');
    expect(html).toContain('class="ns"');
    expect(html).toContain('class="nl"');
  });
});

// ── PulseBanner ───────────────────────────────────────────────────────────────

const chips = [
  { label: "Meta Ads", status: "green" as const },
  { label: "Hotmart", status: "amber" as const },
  { label: "Orgânico", status: "muted" as const },
];

describe("PulseBanner", () => {
  it("renderiza headline e sub", () => {
    const html = render(
      PulseBanner({ status: "green", headline: "Tudo certo", sub: "Todas as fontes ativas", chips })
    );
    expect(html).toContain("Tudo certo");
    expect(html).toContain("Todas as fontes ativas");
  });

  it("aplica --pc com var(--gn) para status green", () => {
    const html = render(
      PulseBanner({ status: "green", headline: "OK", sub: "sub", chips: [] })
    );
    expect(html).toContain("var(--gn)");
  });

  it("aplica --pc com var(--am) para status amber", () => {
    const html = render(
      PulseBanner({ status: "amber", headline: "Atenção", sub: "sub", chips: [] })
    );
    expect(html).toContain("var(--am)");
  });

  it("aplica --pc com var(--rd) para status red", () => {
    const html = render(
      PulseBanner({ status: "red", headline: "Crítico", sub: "sub", chips: [] })
    );
    expect(html).toContain("var(--rd)");
  });

  it("renderiza todos os chips com o status correto", () => {
    const html = render(
      PulseBanner({ status: "green", headline: "OK", sub: "sub", chips })
    );
    expect(html).toContain("Meta Ads");
    expect(html).toContain("Hotmart");
    expect(html).toContain("Orgânico");
    expect(html).toContain("pchip green");
    expect(html).toContain("pchip amber");
    expect(html).toContain("pchip muted");
  });

  it("exibe ícone SVG checkmark para status green", () => {
    const html = render(
      PulseBanner({ status: "green", headline: "OK", sub: "sub", chips: [] })
    );
    expect(html).toContain("pulse-icon");
    expect(html).toContain("<svg");
    expect(html).toContain("polyline");
  });

  it("exibe ícone SVG triângulo para status amber", () => {
    const html = render(
      PulseBanner({ status: "amber", headline: "Atenção", sub: "sub", chips: [] })
    );
    expect(html).toContain("pulse-icon");
    expect(html).toContain("<svg");
    expect(html).toContain("M10.29");
  });

  it("exibe ícone SVG triângulo para status red", () => {
    const html = render(
      PulseBanner({ status: "red", headline: "Crítico", sub: "sub", chips: [] })
    );
    expect(html).toContain("pulse-icon");
    expect(html).toContain("<svg");
    expect(html).toContain("M10.29");
  });

  it("usa as classes corretas (.pulse, .pulse-icon, .pulse-txt, .pulse-sum, .pchip, .dot)", () => {
    const html = render(
      PulseBanner({ status: "green", headline: "OK", sub: "sub", chips: [{ label: "X", status: "green" }] })
    );
    expect(html).toContain('class="pulse"');
    expect(html).toContain("pulse-icon");
    expect(html).toContain("pulse-txt");
    expect(html).toContain("pulse-sum");
    expect(html).toContain("pchip");
    expect(html).toContain('class="dot"');
  });
});
