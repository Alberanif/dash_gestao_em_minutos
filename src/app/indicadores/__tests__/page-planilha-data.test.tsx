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

const WEEK = { index: 1, startDate: "2026-06-18", endDate: "2026-06-24" };

const META_WEEKLY = {
  meta_spend: 600, meta_cpm: 60, meta_ctr: 3, meta_leads: 60, meta_checkout: 12,
  meta_impressions: 10000, meta_link_clicks: 300, meta_page_views: 240,
  meta_connect_rate: 80, meta_lp_conversion: 25, meta_cpl_traffic: 10,
  weeks: [{ ...WEEK, meta_spend: 600, meta_cpm: 60, meta_ctr: 3, meta_leads: 60, meta_checkout: 12, meta_impressions: 10000, meta_link_clicks: 300, meta_page_views: 240, meta_connect_rate: 80, meta_lp_conversion: 25, meta_cpl_traffic: 10 }],
};

const HOTMART_WEEKLY = {
  products: [], total_sales: 30, total_sales_brl: 30, total_sales_foreign: 0, total_revenue: 1200,
  weeks: [{ ...WEEK, total_sales: 30, total_sales_brl: 30, total_sales_foreign: 0, total_revenue: 1200 }],
};

const LEADS_WEEKLY = {
  total: 42, by_event: [], by_source: [{ source: "meta", count: 42 }],
  weeks: [{ ...WEEK, total: 42, by_source: [{ source: "meta", count: 42 }] }],
};

const SOURCES_WEEKLY = {
  sources: [{ source: "instagram", count: 30 }],
  weeks: [{ ...WEEK, sources: [{ source: "instagram", count: 30 }] }],
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
    const weekly = url.includes("breakdown=weekly");

    if (url.startsWith("/api/accounts")) return jsonOk([{ id: "acc-1" }]);
    if (url.startsWith("/api/indicadores/filters")) return jsonOk(filters);
    if (url.startsWith("/api/indicadores/leads"))
      return jsonOk(weekly ? LEADS_WEEKLY : { total: 42, by_event: [], by_source: [] });
    if (url.startsWith("/api/indicadores/daily")) return jsonOk([]);
    if (url.startsWith("/api/indicadores/metrics"))
      return jsonOk(weekly ? META_WEEKLY : { meta_spend: 600, meta_leads: 60 });
    if (url.startsWith("/api/indicadores/hotmart"))
      return jsonOk(weekly ? HOTMART_WEEKLY : { products: [], total_sales: 30, total_sales_brl: 30, total_sales_foreign: 0, total_revenue: 1200 });
    if (url.startsWith("/api/indicadores/conversion-sources"))
      return jsonOk(weekly ? SOURCES_WEEKLY : [{ source: "instagram", count: 30 }]);
    return jsonOk(null);
  }) as unknown as typeof fetch;
}

function weeklyRequests(path: string): URLSearchParams[] {
  return requests
    .filter((url) => url.startsWith(path) && url.includes("breakdown=weekly"))
    .map((url) => new URLSearchParams(url.slice(url.indexOf("?"))));
}

const ALL_WEEKLY_ENDPOINTS = [
  "/api/indicadores/metrics",
  "/api/indicadores/hotmart",
  "/api/indicadores/leads",
  "/api/indicadores/conversion-sources",
];

async function renderAt(url: string, filter: FilterRecord = FULL_FILTER) {
  window.history.replaceState(null, "", url);
  localStorage.setItem(LS_FILTER_ID, filter.id);
  installFetch([filter]);
  render(<IndicadoresPage />);
}

async function waitForPlanilhaData() {
  await waitFor(() => expect(screen.getAllByTestId("planilha-block-title").length).toBe(4));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  window.history.replaceState(null, "", "/indicadores");
});

describe("IndicadoresPage — dados da Planilha", () => {
  it("com a Planilha aberta, consulta os 4 endpoints com breakdown=weekly e o escopo do filtro", async () => {
    await renderAt("/indicadores?view=planilha");
    await waitForPlanilhaData();

    for (const endpoint of ALL_WEEKLY_ENDPOINTS) {
      const calls = weeklyRequests(endpoint);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0].get("start_date")).toBeTruthy();
      expect(calls[0].get("end_date")).toBeTruthy();
    }
    // leads mantém o escopo só-evento também no weekly
    const leads = weeklyRequests("/api/indicadores/leads")[0];
    expect(leads.getAll("eventos[]")).toEqual(["evento-a"]);
    expect(leads.getAll("product_ids[]")).toEqual([]);
    expect(leads.getAll("meta_terms[]")).toEqual([]);
  });

  it("renderiza a tabela com os dados semanais", async () => {
    await renderAt("/indicadores?view=planilha");
    await waitForPlanilhaData();

    await waitFor(() => {
      expect(screen.getByTestId("planilha-vendas-total")).toBeInTheDocument();
    });
    expect(screen.getByRole("row", { name: /Total de Leads/ })).toBeInTheDocument();
    expect(screen.getAllByTestId("planilha-leads-row").length).toBe(1);
  });

  it("alternar de aba sem mudar Evento/período não refaz as consultas weekly (RF-6)", async () => {
    await renderAt("/indicadores?view=planilha");
    await waitForPlanilhaData();
    const before = requests.filter((u) => u.includes("breakdown=weekly")).length;

    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));
    await waitFor(() => expect(screen.getByText("Resultado")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Planilha" }));
    await waitForPlanilhaData();

    const after = requests.filter((u) => u.includes("breakdown=weekly")).length;
    expect(after).toBe(before);
  });

  it("mudar o período com a Planilha aberta refaz as consultas weekly (critério 7)", async () => {
    await renderAt("/indicadores?view=planilha");
    await waitForPlanilhaData();
    const before = weeklyRequests("/api/indicadores/metrics").length;

    fireEvent.click(screen.getByRole("button", { name: "7d" }));

    await waitFor(() => {
      expect(weeklyRequests("/api/indicadores/metrics").length).toBeGreaterThan(before);
    });
  });

  it("fonte não configurada não é consultada e o bloco aparece com o aviso (critério 5)", async () => {
    await renderAt("/indicadores?view=planilha", {
      ...FULL_FILTER,
      hotmart_products: [],
    });
    await waitForPlanilhaData();

    expect(weeklyRequests("/api/indicadores/hotmart")).toEqual([]);
    expect(weeklyRequests("/api/indicadores/conversion-sources")).toEqual([]);
    expect(screen.getAllByText(/não configurado neste filtro — dados zerados/).length).toBeGreaterThan(0);
    // estrutura permanece: 4 blocos
    expect(screen.getAllByTestId("planilha-block-title").length).toBe(4);
  });
});
