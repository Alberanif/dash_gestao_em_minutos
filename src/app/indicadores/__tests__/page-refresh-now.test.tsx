/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/indicadores/trend-charts", () => ({
  ChartSkeleton: () => null,
  MetaAdsInvestimentoLeadsChart: () => null,
  MetaAdsCplChart: () => null,
  HotmartVendasChart: () => null,
  LeadsCaptacoesChart: () => null,
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

// O botão em si é testado à parte; aqui só interessa a fiação com o dashboard.
jest.mock("@/components/indicadores/refresh-now-button", () => ({
  RefreshNowButton: ({ onRefreshed }: { onRefreshed: () => void }) => (
    <button data-testid="fake-refresh-done" onClick={onRefreshed}>
      fim da coleta
    </button>
  ),
}));

import IndicadoresPage from "../page";
import type { FilterRecord } from "@/types/indicadores";

const FILTER: FilterRecord = {
  id: "f-1",
  account_id: "acc-1",
  name: "Evento",
  hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
  meta_ads_terms: ["PC"],
  captacao_leads_eventos: ["evento-a"],
  status: "ativo",
  status_changed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

let requests: string[] = [];

function jsonOk(body: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("indicadores_active_filter_id", FILTER.id);
  window.history.replaceState(null, "", "/indicadores");
  requests = [];
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.startsWith("/api/accounts")) return jsonOk([{ id: "acc-1" }]);
    if (url.startsWith("/api/indicadores/filters")) return jsonOk([FILTER]);
    if (url.startsWith("/api/indicadores/cron-status")) return jsonOk({ accounts: [] });
    if (url.startsWith("/api/indicadores/leads")) return jsonOk({ total: 1, by_event: [], by_source: [] });
    if (url.startsWith("/api/indicadores/daily")) return jsonOk([]);
    if (url.startsWith("/api/indicadores/metrics")) return jsonOk({ meta_spend: 1, meta_leads: 1 });
    if (url.startsWith("/api/indicadores/hotmart"))
      return jsonOk({ products: [], total_sales: 1, total_sales_brl: 1, total_sales_foreign: 0, total_revenue: 1 });
    return jsonOk([]);
  }) as unknown as typeof fetch;
});

const count = (prefix: string) => requests.filter((u) => u.startsWith(prefix)).length;

describe("IndicadoresDashboard — Atualizar Agora", () => {
  it("renderiza o botão no rodapé", async () => {
    render(<IndicadoresPage />);
    expect(await screen.findByTestId("fake-refresh-done")).toBeInTheDocument();
  });

  it("ao fim da coleta, refaz os dados e o indicador de frescor sem recarregar a página", async () => {
    render(<IndicadoresPage />);
    await waitFor(() => expect(count("/api/indicadores/metrics")).toBe(1));
    await waitFor(() => expect(count("/api/indicadores/cron-status")).toBe(1));

    fireEvent.click(screen.getByTestId("fake-refresh-done"));

    await waitFor(() => expect(count("/api/indicadores/metrics")).toBe(2));
    expect(count("/api/indicadores/hotmart")).toBe(2);
    expect(count("/api/indicadores/daily")).toBe(2);
    expect(count("/api/indicadores/cron-status")).toBe(2);
    // Bootstrap (contas/eventos) não se repete.
    expect(count("/api/accounts")).toBe(1);
  });
});
