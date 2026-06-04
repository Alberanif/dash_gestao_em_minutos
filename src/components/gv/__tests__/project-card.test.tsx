import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectCard } from "@/components/gv/project-card";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("ProjectCard", () => {
  const base = {
    name: "Projeto Alpha",
    start: "2026-01-01",
    end: "2026-06-30",
    mainMetric: "Receita",
    value: "R$ 50k",
    subMetric: "ROAS",
    sub: "3.5",
    status: "green" as const,
  };

  it("renderiza name, mainMetric e value", () => {
    const html = render(React.createElement(ProjectCard, base));
    expect(html).toContain("Projeto Alpha");
    expect(html).toContain("Receita");
    expect(html).toContain("R$ 50k");
  });

  it("status green: html contém a borderColor rgba verde", () => {
    const html = render(React.createElement(ProjectCard, { ...base, status: "green" }));
    expect(html).toContain("rgba(26,185,108,.3)");
  });

  it("status amber: html contém a borderColor rgba âmbar", () => {
    const html = render(React.createElement(ProjectCard, { ...base, status: "amber" }));
    expect(html).toContain("rgba(217,149,18,.3)");
  });

  it("status red: html contém a borderColor rgba vermelha", () => {
    const html = render(React.createElement(ProjectCard, { ...base, status: "red" }));
    expect(html).toContain("rgba(224,66,66,.3)");
  });

  it("sparkline container renderiza apenas quando sparkData fornecido", () => {
    const withoutSpark = render(React.createElement(ProjectCard, base));
    expect(withoutSpark).not.toContain('class="spark"');

    const withSpark = render(
      React.createElement(ProjectCard, { ...base, sparkData: [10, 20, 15, 30] })
    );
    expect(withSpark).toContain('class="spark"');
  });

  it("card tem 'clickable' no className", () => {
    const html = render(React.createElement(ProjectCard, base));
    expect(html).toContain("clickable");
  });
});
