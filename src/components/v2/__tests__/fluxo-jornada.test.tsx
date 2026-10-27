/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { FluxoJornada } from "../evento/fluxo-jornada";
import { Corpo } from "../evento/bloco";
import { durFluxo } from "../motion/variants";
import { mockReducedMotion } from "./helpers";

const css = readFileSync(join(__dirname, "../ui/ui.css"), "utf8");
const tokens = readFileSync(join(__dirname, "../tokens.css"), "utf8");

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
  { label: "Conversão LP→Lead", pct: null },
  { label: "Taxa de Fechamento", pct: 4 },
];

describe("FluxoJornada", () => {
  beforeEach(() => mockReducedMotion(false));

  it("um card por etapa, na ordem do funil, com a origem do dado", () => {
    render(<FluxoJornada etapas={ETAPAS} taxas={TAXAS} />);
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(5);
    expect(cards[0].textContent).toContain("Impressões");
    expect(cards[0].textContent).toContain("Meta Ads");
    expect(cards[4].textContent).toContain("Vendas aprovadas");
    expect(cards[4].textContent).toContain("Hotmart");
  });

  it("a taxa de cada corda aparece no selo e é lida no card de chegada; taxa nula vira corda tracejada", () => {
    const { container } = render(<FluxoJornada etapas={ETAPAS} taxas={TAXAS} />);
    expect(screen.getByText(/^CTR: 4,00%/)).toBeTruthy();
    expect(screen.getByText(/^Conversão LP→Lead: sem taxa calculável/)).toBeTruthy();
    expect(container.querySelectorAll(".v2-fl-taxa").length).toBe(4);
    // 4 cordas x 2 desenhos (horizontal e vertical); a de taxa nula é tracejada e não se traça
    expect(container.querySelectorAll(".v2-fl-corda").length).toBe(8);
    expect(container.querySelectorAll(".v2-fl-corda-vazia").length).toBe(2);
  });

  it("cada card entra no seu índice, e só o último leva o ponto âmbar", () => {
    const { container } = render(<FluxoJornada etapas={ETAPAS} taxas={TAXAS} />);
    const cards = Array.from(container.querySelectorAll<HTMLElement>("li"));
    expect(cards.map((c) => c.style.getPropertyValue("--i"))).toEqual(["0", "1", "2", "3", "4"]);
    expect(container.querySelectorAll(".v2-fl-ponto").length).toBe(1);
    expect(cards[4].querySelector(".v2-fl-ponto")).not.toBeNull();
  });

  it("passar o mouse ou focar um card esmaece os outros e as cordas que não o tocam", () => {
    const { container } = render(<FluxoJornada etapas={ETAPAS} taxas={TAXAS} />);
    const cards = Array.from(container.querySelectorAll<HTMLElement>("li"));
    expect(container.querySelector(".opacity-45")).toBeNull();
    fireEvent.focus(cards[2]);
    expect(container.querySelectorAll(".opacity-45").length).toBe(4);
    // com a etapa 2 ativa, só as cordas 1 (1→2) e 2 (2→3) ficam acesas: as de saída 0 e 3 esmaecem
    const taxas = Array.from(container.querySelectorAll<HTMLElement>(".v2-fl-taxa > span"));
    expect(taxas.map((t) => t.classList.contains("opacity-30"))).toEqual([true, false, false, true]);
    fireEvent.blur(cards[2]);
    expect(container.querySelector(".opacity-45")).toBeNull();
    fireEvent.pointerEnter(cards[0]);
    expect(container.querySelectorAll(".opacity-45").length).toBe(4);
    fireEvent.pointerLeave(cards[0]);
    expect(container.querySelector(".opacity-45")).toBeNull();
  });

  it("espera ficar visível para se desenhar", () => {
    const { container } = render(<FluxoJornada etapas={ETAPAS} taxas={TAXAS} />);
    expect(container.querySelector("[data-gate]")).not.toBeNull();
  });
});

describe("Corpo: troca de filtro não redesenha o gráfico", () => {
  const consulta = (chave: string) =>
    ({ data: { chave, data: null }, isPlaceholderData: false, isError: false }) as unknown as Parameters<typeof Corpo>[0]["consultas"][number];

  it("a entrada não leva data-troca; depois do filtro, o conteúdo remontado leva", () => {
    const { container, rerender } = render(<Corpo consultas={[consulta("a")]}>x</Corpo>);
    expect(container.querySelector("[data-troca]")).toBeNull();
    rerender(<Corpo consultas={[consulta("b")]}>x</Corpo>);
    expect(container.querySelector("[data-troca]")).not.toBeNull();
  });
});

describe("tokens e CSS do fluxo", () => {
  it("o passo e a corda estão nos tokens, e o aparelho fraco usa o passo curto", () => {
    expect(tokens).toMatch(/--v2-fluxo-passo:\s*420ms/);
    expect(tokens).toMatch(/--v2-fluxo-corda:\s*480ms/);
    expect(css.match(/\.v2\[data-movimento="curto"\]\s*\{([^}]*)\}/)![1]).toMatch(/--v2-fluxo-passo:\s*160ms/);
    expect(durFluxo.passo * 1000).toBe(420);
    expect(durFluxo.passoCurto * 1000).toBe(160);
  });

  it("card, corda, taxa e ponto escalonam pelo índice da etapa", () => {
    for (const classe of ["v2-fl-card", "v2-fl-corda", "v2-fl-taxa"]) {
      const bloco = css.match(new RegExp(String.raw`\.v2 \.${classe}\s*\{([^}]*)\}`));
      expect(bloco?.[1]).toMatch(/--i, 0\) \* var\(--v2-fluxo-passo\)/);
    }
    expect(css).toMatch(/\.v2-fl-pulso\s*\{\s*animation-delay:[^}]*--v2-fluxo-passo/);
  });
});
