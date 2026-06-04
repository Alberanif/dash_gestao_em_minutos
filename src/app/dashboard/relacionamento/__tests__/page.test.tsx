import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { NarrLabel } from "@/components/gv/narr-label";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { CompareCard } from "@/components/gv/compare-card";
import { StatCard } from "@/components/gv/stat-card";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("Relacionamento page — componentes v3", () => {
  it("GvPageHeader renderiza title Relacionamento e sub", () => {
    const html = render(
      GvPageHeader({ title: "Relacionamento", sub: "Quanto a audiência está consumindo nosso conteúdo" })
    );
    expect(html).toContain("Relacionamento");
    expect(html).toContain("Quanto a audiência");
    expect(html).toContain("ph-title");
    expect(html).toContain("ph-sub");
  });

  it("NarrLabel 01 renderiza Pulso do Período", () => {
    const html = render(React.createElement(NarrLabel, { step: "01", label: "Pulso do Período", desc: "Consumo vs. período anterior" }));
    expect(html).toContain("01");
    expect(html).toContain("Pulso do Período");
    expect(html).toContain("narr");
  });

  it("NarrLabel 02 renderiza Alcance por Plataforma", () => {
    const html = render(React.createElement(NarrLabel, { step: "02", label: "Alcance por Plataforma" }));
    expect(html).toContain("02");
    expect(html).toContain("Alcance por Plataforma");
  });

  it("NarrLabel 03 renderiza Detalhe do Período", () => {
    const html = render(React.createElement(NarrLabel, { step: "03", label: "Detalhe do Período", desc: "Como o consumo se distribui" }));
    expect(html).toContain("03");
    expect(html).toContain("Detalhe do Período");
  });

  it("PulseBanner green renderiza classe pulse e ícone verde", () => {
    const html = render(
      React.createElement(PulseBanner, {
        status: "green",
        headline: "Ambas as plataformas crescendo",
        sub: "YouTube e Instagram com alcance positivo no período.",
        chips: [
          { label: "2 acelerando", status: "green" },
          { label: "vs. período anterior", status: "muted" },
        ],
      })
    );
    expect(html).toContain("pulse");
    expect(html).toContain("Ambas as plataformas crescendo");
    expect(html).toContain("2 acelerando");
    expect(html).toContain("pchip green");
    expect(html).toContain("pchip muted");
  });

  it("PulseBanner amber renderiza quando plataformas divergem", () => {
    const html = render(
      React.createElement(PulseBanner, {
        status: "amber",
        headline: "YouTube acelerando, Instagram esfriando",
        sub: "A audiência está consumindo mais vídeo longo e menos conteúdo curto.",
        chips: [
          { label: "1 acelerando", status: "green" },
          { label: "1 esfriando", status: "red" },
        ],
      })
    );
    expect(html).toContain("pulse");
    expect(html).toContain("YouTube acelerando");
    expect(html).toContain("pchip red");
  });

  it("CompareCard yt renderiza plataforma e metric", () => {
    const html = render(
      React.createElement(CompareCard, {
        platform: "yt",
        name: "YouTube",
        metric: "Views no período",
        prevLabel: "01/04 – 30/04",
        currLabel: "01/05 – 30/05",
        prevValue: 412380,
        currValue: 487120,
        status: "green",
        verdict: "<b>+74.740 views</b> vs. período anterior.",
      })
    );
    expect(html).toContain("YouTube");
    expect(html).toContain("Views no período");
    expect(html).toContain("cc-plat yt");
    expect(html).toContain("412.380");
    expect(html).toContain("487.120");
  });

  it("CompareCard ig renderiza plataforma e metric", () => {
    const html = render(
      React.createElement(CompareCard, {
        platform: "ig",
        name: "Instagram",
        metric: "Alcance no período",
        prevLabel: "01/04 – 30/04",
        currLabel: "01/05 – 30/05",
        prevValue: 318900,
        currValue: 264720,
        status: "red",
        verdict: "<b>−54.180 pessoas</b> vs. período anterior.",
      })
    );
    expect(html).toContain("Instagram");
    expect(html).toContain("Alcance no período");
    expect(html).toContain("cc-plat ig");
  });

  it("grid g2 envolve os CompareCards", () => {
    const html = render(
      React.createElement("div", { className: "grid g2" },
        React.createElement(CompareCard, {
          platform: "yt", name: "YouTube", metric: "Views",
          prevLabel: "A", currLabel: "B",
          prevValue: 100, currValue: 120,
          status: "green", verdict: "ok",
        }),
        React.createElement(CompareCard, {
          platform: "ig", name: "Instagram", metric: "Alcance",
          prevLabel: "A", currLabel: "B",
          prevValue: 100, currValue: 80,
          status: "red", verdict: "queda",
        })
      )
    );
    expect(html).toContain("grid g2");
    expect(html).toContain("YouTube");
    expect(html).toContain("Instagram");
  });

  it("StatCard Vídeos Publicados renderiza", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("svg", { viewBox: "0 0 24 24" }),
        title: "Vídeos Publicados",
        value: "12",
        delta: 20,
        status: "green",
        foot: "<strong>+2</strong> vs. período anterior",
      })
    );
    expect(html).toContain("Vídeos Publicados");
    expect(html).toContain("kc green");
    expect(html).toContain("dbadge");
  });

  it("StatCard Engajamento Reels (mockado) renderiza com estimativa no foot", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("svg", { viewBox: "0 0 24 24" }),
        title: "Engajamento Reels",
        value: "—",
        delta: 0,
        status: "amber",
        foot: "Meta: <strong>≥ 5,5%</strong> (estimativa)",
      })
    );
    expect(html).toContain("Engajamento Reels");
    expect(html).toContain("estimativa");
    expect(html).toContain("dbadge flat");
  });

  it("StatCard Comentários Respondidos (mockado) renderiza com estimativa no foot", () => {
    const html = render(
      React.createElement(StatCard, {
        icon: React.createElement("svg", { viewBox: "0 0 24 24" }),
        title: "Comentários Respondidos",
        value: "—",
        delta: 0,
        status: "amber",
        foot: "(estimativa)",
      })
    );
    expect(html).toContain("Comentários Respondidos");
    expect(html).toContain("estimativa");
  });

  it("grid g4 envolve os StatCards", () => {
    const icon = React.createElement("svg", { viewBox: "0 0 24 24" });
    const html = render(
      React.createElement("div", { className: "grid g4" },
        React.createElement(StatCard, { icon, title: "Vídeos Publicados", value: "12", status: "green", foot: "" }),
        React.createElement(StatCard, { icon, title: "Tempo Médio Assistido", value: "7:42", status: "green", foot: "" }),
        React.createElement(StatCard, { icon, title: "Engajamento Reels", value: "—", status: "amber", foot: "(estimativa)" }),
        React.createElement(StatCard, { icon, title: "Comentários Respondidos", value: "—", status: "amber", foot: "(estimativa)" }),
      )
    );
    expect(html).toContain("grid g4");
    expect(html).toContain("Vídeos Publicados");
    expect(html).toContain("Tempo Médio Assistido");
    expect(html).toContain("Engajamento Reels");
    expect(html).toContain("Comentários Respondidos");
  });

  it("tip no rodapé renderiza classe tip", () => {
    const html = render(
      React.createElement("div", { className: "tip" },
        React.createElement("div", null, React.createElement("b", null, "Atenção rápida:"), " dados do Instagram são estimativas.")
      )
    );
    expect(html).toContain("tip");
    expect(html).toContain("Atenção rápida");
  });
});
