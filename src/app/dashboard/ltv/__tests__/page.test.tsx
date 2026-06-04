import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { NarrLabel } from "@/components/gv/narr-label";
import { LtvCard } from "@/components/gv/ltv-card";
import { StatCard } from "@/components/gv/stat-card";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("LtvPage — GV components smoke tests", () => {
  it("GvPageHeader renderiza title=LTV e sub correto", () => {
    const html = render(
      React.createElement(GvPageHeader, {
        title: "LTV",
        sub: "Quanto cada cliente vale ao longo do tempo, por fonte",
      })
    );
    expect(html).toContain("LTV");
    expect(html).toContain("Quanto cada cliente vale ao longo do tempo, por fonte");
    expect(html).toContain('class="page-header"');
  });

  it("PulseBanner com chips Matriz Humana e Solides", () => {
    const html = render(
      React.createElement(PulseBanner, {
        status: "green",
        headline: "Assinaturas estáveis",
        sub: "Ambas as fontes com dados disponíveis",
        chips: [
          { label: "Matriz Humana", status: "green" },
          { label: "Solides", status: "green" },
        ],
      })
    );
    expect(html).toContain("Matriz Humana");
    expect(html).toContain("Solides");
    expect(html).toContain("pchip green");
  });

  it("NarrLabel 01 Por Fonte", () => {
    const html = render(
      React.createElement(NarrLabel, { step: "01", label: "Por Fonte" })
    );
    expect(html).toContain("01");
    expect(html).toContain("Por Fonte");
    expect(html).toContain('class="narr"');
  });

  it("NarrLabel 02 Movimento do Mês", () => {
    const html = render(
      React.createElement(NarrLabel, { step: "02", label: "Movimento do Mês" })
    );
    expect(html).toContain("02");
    expect(html).toContain("Movimento do Mês");
  });

  it("LtvCard Matriz Humana renderiza dados básicos", () => {
    const html = render(
      React.createElement(LtvCard, {
        name: "Matriz Humana",
        subtitle: "Jun 2026",
        active: 320,
        mrr: 12800,
        ltv: 640,
        churn: 2.5,
        status: "green",
      })
    );
    expect(html).toContain("Matriz Humana");
    expect(html).toContain("320");
    expect(html).toContain("12.800");
    expect(html).toContain("2.5%");
  });

  it("LtvCard Solides renderiza dados básicos", () => {
    const html = render(
      React.createElement(LtvCard, {
        name: "Solides",
        subtitle: "Jun 2026",
        active: 180,
        mrr: 9000,
        ltv: 900,
        churn: 3.1,
        status: "amber",
      })
    );
    expect(html).toContain("Solides");
    expect(html).toContain("180");
    expect(html).toContain("9.000");
    expect(html).toContain("3.1%");
  });

  it("StatCard Novos Clientes renderiza valor e foot", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("span", null, "+"),
        title: "Novos Clientes",
        value: "48",
        status: "green",
        foot: "no período selecionado",
      })
    );
    expect(html).toContain("Novos Clientes");
    expect(html).toContain("48");
    expect(html).toContain("no período selecionado");
    expect(html).toContain("kc green");
  });

  it("StatCard Receita Recorrente renderiza MRR", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("span", null, "R$"),
        title: "Receita Recorrente",
        value: "R$ 21.800",
        status: "green",
        foot: "MRR combinado",
      })
    );
    expect(html).toContain("Receita Recorrente");
    expect(html).toContain("R$ 21.800");
  });

  it("StatCard Churn Médio com status amber", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("span", null, "%"),
        title: "Churn Médio",
        value: "2.8%",
        status: "amber",
        foot: "média das fontes",
      })
    );
    expect(html).toContain("Churn Médio");
    expect(html).toContain("2.8%");
    expect(html).toContain("kc amber");
  });

  it("StatCard LTV/CAC renderiza ratio", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("span", null, "÷"),
        title: "LTV/CAC",
        value: "3.2×",
        status: "green",
        foot: "meta &gt; 3×",
      })
    );
    expect(html).toContain("LTV/CAC");
    expect(html).toContain("3.2×");
  });
});
