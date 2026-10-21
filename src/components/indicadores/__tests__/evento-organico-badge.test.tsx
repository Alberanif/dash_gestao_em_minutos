/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { EventoOrganicoBadge } from "../evento-organico-badge";
import { EventoCard } from "../evento-card";
import { eventoOrganicBadgeLabel } from "@/lib/indicadores/eventos";
import type { FilterRecord } from "@/types/indicadores";

function makeFilter(overrides: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Evento",
    hotmart_products: [],
    meta_ads_terms: ["termo"],
    captacao_leads_eventos: [],
    is_organic: false,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const ACCENT = { accent: "#4c8dff", bg: "#000", border: "#111" } as never;

describe("eventoOrganicBadgeLabel", () => {
  it("devolve o rótulo só para evento orgânico", () => {
    expect(eventoOrganicBadgeLabel({ is_organic: true })).toBe("Orgânico");
    expect(eventoOrganicBadgeLabel({ is_organic: false })).toBeNull();
  });
});

describe("EventoOrganicoBadge (título do dashboard)", () => {
  it("mostra o selo para evento orgânico", () => {
    render(<EventoOrganicoBadge filter={makeFilter({ is_organic: true })} />);
    expect(screen.getByText("Orgânico")).toBeTruthy();
  });
  it("não mostra selo para evento pago nem sem filtro ativo", () => {
    const { rerender } = render(<EventoOrganicoBadge filter={makeFilter()} />);
    expect(screen.queryByText("Orgânico")).toBeNull();
    rerender(<EventoOrganicoBadge filter={null} />);
    expect(screen.queryByText("Orgânico")).toBeNull();
  });
});

describe("EventoCard (lista de eventos)", () => {
  it("mostra o selo ao lado do nome do evento orgânico", () => {
    render(<EventoCard filter={makeFilter({ is_organic: true })} accent={ACCENT} onOpenDashboard={() => {}} />);
    expect(screen.getByText("Orgânico")).toBeTruthy();
  });
  it("não mostra selo para evento pago", () => {
    render(<EventoCard filter={makeFilter()} accent={ACCENT} onOpenDashboard={() => {}} />);
    expect(screen.queryByText("Orgânico")).toBeNull();
  });
});
