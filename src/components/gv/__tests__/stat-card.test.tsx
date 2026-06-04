import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatCard } from "../stat-card";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

const baseProps = {
  icon: React.createElement("span", null, "IC"),
  title: "Leads",
  value: "1.234",
  status: "green" as const,
  foot: "vs período anterior",
};

describe("StatCard", () => {
  it("renderiza title e value", () => {
    const html = render(React.createElement(StatCard, baseProps));
    expect(html).toContain("Leads");
    expect(html).toContain("1.234");
  });

  it("status green: html contém 'kc green'", () => {
    const html = render(React.createElement(StatCard, { ...baseProps, status: "green" }));
    expect(html).toContain("kc green");
  });

  it("status amber: html contém 'kc amber'", () => {
    const html = render(React.createElement(StatCard, { ...baseProps, status: "amber" }));
    expect(html).toContain("kc amber");
  });

  it("status red: html contém 'kc red'", () => {
    const html = render(React.createElement(StatCard, { ...baseProps, status: "red" }));
    expect(html).toContain("kc red");
  });

  it("DeltaBadge renderiza apenas quando delta é fornecido", () => {
    const html = render(React.createElement(StatCard, { ...baseProps, delta: 5.2 }));
    expect(html).toContain("dbadge");
  });

  it("DeltaBadge não renderiza quando delta é omitido", () => {
    const html = render(React.createElement(StatCard, baseProps));
    expect(html).not.toContain("dbadge");
  });

  it("foot HTML renderizado no meta", () => {
    const html = render(
      React.createElement(StatCard, { ...baseProps, foot: "Meta: <b>500</b>" })
    );
    expect(html).toContain("kc-meta");
    expect(html).toContain("<b>500</b>");
  });
});
