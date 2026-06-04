import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListCard } from "@/components/gv/list-card";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("ListCard", () => {
  it("renderiza name e children", () => {
    const html = render(
      React.createElement(ListCard, { name: "Canal YouTube" }, React.createElement("span", null, "conteúdo filho"))
    );
    expect(html).toContain("Canal YouTube");
    expect(html).toContain("conteúdo filho");
  });

  it("status fornecido: renderiza StatusChip (html contém 'chip')", () => {
    const html = render(
      React.createElement(ListCard, { name: "Canal", status: "green" }, React.createElement("span", null, "x"))
    );
    expect(html).toContain("chip");
  });

  it("status omitido: não renderiza StatusChip", () => {
    const html = render(
      React.createElement(ListCard, { name: "Canal" }, React.createElement("span", null, "x"))
    );
    expect(html).not.toContain("chip");
  });

  it("clickable=true: html contém classe 'clickable'", () => {
    const html = render(
      React.createElement(ListCard, { name: "Canal", clickable: true }, React.createElement("span", null, "x"))
    );
    expect(html).toContain("clickable");
  });

  it("clickable=false: html não contém 'clickable'", () => {
    const html = render(
      React.createElement(ListCard, { name: "Canal", clickable: false }, React.createElement("span", null, "x"))
    );
    expect(html).not.toContain("clickable");
  });

  it("clickable omitido: html não contém 'clickable'", () => {
    const html = render(
      React.createElement(ListCard, { name: "Canal" }, React.createElement("span", null, "x"))
    );
    expect(html).not.toContain("clickable");
  });

  it("borderColor: html contém o estilo inline de borderColor", () => {
    const html = render(
      React.createElement(ListCard, { name: "Canal", borderColor: "#ff0000" }, React.createElement("span", null, "x"))
    );
    expect(html).toContain("#ff0000");
  });
});
