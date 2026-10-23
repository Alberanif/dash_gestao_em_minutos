/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { FilterRecord, FilterStatus } from "@/types/indicadores";
import { EventosLista } from "../eventos/eventos-lista";
import { MetricasCelulas } from "../eventos/metricas-celulas";
import { EventosErro, EventosVazio } from "../eventos/estados";
import { hrefDoEvento } from "../eventos/pastas";
import { mockReducedMotion } from "./helpers";

beforeEach(() => mockReducedMotion(false));

function evento(id: string, name: string, status: FilterStatus, extra: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id,
    account_id: "acc",
    name,
    hotmart_products: [{ product_id: "1", product_name: "P" }],
    meta_ads_terms: ["PC", "  "],
    captacao_leads_eventos: [],
    status,
    status_changed_at: "2026-07-02T15:00:00Z",
    created_at: "2026-06-01T15:00:00Z",
    updated_at: "2026-07-02T15:00:00Z",
    ...extra,
  };
}

const filtros = [
  evento("a1", "Imersão Alfa", "ativo"),
  evento("a2", "Imersão Beta", "ativo"),
  evento("f1", "Encontro 2025", "finalizado"),
  evento("c1", "Evento Cancelado", "cancelado"),
];

const slots = Object.fromEntries(filtros.map((f) => [f.id, <span key={f.id}>métricas {f.id}</span>]));

function renderLista(lista = filtros) {
  return render(<EventosLista filters={lista} metricas={slots} />);
}

describe("EventosLista", () => {
  it("abre só a pasta de ativos; finalizados e cancelados começam recolhidos", () => {
    renderLista();
    expect((screen.getByRole("button", { name: /Eventos ativos/ })).getAttribute("aria-expanded")).toBe("true");
    expect((screen.getByRole("button", { name: /Eventos finalizados/ })).getAttribute("aria-expanded")).toBe("false");
    expect((screen.getByRole("button", { name: /Eventos cancelados/ })).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Imersão Alfa")).not.toBeNull();
    expect(screen.queryByText("Encontro 2025")).toBeNull();
  });

  it("mostra a contagem de cada status no resumo, mesmo com a pasta recolhida", () => {
    renderLista();
    const resumo = within(screen.getByRole("list", { name: "Resumo por status" }));
    expect(within(resumo.getByText("Ativos").closest("li")!).getByText("2")).not.toBeNull();
    expect(within(resumo.getByText("Finalizados").closest("li")!).getByText("1")).not.toBeNull();
    expect(within(resumo.getByText("Cancelados").closest("li")!).getByText("1")).not.toBeNull();
  });

  it("abrir a pasta de finalizados mostra os eventos dela", () => {
    renderLista();
    fireEvent.click(screen.getByRole("button", { name: /Eventos finalizados/ }));
    expect(screen.getByText("Encontro 2025")).not.toBeNull();
    expect((screen.getByRole("button", { name: /Eventos finalizados/ })).getAttribute("aria-expanded")).toBe("true");
  });

  it("cada cartão leva ao dashboard do evento e traz as métricas do próprio evento", () => {
    renderLista();
    const link = screen.getByRole("link", { name: "Imersão Alfa" });
    expect(link.getAttribute("href")).toBe(hrefDoEvento("a1"));
    expect((link).getAttribute("href")).toBe("/v2/indicadores/a1");
    const cartao = screen.getByTestId("evento-card-a1");
    expect(within(cartao).getByText("métricas a1")).not.toBeNull();
    expect(within(cartao).queryByText("métricas a2")).toBeNull();
  });

  it("evento cancelado fica esmaecido e oferece 'Ver dashboard'", () => {
    renderLista();
    fireEvent.click(screen.getByRole("button", { name: /Eventos cancelados/ }));
    const cartao = screen.getByTestId("evento-card-c1");
    expect(cartao.className).toContain("opacity-60");
    expect(within(cartao).getByText("Ver dashboard")).not.toBeNull();
    expect(within(screen.getByTestId("evento-card-a1")).getByText("Abrir dashboard")).not.toBeNull();
  });

  it("a busca filtra por nome, abre todas as pastas e atualiza a contagem das pastas", () => {
    renderLista();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar evento" }), { target: { value: "encontro" } });
    expect(screen.getByText("Encontro 2025")).not.toBeNull();
    expect(screen.queryByText("Imersão Alfa")).toBeNull();
    // ativos e cancelados não casam com a busca: as duas pastas vazias avisam
    expect(screen.getAllByText("Nenhum evento encontrado nesta pasta.")).toHaveLength(2);
  });

  it("busca sem resultado mostra a ação de limpar e a limpeza restaura a lista", () => {
    renderLista();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar evento" }), { target: { value: "zzz" } });
    expect(screen.getByText(/Nenhum evento com “zzz”/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(screen.getByText("Imersão Alfa")).not.toBeNull();
  });

  it("composição do evento aparece como subtítulo, sem partes zeradas", () => {
    renderLista();
    expect(within(screen.getByTestId("evento-card-a1")).getByText("1 produto · 1 campanha")).not.toBeNull();
  });

  it("o âmbar marca só o marcador de ativos, nunca finalizados ou cancelados", () => {
    const { container } = renderLista();
    fireEvent.click(screen.getByRole("button", { name: /Eventos finalizados/ }));
    fireEvent.click(screen.getByRole("button", { name: /Eventos cancelados/ }));
    const ambar = container.querySelectorAll(".bg-v2-ponto");
    const ativos = filtros.filter((f) => f.status === "ativo").length;
    // resumo + cabeçalho da pasta + um por cartão ativo
    expect(ambar.length).toBe(2 + ativos);
    for (const el of Array.from(ambar)) expect(el.closest("[data-testid='evento-card-f1'],[data-testid='evento-card-c1']")).toBeNull();
  });
});

describe("MetricasCelulas", () => {
  it("formata leads, CPL e investimento em pt-BR", () => {
    mockReducedMotion(true);
    render(<MetricasCelulas metrics={{ leads: 1234, cpl: 5.5, spend: 6789.1 }} />);
    expect(screen.getByLabelText("1.234")).not.toBeNull();
    expect(screen.getByLabelText(/R\$\s?5,50/)).not.toBeNull();
    expect(screen.getByLabelText(/R\$\s?6\.789,10/)).not.toBeNull();
  });

  it("valor ausente aparece como traço, não como zero", () => {
    render(<MetricasCelulas metrics={{ leads: null, cpl: null, spend: 10 }} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("métricas indisponíveis (null) deixam as três células em traço", () => {
    render(<MetricasCelulas metrics={null} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});

describe("estados", () => {
  it("vazio explica o que fazer e oferece a ação de criar", () => {
    render(<EventosVazio />);
    expect(screen.getByRole("heading", { name: "Nenhum evento ainda" })).not.toBeNull();
    expect((screen.getByRole("link", { name: "Criar evento" })).getAttribute("href")).toBe("/indicadores/eventos");
  });

  it("erro é um alerta com ação de tentar de novo na mesma rota", () => {
    render(<EventosErro />);
    expect(screen.getByRole("alert")).not.toBeNull();
    expect((screen.getByRole("link", { name: "Tentar de novo" })).getAttribute("href")).toBe("/v2/indicadores/eventos");
  });
});
