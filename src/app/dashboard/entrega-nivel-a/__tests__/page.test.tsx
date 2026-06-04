import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { NarrLabel } from "@/components/gv/narr-label";
import { DeliveryCard } from "@/components/gv/delivery-card";
import { StatCard } from "@/components/gv/stat-card";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("EntregaNivelA — GvPageHeader", () => {
  it("renderiza title 'Entrega Nível A'", () => {
    const html = render(
      React.createElement(GvPageHeader, {
        title: "Entrega Nível A",
        sub: "O quanto cada projeto está cumprindo o que prometeu entregar",
      })
    );
    expect(html).toContain("Entrega Nível A");
    expect(html).toContain("O quanto cada projeto está cumprindo o que prometeu entregar");
  });

  it("usa classes .page-header e .ph-title", () => {
    const html = render(
      React.createElement(GvPageHeader, { title: "Entrega Nível A" })
    );
    expect(html).toContain('class="page-header"');
    expect(html).toContain('class="ph-title"');
  });
});

describe("EntregaNivelA — PulseBanner", () => {
  it("renderiza headline de status da entrega", () => {
    const html = render(
      React.createElement(PulseBanner, {
        status: "amber",
        headline: "Atenção: 1 projeto abaixo da meta",
        sub: "3 projetos em dia, 1 necessita atenção",
        chips: [
          { label: "3 Em Dia", status: "green" },
          { label: "1 Atenção", status: "amber" },
        ],
      })
    );
    expect(html).toContain("Atenção: 1 projeto abaixo da meta");
    expect(html).toContain("3 Em Dia");
    expect(html).toContain("1 Atenção");
  });
});

describe("EntregaNivelA — NarrLabel seções", () => {
  it("seção 01 step='01' label='MCC + FCC — Projeto'", () => {
    const html = render(
      React.createElement(NarrLabel, { step: "01", label: "MCC + FCC — Projeto" })
    );
    expect(html).toContain("01");
    expect(html).toContain("MCC + FCC — Projeto");
  });

  it("seção 02 step='02' label='Mensal Consolidado'", () => {
    const html = render(
      React.createElement(NarrLabel, { step: "02", label: "Mensal Consolidado" })
    );
    expect(html).toContain("02");
    expect(html).toContain("Mensal Consolidado");
  });

  it("seção 03 step='03' label='Ultimate — Projeto'", () => {
    const html = render(
      React.createElement(NarrLabel, { step: "03", label: "Ultimate — Projeto" })
    );
    expect(html).toContain("03");
    expect(html).toContain("Ultimate — Projeto");
  });

  it("seção 04 step='04' label='Destrave — Projeto'", () => {
    const html = render(
      React.createElement(NarrLabel, { step: "04", label: "Destrave — Projeto" })
    );
    expect(html).toContain("04");
    expect(html).toContain("Destrave — Projeto");
  });
});

describe("EntregaNivelA — DeliveryCard (MCC+FCC grid .g2)", () => {
  it("renderiza MCC com delivered/expected e score", () => {
    const html = render(
      React.createElement(DeliveryCard, {
        name: "MCC",
        period: "Jun 2026",
        expected: 8,
        delivered: 7,
        score: 92,
        status: "green",
      })
    );
    expect(html).toContain("MCC");
    expect(html).toContain("7 / 8");
    expect(html).toContain("92");
    expect(html).toContain("88%");
  });

  it("renderiza FCC com status amber quando entrega parcial", () => {
    const html = render(
      React.createElement(DeliveryCard, {
        name: "FCC",
        period: "Jun 2026",
        expected: 12,
        delivered: 9,
        score: 78,
        status: "amber",
      })
    );
    expect(html).toContain("FCC");
    expect(html).toContain("9 / 12");
    expect(html).toContain("78");
    expect(html).toContain("var(--am)");
  });
});

describe("EntregaNivelA — StatCard (Mensal Consolidado grid .g4)", () => {
  it("renderiza Mentorias Entregues com valor", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("span", null, "M"),
        title: "Mentorias Entregues",
        value: "142",
        status: "green",
        foot: "acumulado no mês",
      })
    );
    expect(html).toContain("Mentorias Entregues");
    expect(html).toContain("142");
  });

  it("renderiza Presença Média com unidade %", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("span", null, "P"),
        title: "Presença Média",
        value: "87",
        unit: "%",
        status: "green",
        foot: "média das sessões",
      })
    );
    expect(html).toContain("Presença Média");
    expect(html).toContain("87");
    expect(html).toContain("%");
  });

  it("renderiza NPS Médio com status amber", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("span", null, "N"),
        title: "NPS Médio",
        value: "68",
        status: "amber",
        foot: "média dos projetos",
      })
    );
    expect(html).toContain("NPS Médio");
    expect(html).toContain("68");
    expect(html).toContain("kc amber");
  });

  it("renderiza Casos de Sucesso com valor", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("span", null, "C"),
        title: "Casos de Sucesso",
        value: "23",
        status: "green",
        foot: "publicados no mês",
      })
    );
    expect(html).toContain("Casos de Sucesso");
    expect(html).toContain("23");
  });
});

describe("EntregaNivelA — DeliveryCard (Ultimate grid .g3)", () => {
  it("renderiza 3 projetos Ultimate com status distintos", () => {
    const projects = [
      { name: "Ultimate SP", delivered: 10, expected: 10, score: 95, status: "green" as const },
      { name: "Ultimate RJ", delivered: 7, expected: 10, score: 71, status: "amber" as const },
      { name: "Ultimate BH", delivered: 4, expected: 10, score: 45, status: "red" as const },
    ];
    projects.forEach(({ name, delivered, expected, score, status }) => {
      const html = render(
        React.createElement(DeliveryCard, {
          name,
          period: "Jun 2026",
          expected,
          delivered,
          score,
          status,
        })
      );
      expect(html).toContain(name);
      expect(html).toContain(String(score));
    });
  });
});

describe("EntregaNivelA — DeliveryCard (Destrave grid .g3)", () => {
  it("renderiza 3 projetos Destrave com status distintos", () => {
    const projects = [
      { name: "Destrave A", delivered: 6, expected: 6, score: 90, status: "green" as const },
      { name: "Destrave B", delivered: 4, expected: 6, score: 70, status: "amber" as const },
      { name: "Destrave C", delivered: 2, expected: 6, score: 38, status: "red" as const },
    ];
    projects.forEach(({ name, delivered, expected, score, status }) => {
      const html = render(
        React.createElement(DeliveryCard, {
          name,
          period: "Jun 2026",
          expected,
          delivered,
          score,
          status,
        })
      );
      expect(html).toContain(name);
      expect(html).toContain(String(score));
    });
  });
});
