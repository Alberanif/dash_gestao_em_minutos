import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HealthCard } from "@/components/gv/health-card";

const C = 2 * Math.PI * 38;

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

const baseProps = {
  platform: "yt" as const,
  name: "Canal YT",
  score: 75,
  status: "green" as const,
  headline: "Performance geral boa",
  rows: [
    { label: "CTR", help: "Click-through rate", value: "4.2%", status: "green" as const },
    { label: "Retenção", help: "Avg view duration", value: "42%", status: "amber" as const },
  ],
};

describe("HealthCard", () => {
  it("score 0: strokeDashoffset igual a C (anel vazio)", () => {
    const html = render(React.createElement(HealthCard, { ...baseProps, score: 0 }));
    expect(html).toContain(String(C));
  });

  it("score 100: strokeDashoffset igual a 0", () => {
    const html = render(React.createElement(HealthCard, { ...baseProps, score: 100 }));
    expect(html).toContain("stroke-dashoffset=\"0\"");
  });

  it("score 50: strokeDashoffset igual a C/2", () => {
    const html = render(React.createElement(HealthCard, { ...baseProps, score: 50 }));
    expect(html).toContain(String(C / 2));
  });

  it("status green: stroke inclui var(--gn)", () => {
    const html = render(React.createElement(HealthCard, { ...baseProps, status: "green" }));
    expect(html).toContain("var(--gn)");
  });

  it("renderiza todas as rows passadas", () => {
    const html = render(React.createElement(HealthCard, { ...baseProps }));
    expect(html).toContain("CTR");
    expect(html).toContain("Retenção");
    expect(html).toContain("4.2%");
    expect(html).toContain("42%");
  });

  it("headline renderizado no DOM", () => {
    const html = render(React.createElement(HealthCard, { ...baseProps }));
    expect(html).toContain("Performance geral boa");
  });
});
