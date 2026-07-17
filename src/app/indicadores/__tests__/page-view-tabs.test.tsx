/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Recharts não renderiza em jsdom sem dimensões; os gráficos não são o objeto
// deste teste.
jest.mock("@/components/indicadores/trend-charts", () => ({
  ChartSkeleton: () => null,
  MetaAdsInvestimentoLeadsChart: () => null,
  MetaAdsCplChart: () => null,
  HotmartVendasChart: () => null,
  LeadsCaptacoesChart: () => null,
}));

// Fora do runtime do Next, useSearchParams lê direto da URL do jsdom.
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import IndicadoresPage from "../page";
import type { FilterRecord } from "@/types/indicadores";

const LS_FILTER_ID = "indicadores_active_filter_id";

const FULL_FILTER: FilterRecord = {
  id: "f-1",
  account_id: "acc-1",
  name: "Ingresso PC Ao Vivo",
  hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
  meta_ads_terms: ["PC Ao Vivo"],
  captacao_leads_eventos: ["evento-a"],
  status: "ativo",
  status_changed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

let requests: string[] = [];

function jsonOk(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

function installFetch(filters: FilterRecord[]) {
  requests = [];
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);

    if (url.startsWith("/api/accounts")) return jsonOk([{ id: "acc-1" }]);
    if (url.startsWith("/api/indicadores/filters")) return jsonOk(filters);
    if (url.startsWith("/api/indicadores/leads")) return jsonOk({ total: 0, by_event: [], by_source: [] });
    if (url.startsWith("/api/indicadores/daily")) return jsonOk([]);
    if (url.startsWith("/api/indicadores/metrics")) return jsonOk({ meta_spend: 10, meta_leads: 5 });
    if (url.startsWith("/api/indicadores/hotmart"))
      return jsonOk({ products: [], total_sales: 0, total_sales_brl: 0, total_sales_foreign: 0, total_revenue: 0 });
    if (url.startsWith("/api/indicadores/conversion-sources")) return jsonOk([]);
    return jsonOk(null);
  }) as unknown as typeof fetch;
}

async function renderAt(url: string, filter: FilterRecord | null = FULL_FILTER) {
  window.history.replaceState(null, "", url);
  if (filter) localStorage.setItem(LS_FILTER_ID, filter.id);
  installFetch(filter ? [filter] : []);
  render(<IndicadoresPage />);
  if (filter) {
    await waitFor(() =>
      expect(requests.some((u) => u.startsWith("/api/indicadores/daily"))).toBe(true)
    );
  }
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  window.history.replaceState(null, "", "/indicadores");
});

describe("IndicadoresPage — abas Dashboard | Planilha", () => {
  it("abre no Dashboard sem o parâmetro view", async () => {
    await renderAt("/indicadores");

    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Resultado")).toBeInTheDocument();
    expect(screen.queryByTestId("planilha-view")).not.toBeInTheDocument();
  });

  it("abre direto na Planilha com ?view=planilha (critério 6 do PRD)", async () => {
    await renderAt("/indicadores?view=planilha");

    expect(screen.getByRole("tab", { name: "Planilha" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("planilha-view")).toBeInTheDocument();
    expect(screen.queryByText("Resultado")).not.toBeInTheDocument();
  });

  it("valor inválido de view cai no Dashboard", async () => {
    await renderAt("/indicadores?view=qualquer-coisa");

    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByTestId("planilha-view")).not.toBeInTheDocument();
  });

  it("clicar em Planilha troca o corpo e reflete ?view=planilha na URL sem recarregar", async () => {
    await renderAt("/indicadores");

    fireEvent.click(screen.getByRole("tab", { name: "Planilha" }));

    expect(screen.getByTestId("planilha-view")).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("view")).toBe("planilha");

    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));

    expect(screen.getByText("Resultado")).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("view")).toBe(false);
  });

  it("trocar de aba não refaz as consultas do Dashboard se Evento e período não mudaram (RF-6)", async () => {
    await renderAt("/indicadores");
    const before = requests.filter((u) => u.startsWith("/api/indicadores/") && !u.includes("breakdown=")).length;

    fireEvent.click(screen.getByRole("tab", { name: "Planilha" }));
    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));

    const after = requests.filter((u) => u.startsWith("/api/indicadores/") && !u.includes("breakdown=")).length;
    expect(after).toBe(before);
  });

  it("sem Evento ativo, a aba Planilha mostra o mesmo empty state do Dashboard", async () => {
    await renderAt("/indicadores?view=planilha", null);

    await waitFor(() =>
      expect(requests.some((u) => u.startsWith("/api/indicadores/filters"))).toBe(true)
    );

    expect(screen.queryByTestId("planilha-view")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum filtro selecionado")).toBeInTheDocument();
  });
});
