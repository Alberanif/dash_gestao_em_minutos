import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeliveryCard } from "@/components/gv/delivery-card";
import { LtvCard } from "@/components/gv/ltv-card";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("DeliveryCard", () => {
  it("0/10: pct = 0%, ScoreBar width = 0%", () => {
    const html = render(
      React.createElement(DeliveryCard, {
        name: "Projeto A",
        period: "Jun 2026",
        expected: 10,
        delivered: 0,
        score: 50,
        status: "red",
      })
    );
    expect(html).toContain("0%");
    expect(html).toContain("width:0%");
  });

  it("10/10: pct = 100%, ScoreBar width = 100%", () => {
    const html = render(
      React.createElement(DeliveryCard, {
        name: "Projeto B",
        period: "Jun 2026",
        expected: 10,
        delivered: 10,
        score: 95,
        status: "green",
      })
    );
    expect(html).toContain("100%");
    expect(html).toContain("width:100%");
  });

  it("5/10: pct = 50%, ScoreBar width = 50%", () => {
    const html = render(
      React.createElement(DeliveryCard, {
        name: "Projeto C",
        period: "Jun 2026",
        expected: 10,
        delivered: 5,
        score: 75,
        status: "amber",
      })
    );
    expect(html).toContain("50%");
    expect(html).toContain("width:50%");
  });

  it("status green: html contém var(--gn)", () => {
    const html = render(
      React.createElement(DeliveryCard, {
        name: "Projeto D",
        period: "Jun 2026",
        expected: 10,
        delivered: 8,
        score: 90,
        status: "green",
      })
    );
    expect(html).toContain("var(--gn)");
  });
});

describe("LtvCard", () => {
  it("renderiza active, mrr, ltv, churn", () => {
    const html = render(
      React.createElement(LtvCard, {
        name: "Base Clientes",
        subtitle: "Jun 2026",
        active: 1200,
        mrr: 45000,
        ltv: 3750,
        churn: 2.5,
        status: "green",
      })
    );
    expect(html).toContain("1.200");
    expect(html).toContain("45.000");
    expect(html).toContain("3.750");
    expect(html).toContain("2.5%");
  });

  it("churn status green: cor var(--gn)", () => {
    const html = render(
      React.createElement(LtvCard, {
        name: "Base",
        subtitle: "Jun 2026",
        active: 100,
        mrr: 5000,
        ltv: 500,
        churn: 1.0,
        status: "green",
      })
    );
    expect(html).toContain("var(--gn)");
  });

  it("churn status amber: cor var(--am)", () => {
    const html = render(
      React.createElement(LtvCard, {
        name: "Base",
        subtitle: "Jun 2026",
        active: 100,
        mrr: 5000,
        ltv: 500,
        churn: 5.0,
        status: "amber",
      })
    );
    expect(html).toContain("var(--am)");
  });

  it("sparkData omitido: não renderiza sparkline container", () => {
    const html = render(
      React.createElement(LtvCard, {
        name: "Base",
        subtitle: "Jun 2026",
        active: 100,
        mrr: 5000,
        ltv: 500,
        churn: 1.0,
        status: "green",
      })
    );
    expect(html).not.toContain('class="spark"');
  });

  it("sparkData com 2+ itens: renderiza sparkline container", () => {
    const html = render(
      React.createElement(LtvCard, {
        name: "Base",
        subtitle: "Jun 2026",
        active: 100,
        mrr: 5000,
        ltv: 500,
        churn: 1.0,
        status: "green",
        sparkData: [10, 20, 30],
      })
    );
    expect(html).toContain('class="spark"');
  });
});
