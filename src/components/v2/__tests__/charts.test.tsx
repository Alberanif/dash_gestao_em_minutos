/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionProvider } from "../motion";
import { BarChart, BarChartDiario, DonutChart, FunnelChart, LineChart, Sparkline } from "../charts";
import { mockReducedMotion } from "./helpers";

beforeEach(() => mockReducedMotion(false));

const dia = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 12));
const com = (ui: React.ReactElement) => render(<MotionProvider>{ui}</MotionProvider>);
const pontosVivos = (c: HTMLElement) => c.querySelectorAll("[data-ponto-vivo]");
const vivo = (c: HTMLElement) => c.querySelector('[aria-live="polite"]')!.textContent;

describe("LineChart", () => {
  const serieA = { id: "a", label: "Receita", data: [0, 1, 2, 3].map((i) => ({ x: dia(i), y: 100 + i * 10 })) };
  const serieB = { id: "b", label: "Gasto", data: [0, 1, 2, 3].map((i) => ({ x: dia(i), y: 50 + i })) };

  it("série vazia vira estado vazio com direção, sem erro", () => {
    com(<LineChart titulo="Receita" series={[]} />);
    expect(screen.getByRole("status").textContent).toContain("Sem dados no período");
  });

  it("série só com valores inválidos também é vazia", () => {
    com(<LineChart titulo="Receita" series={[{ id: "a", label: "A", data: [{ x: 1, y: NaN }] }]} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("um único ponto desenha só o ponto, sem linha e sem erro", () => {
    const { container } = com(
      <LineChart titulo="Receita" series={[{ id: "a", label: "A", data: [{ x: dia(0), y: 42 }] }]} />,
    );
    expect(pontosVivos(container)).toHaveLength(1);
    expect(container.querySelector("path")).toBeNull();
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("o âmbar marca só o último ponto de cada linha", () => {
    const { container } = com(<LineChart titulo="Resultado" series={[serieA, serieB]} />);
    expect(pontosVivos(container)).toHaveLength(2);
    const ambar = Array.from(container.querySelectorAll("[fill]")).filter((e) =>
      e.getAttribute("fill")?.includes("--v2-ponto"),
    );
    expect(ambar).toHaveLength(2);
    // Os dois últimos pontos caem no mesmo x: a borda direita do eixo.
    const [a, b] = Array.from(pontosVivos(container));
    expect(a.getAttribute("cx")).toBe(b.getAttribute("cx"));
  });

  it("legenda só com duas ou mais séries", () => {
    const um = com(<LineChart titulo="Receita" series={[serieA]} />);
    expect(um.container.querySelector("ul")).toBeNull();
    um.unmount();
    const dois = com(<LineChart titulo="Resultado" series={[serieA, serieB]} />);
    expect(dois.container.querySelector("ul")?.textContent).toContain("Gasto");
  });

  it("a cor segue a posição original da série mesmo se outra estiver vazia", () => {
    const vazia = { id: "v", label: "Vazia", data: [] };
    const { container } = com(<LineChart titulo="Resultado" series={[vazia, serieB]} />);
    expect(container.querySelector('path[stroke="var(--v2-serie-2)"]')).not.toBeNull();
  });

  it("teclado: setas, Home, End e Escape percorrem os valores e o leitor de tela recebe o texto", () => {
    const { container } = com(<LineChart titulo="Receita" series={[serieA]} />);
    const grupo = screen.getByRole("group");
    expect(vivo(container)).toBe("");
    fireEvent.focus(grupo);
    expect(vivo(container)).toContain("Receita 100");
    fireEvent.keyDown(grupo, { key: "ArrowRight" });
    expect(vivo(container)).toContain("Receita 110");
    fireEvent.keyDown(grupo, { key: "End" });
    expect(vivo(container)).toContain("Receita 130");
    fireEvent.keyDown(grupo, { key: "ArrowRight" });
    expect(vivo(container)).toContain("Receita 130");
    fireEvent.keyDown(grupo, { key: "Home" });
    expect(vivo(container)).toContain("Receita 100");
    fireEvent.keyDown(grupo, { key: "Escape" });
    expect(vivo(container)).toBe("");
  });

  it("tem tabela com todos os valores para leitor de tela", () => {
    com(<LineChart titulo="Receita" series={[serieA]} />);
    expect(screen.getAllByRole("row", { hidden: true })).toHaveLength(1 + 4);
  });

  it("funciona com movimento reduzido", () => {
    mockReducedMotion(true);
    const { container } = com(<LineChart titulo="Receita" series={[serieA]} />);
    expect(pontosVivos(container)).toHaveLength(1);
  });

  it("5 mil pontos por série: renderiza, o cursor responde rápido e a tabela não é montada", () => {
    const grande = {
      id: "g",
      label: "Visitas",
      data: Array.from({ length: 5000 }, (_, i) => ({ x: dia(i / 10), y: 500 + Math.sin(i / 50) * 100 + (i % 7) })),
    };
    const t0 = performance.now();
    const { container } = com(<LineChart titulo="Visitas" series={[grande]} />);
    const tempoRender = performance.now() - t0;
    expect(container.querySelectorAll("tr")).toHaveLength(0);
    expect(container.querySelector("path")?.getAttribute("d")?.length).toBeGreaterThan(5000);
    const grupo = screen.getByRole("group");
    fireEvent.focus(grupo);
    const t1 = performance.now();
    for (let i = 0; i < 50; i++) fireEvent.keyDown(grupo, { key: "ArrowRight" });
    const porPasso = (performance.now() - t1) / 50;
    // Folga larga para CI lento: o alvo é pegar regressão para O(n) por evento (refazer o caminho a cada passo).
    expect(tempoRender).toBeLessThan(3000);
    expect(porPasso).toBeLessThan(40);
  });
});

describe("BarChart", () => {
  const dados = [
    { id: "a", label: "Meta", value: 300 },
    { id: "b", label: "Google", value: 120 },
    { id: "c", label: "Orgânico", value: 60 },
  ];

  it("valores inválidos viram estado vazio", () => {
    com(<BarChart titulo="Origem" data={[{ id: "x", label: "X", value: NaN }]} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("barra única renderiza sem erro", () => {
    const { container } = com(<BarChart titulo="Origem" data={[dados[0]]} />);
    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("uma barra por dado, todas da mesma série e sem âmbar", () => {
    const { container } = com(<BarChart titulo="Origem" data={dados} />);
    const barras = Array.from(container.querySelectorAll("path"));
    expect(barras).toHaveLength(3);
    // Todas as barras usam o mesmo degradê, que vai do pé fraco à ponta cheia na cor da série.
    expect(new Set(barras.map((p) => p.getAttribute("fill"))).size).toBe(1);
    const paradas = Array.from(container.querySelectorAll("linearGradient stop")).map((s) => s.getAttribute("stop-color"));
    expect(paradas).toEqual(["var(--v2-serie-1)", "var(--v2-serie-1)"]);
    expect(container.innerHTML).not.toContain("--v2-ponto");
  });

  it("a barra não passa de 24px de espessura", () => {
    const { container } = com(<BarChart titulo="Origem" data={[dados[0]]} />);
    const d = container.querySelector("path")!.getAttribute("d")!;
    const xs = [...d.matchAll(/(?:^M|H| |Q)(-?[\d.]+),/g)].map((m) => Number(m[1]));
    expect(xs.length).toBeGreaterThan(1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(24);
  });

  it("teclado lê categoria e valor", () => {
    const { container } = com(<BarChart titulo="Origem" data={dados} />);
    const grupo = screen.getByRole("group");
    fireEvent.focus(grupo);
    expect(vivo(container)).toBe("Meta: 300");
    fireEvent.keyDown(grupo, { key: "ArrowRight" });
    expect(vivo(container)).toBe("Google: 120");
  });

  it("barras horizontais também renderizam", () => {
    const { container } = com(<BarChart titulo="Origem" data={dados} orientacao="horizontal" />);
    expect(container.querySelectorAll("path")).toHaveLength(3);
  });
});

describe("FunnelChart", () => {
  const etapas = [
    { id: "v", label: "Visitas", value: 1000 },
    { id: "l", label: "Leads", value: 250 },
    { id: "c", label: "Compras", value: 25 },
  ];

  it("primeira etapa zerada vira estado vazio, sem NaN", () => {
    const { container } = com(<FunnelChart titulo="Funil" etapas={[{ id: "v", label: "V", value: 0 }]} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("uma etapa só renderiza", () => {
    const { container } = com(<FunnelChart titulo="Funil" etapas={[etapas[0]]} />);
    expect(container.querySelectorAll("polygon")).toHaveLength(1);
  });

  it("usa a rampa ordinal na ordem e fala a conversão por etapa", () => {
    const { container } = com(<FunnelChart titulo="Funil" etapas={etapas} />);
    const cores = Array.from(container.querySelectorAll("polygon")).map((p) => p.getAttribute("fill"));
    expect(cores).toEqual(["var(--v2-funil-1)", "var(--v2-funil-3)", "var(--v2-funil-5)"]);
    const grupo = screen.getByRole("group");
    fireEvent.focus(grupo);
    fireEvent.keyDown(grupo, { key: "ArrowRight" });
    expect(vivo(container)).toBe("Leads: 250, 25% do total, 25% da etapa anterior");
    fireEvent.keyDown(grupo, { key: "ArrowRight" });
    expect(vivo(container)).toContain("10% da etapa anterior");
  });
});

describe("DonutChart", () => {
  it("vazio vira estado vazio", () => {
    com(<DonutChart titulo="Plataformas" data={[]} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("fatia única renderiza sem erro", () => {
    const { container } = com(<DonutChart titulo="P" data={[{ id: "a", label: "Meta", value: 10 }]} />);
    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("até 5 fatias nas cores da paleta e o resto em Outros na ardósia, nunca uma sexta cor", () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ id: `i${i}`, label: `Item ${i}`, value: 80 - i * 10 }));
    const { container } = com(<DonutChart titulo="P" data={data} />);
    const cores = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    expect(cores).toEqual([
      "var(--v2-serie-1)",
      "var(--v2-serie-2)",
      "var(--v2-serie-3)",
      "var(--v2-serie-4)",
      "var(--v2-serie-5)",
      "var(--v2-ardosia)",
    ]);
    expect(container.querySelector("ul")?.textContent).toContain("Outros");
    expect(container.innerHTML).not.toContain("serie-6");
  });

  it("teclado lê a fatia e a parte do todo", () => {
    const { container } = com(
      <DonutChart
        titulo="P"
        data={[
          { id: "a", label: "Meta", value: 75 },
          { id: "b", label: "Google", value: 25 },
        ]}
      />,
    );
    fireEvent.focus(screen.getByRole("group"));
    expect(vivo(container)).toBe("Meta: 75, 75%");
  });
});

describe("Sparkline", () => {
  it("resume início, fim e variação no nome acessível", () => {
    render(<Sparkline valores={[100, 120, 150]} rotulo="Receita" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Receita: de 100 para 150 (50%)");
  });

  it("vazio e ponto único não quebram", () => {
    const a = render(<Sparkline valores={[]} rotulo="Receita" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Receita: sem dados");
    a.unmount();
    const b = render(<Sparkline valores={[7]} />);
    expect(pontosVivos(b.container)).toHaveLength(1);
    expect(b.container.innerHTML).not.toContain("NaN");
  });

  it("série constante não gera NaN", () => {
    const { container } = render(<Sparkline valores={[5, 5, 5]} />);
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("o último ponto é o âmbar", () => {
    const { container } = render(<Sparkline valores={[1, 2, 3]} />);
    expect(pontosVivos(container)).toHaveLength(1);
  });
});

describe("BarChartDiario", () => {
  const dias = (n: number) => Array.from({ length: n }, (_, i) => ({ x: dia(i), y: 10 + (i % 7) * 5 }));
  const barras = (c: HTMLElement) => c.querySelectorAll("path.v2-g-sobe");

  it("sem dados vira estado vazio", () => {
    com(<BarChartDiario titulo="Vendas" cor="var(--plat)" data={[]} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("período curto cabe na largura: uma barra por dia, sem miniatura nem rolagem", () => {
    const { container } = com(<BarChartDiario titulo="Vendas" cor="var(--plat)" data={dias(10)} />);
    expect(barras(container)).toHaveLength(10);
    expect(container.querySelector("svg.cursor-grab")).toBeNull();
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("período longo mantém a largura da barra e passa a rolar, com miniatura do período inteiro", () => {
    const { container } = com(<BarChartDiario titulo="Vendas" cor="var(--plat)" data={dias(90)} />);
    expect(barras(container)).toHaveLength(90);
    const rolavel = container.querySelector(".overflow-x-auto svg") as SVGElement;
    expect(Number(rolavel.getAttribute("width"))).toBe(90 * 24);
    expect(container.querySelector("svg.cursor-grab")).not.toBeNull();
    expect(container.textContent).toContain("de 90 dias");
  });

  it("usa a cor passada e o leitor de tela recebe o valor do dia ativo pelas setas", () => {
    const { container } = com(<BarChartDiario titulo="Vendas" cor="var(--plat)" data={dias(90)} />);
    expect(container.querySelector("linearGradient stop")?.getAttribute("stop-color")).toBe("var(--plat)");
    const grupo = screen.getByRole("group");
    fireEvent.keyDown(grupo, { key: "End" });
    expect(vivo(container)).toContain("29/12/2026");
    fireEvent.keyDown(grupo, { key: "ArrowLeft" });
    expect(vivo(container)).toContain("28/12/2026");
  });
});
