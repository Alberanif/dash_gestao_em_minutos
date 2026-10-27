/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import type { ReportFunil, ReportJanela } from "@/lib/indicadores/report-diario-tipos";
import { ReportDiarioCard } from "../report-diario/report-diario-card";
import { ReportDiarioCarrossel, type ItemReport } from "../report-diario/report-diario-carrossel";
import { ReportDiarioSkeleton } from "../report-diario/report-diario-skeleton";
import { mockReducedMotion } from "./helpers";

// Reduced motion: o CountUp mostra o valor final na hora.
beforeEach(() => mockReducedMotion(true));

const norm = (s: string | null | undefined) => (s ?? "").replace(/ /g, " ").trim();
const janela = (leads: number | null, spend: number | null, cpl: number | null): ReportJanela => ({ leads, spend, cpl });

function funil(over: Partial<ReportFunil> = {}): ReportFunil {
  return {
    id: "f1",
    nome: "Imersão Alfa",
    periodo: janela(1000, 5000, 5),
    ...over,
  };
}

const renderCard = (f: ReportFunil | null, href = "/v2/indicadores/eventos/f1") =>
  render(<ReportDiarioCard funil={f} nome="Imersão Alfa" href={href} />);

describe("ReportDiarioCard", () => {
  it("destaca o CPL do período em âmbar, com o rótulo", () => {
    renderCard(funil());
    expect(screen.getByText("CPL do período")).not.toBeNull();
    const cpl = screen.getByTestId("cpl-periodo");
    expect(norm(cpl.textContent)).toBe("R$ 5,00");
    expect(cpl.className).toContain("text-v2-ponto");
    expect(cpl.className).toContain("text-3xl");
  });

  it("o âmbar aparece só no CPL do card", () => {
    const { container } = renderCard(funil());
    const ambar = Array.from(container.querySelectorAll("[class*='v2-ponto']"));
    expect(ambar).toEqual([screen.getByTestId("cpl-periodo")]);
  });

  it("mostra leads e investimento do período formatados em pt-BR", () => {
    renderCard(funil({ periodo: janela(12340, 15000.5, 1.22) }));
    expect(norm(screen.getByText("Leads").closest("div")!.querySelector("dd")!.textContent)).toBe("12.340");
    expect(norm(screen.getByText("Investimento").closest("div")!.querySelector("dd")!.textContent)).toBe("R$ 15.000,50");
    expect(norm(screen.getByTestId("cpl-periodo").textContent)).toBe("R$ 1,22");
  });

  it("não compara com ontem nem anteontem", () => {
    const { container } = renderCard(funil());
    expect(container.textContent).not.toMatch(/ontem|anteontem|[▲▼]/i);
    expect(container.querySelector("[data-variacao]")).toBeNull();
    expect(screen.queryByTestId("acumulado")).toBeNull();
  });

  it("valores ausentes viram traço", () => {
    renderCard(funil({ periodo: janela(null, null, null) }));
    expect(norm(screen.getByTestId("cpl-periodo").textContent)).toBe("—");
    expect(norm(screen.getByText("Leads").closest("div")!.querySelector("dd")!.textContent)).toBe("—");
    expect(norm(screen.getByText("Investimento").closest("div")!.querySelector("dd")!.textContent)).toBe("—");
  });

  it("CPL nunca aparece como R$ 0", () => {
    renderCard(funil({ periodo: janela(0, 0, 0) }));
    expect(norm(screen.getByTestId("cpl-periodo").textContent)).toBe("—");
  });

  it("funil null mostra indisponível, mantém título e link", () => {
    renderCard(null);
    expect(screen.getByRole("status").textContent).toContain("Indisponível");
    expect(screen.getByRole("link", { name: "Imersão Alfa" })).not.toBeNull();
    expect(screen.queryByText("CPL do período")).toBeNull();
  });

  it("o título leva ao dashboard do evento", () => {
    renderCard(funil(), "/v2/indicadores/eventos/abc");
    expect(screen.getByRole("link", { name: "Imersão Alfa" }).getAttribute("href")).toBe("/v2/indicadores/eventos/abc");
  });

  it("não usa caixa-alta, mono nem seta de botão", () => {
    const { container } = renderCard(funil());
    expect(container.innerHTML).not.toMatch(/uppercase|font-mono|→/);
  });
});

const item = (id: string, nome: string, f: ReportFunil | null = funil({ id, nome })): ItemReport => ({
  id,
  nome,
  href: `/v2/indicadores/eventos/${id}`,
  funil: f,
});
const tres = [item("a", "Funil A"), item("b", "Funil B"), item("c", "Funil C")];
const nomes = () => screen.getAllByTestId("report-diario-card").map((c) => c.querySelector("h3")!.textContent);

describe("ReportDiarioCarrossel (fluxo de cards)", () => {
  it("mostra todos os funis ao mesmo tempo, na ordem, dentro de uma região nomeada", () => {
    render(<ReportDiarioCarrossel itens={tres} />);
    expect(screen.getByRole("region", { name: "Report diário" })).not.toBeNull();
    expect(nomes()).toEqual(["Funil A", "Funil B", "Funil C"]);
  });

  it("liga os cards por cordas: uma a menos que o número de funis, nos dois sentidos", () => {
    const { container } = render(<ReportDiarioCarrossel itens={tres} />);
    expect(container.querySelectorAll("path.v2-fl-corda")).toHaveLength((tres.length - 1) * 2);
  });

  it("com um funil só não há corda nem controle de rodízio", () => {
    const { container } = render(<ReportDiarioCarrossel itens={[item("a", "Funil A")]} />);
    expect(nomes()).toEqual(["Funil A"]);
    expect(container.querySelector("path.v2-fl-corda")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("os cards têm todos a mesma altura mínima", () => {
    render(<ReportDiarioCarrossel itens={tres} />);
    const alturas = screen.getAllByTestId("report-diario-card").map((c) => c.className.match(/min-h-\S+/)?.[0]);
    expect(new Set(alturas).size).toBe(1);
    expect(alturas[0]).toBeDefined();
  });

  it("funil com falha mostra indisponível sem derrubar os outros", () => {
    render(<ReportDiarioCarrossel itens={[item("a", "Funil A", null), item("b", "Funil B")]} />);
    expect(screen.getByRole("status").textContent).toContain("Indisponível");
    expect(screen.getByTestId("cpl-periodo")).not.toBeNull();
  });
});

describe("skeleton", () => {
  it("skeleton e card compartilham a mesma altura mínima", () => {
    const { container: a } = render(<ReportDiarioSkeleton />);
    const { container: b } = renderCard(funil());
    const m = (el: Element) => el.className.match(/min-h-\S+/)?.[0];
    expect(m(a.firstElementChild!)).toBeDefined();
    expect(m(a.firstElementChild!)).toBe(m(b.firstElementChild!));
    expect(a.firstElementChild!.getAttribute("aria-hidden")).toBe("true");
  });
});
