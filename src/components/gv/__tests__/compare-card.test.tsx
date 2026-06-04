import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompareCard } from "@/components/gv/compare-card";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

const baseProps = {
  platform: "yt" as const,
  name: "YouTube",
  metric: "Inscritos",
  prevLabel: "Jan/25",
  currLabel: "Fev/25",
  prevValue: 10000,
  currValue: 12000,
  status: "green" as const,
  verdict: "Crescimento <b>forte</b>",
};

describe("CompareCard", () => {
  it("renderiza name e metric", () => {
    const html = render(<CompareCard {...baseProps} />);
    expect(html).toContain("YouTube");
    expect(html).toContain("Inscritos");
  });

  it("status green: html contém cc green", () => {
    const html = render(<CompareCard {...baseProps} status="green" />);
    expect(html).toContain("cc green");
  });

  it("status amber: html contém cc amber", () => {
    const html = render(<CompareCard {...baseProps} status="amber" />);
    expect(html).toContain("cc amber");
  });

  it("status red: html contém cc red", () => {
    const html = render(<CompareCard {...baseProps} status="red" />);
    expect(html).toContain("cc red");
  });

  it("tag CURR tem classe do status", () => {
    const html = render(<CompareCard {...baseProps} status="green" />);
    expect(html).toContain("cc-tag curr green");
  });

  it("renderiza sem sparklines quando não fornecidas", () => {
    const html = render(<CompareCard {...baseProps} />);
    expect(html).not.toContain("cc-spark");
  });

  it("usa tags ANTERIOR e CRESCENDO/CAINDO no lugar de PREV/CURR", () => {
    const htmlGreen = render(<CompareCard {...baseProps} status="green" />);
    expect(htmlGreen).toContain("ANTERIOR");
    expect(htmlGreen).toContain("CRESCENDO");

    const htmlRed = render(<CompareCard {...baseProps} status="red" />);
    expect(htmlRed).toContain("CAINDO");
  });

  it("exibe DeltaBadge no footer", () => {
    const html = render(<CompareCard {...baseProps} prevValue={10000} currValue={12000} />);
    expect(html).toContain("dbadge");
    expect(html).toContain("20");
  });

  it("veredito renderizado no footer", () => {
    const html = render(<CompareCard {...baseProps} verdict="Crescimento <b>forte</b>" />);
    expect(html).toContain("cc-footer");
    expect(html).toContain("Crescimento");
    expect(html).toContain("<b>forte</b>");
  });
});
