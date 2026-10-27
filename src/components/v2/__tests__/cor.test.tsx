/** @jest-environment jsdom */
import React from "react";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { corDado } from "../cor";
import { FluxoJornada } from "../evento/fluxo-jornada";
import { Kpi } from "../evento/kpi";
import { Numero } from "../evento/numero";
import { LineChart } from "../charts/line-chart";
import { mockReducedMotion } from "./helpers";

const tokens = readFileSync(join(__dirname, "../tokens.css"), "utf8");
const dirEvento = join(__dirname, "../evento");

const ETAPAS = [
  { label: "Impressões", value: 100000 },
  { label: "Cliques no link", value: 4000 },
  { label: "Visualizações de LP", value: 3000 },
  { label: "Leads captados", value: 500 },
  { label: "Vendas aprovadas", value: 20 },
];
const TAXAS = [
  { label: "CTR", pct: 4 },
  { label: "Taxa LP", pct: 75 },
  { label: "Conversão LP→Lead", pct: 16 },
  { label: "Taxa de Fechamento", pct: 4 },
];

describe("cor por significado", () => {
  beforeEach(() => mockReducedMotion(false));

  it("os seis dados têm a cor aprovada nos tokens, e o latão fica fora das séries", () => {
    const aprovados = { alcance: "#4da6db", pagina: "#3dbbc9", lead: "#34b98e", venda: "#86c25e", custo: "#9a8ce0", alerta: "#e8706a" };
    for (const [nome, hex] of Object.entries(aprovados)) {
      expect(tokens).toMatch(new RegExp(String.raw`--v2-d-${nome}:\s*${hex}`));
    }
    const series = tokens.match(/--v2-serie-\d:\s*#[0-9a-f]{6}/gi) ?? [];
    expect(series).toHaveLength(5);
    expect(series.join("")).not.toMatch(/d9a441/i);
    expect(corDado("lead")).toBe("var(--v2-d-lead)");
  });

  it("nenhum bloco do evento escreve cor em hex: tudo vem dos tokens", () => {
    for (const f of readdirSync(dirEvento).filter((n) => /\.tsx?$/.test(n))) {
      // Comentários podem citar o hex de um token; o que vale é o código.
      const codigo = readFileSync(join(dirEvento, f), "utf8").replace(/\/\/.*$/gm, "");
      expect({ f, hex: codigo.match(/#[0-9a-fA-F]{6}\b/g) }).toEqual({ f, hex: null });
    }
  });

  it("a jornada pinta cada etapa na cor do seu dado e a corda faz a transição entre duas etapas", () => {
    const { container } = render(<FluxoJornada etapas={ETAPAS} taxas={TAXAS} />);
    const selos = Array.from(container.querySelectorAll("li > div > span.rounded-full")).map((s) => (s as HTMLElement).style.color);
    expect(selos).toEqual([
      "var(--v2-d-alcance)",
      "var(--v2-d-alcance)",
      "var(--v2-d-pagina)",
      "var(--v2-d-lead)",
      "var(--v2-d-venda)",
    ]);
    // A corda entre Página (2) e Leads (3): o degradê sai da cor de uma e chega na da outra.
    const gradientes = Array.from(container.querySelectorAll("linearGradient")).filter((g) => g.id.includes("-h"));
    const paradas = gradientes.map((g) => Array.from(g.querySelectorAll("stop")).map((s) => s.getAttribute("stop-color")));
    expect(paradas[2]).toEqual(["var(--v2-d-pagina)", "var(--v2-d-lead)"]);
    expect(paradas[0]).toEqual(["var(--v2-d-alcance)", "var(--v2-d-alcance)"]);
  });

  it("o KPI e o número de apoio carregam a cor do dado, e o valor continua sem cor", () => {
    render(
      <>
        <Kpi rotulo="Leads captados" dado="lead" icone="leads">
          500
        </Kpi>
        <dl>
          <Numero rotulo="Investimento" valor="R$ 10" dado="custo" />
        </dl>
      </>,
    );
    const selo = screen.getByText("Leads captados").previousElementSibling as HTMLElement;
    expect(selo.style.color).toBe("var(--v2-d-lead)");
    expect(screen.getByText("500").style.color).toBe("");
    expect((screen.getByText("Investimento").parentElement as HTMLElement).style.borderColor).toBe("var(--v2-d-custo)");
  });

  it("a linha usa a cor passada e o degradê sob ela sai dessa cor", () => {
    const serie = { id: "a", label: "Leads", cor: "var(--v2-d-lead)", data: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 2 }] };
    const { container } = render(<LineChart titulo="Leads" series={[serie]} />);
    expect(container.querySelector('path[stroke="var(--v2-d-lead)"]')).not.toBeNull();
    const parada = container.querySelector("linearGradient stop");
    expect(parada?.getAttribute("stop-color")).toBe("var(--v2-d-lead)");
  });
});
