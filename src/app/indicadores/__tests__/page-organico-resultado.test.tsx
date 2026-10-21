/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import IndicadoresPage from "../page";
import type { FilterRecord } from "@/types/indicadores";

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

const LS_FILTER_ID = "indicadores_active_filter_id";

function makeFilter(is_organic: boolean): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Evento",
    hotmart_products: [{ product_id: "1", product_name: "P" }],
    meta_ads_terms: ["termo"],
    captacao_leads_eventos: ["ev"],
    is_organic,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function jsonOk(body: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

const META = {
  meta_spend: 500, meta_leads: 200, meta_cpl_traffic: 2.5, meta_impressions: 1000,
  meta_link_clicks: 100, meta_page_views: 80, meta_cpm: 10, meta_lp_conversion: null,
};

function install(filter: FilterRecord, leadsTotal: number, meta: unknown = META) {
  const urls: string[] = [];
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.startsWith("/api/accounts")) return jsonOk([{ id: "acc-1" }]);
    if (url.startsWith("/api/indicadores/filters")) return jsonOk([filter]);
    if (url.startsWith("/api/indicadores/leads")) return jsonOk({ total: leadsTotal, by_event: [], by_source: [] });
    if (url.startsWith("/api/indicadores/daily")) return jsonOk([]);
    if (url.startsWith("/api/indicadores/metrics")) return jsonOk(meta);
    if (url.startsWith("/api/indicadores/hotmart")) {
      return jsonOk({ products: [], total_sales: 7, total_sales_brl: 7, total_sales_foreign: 0, total_revenue: 1 });
    }
    if (url.startsWith("/api/indicadores/conversion-sources")) return jsonOk([]);
    return jsonOk(null);
  }) as unknown as typeof fetch;
  return urls;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LS_FILTER_ID, "f-1");
});

describe("Dashboard orgânico — bloco Resultado", () => {
  it("mostra Leads, Investimento e CPL; sem ROAS/Receita/Vendas; sem fetch de Hotmart/origens", async () => {
    const urls = install(makeFilter(true), 321);
    render(<IndicadoresPage />);

    await waitFor(() => expect(screen.queryByText("Leads capturados")).not.toBeNull());
    expect(screen.queryAllByText("Investimento").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("CPL").length).toBeGreaterThan(0);
    expect(screen.queryByText("ROAS")).toBeNull();
    expect(screen.queryByText("Receita BRL")).toBeNull();
    expect(screen.queryByText("Total de Vendas")).toBeNull();

    await waitFor(() => {
      const card = screen.getByText("Leads capturados").closest("div")?.parentElement;
      expect(card?.textContent).toContain("321");
    });
    expect(urls.some((u) => u.startsWith("/api/indicadores/hotmart"))).toBe(false);
    expect(urls.some((u) => u.startsWith("/api/indicadores/conversion-sources"))).toBe(false);
  });

  it("CPL mostra — quando não há leads", async () => {
    install(makeFilter(true), 0, { ...META, meta_leads: 0, meta_cpl_traffic: null });
    render(<IndicadoresPage />);
    await waitFor(() => expect(screen.queryAllByText("CPL").length).toBeGreaterThan(0));
    await waitFor(() => {
      const card = screen.getAllByText("CPL")[0].closest("div")?.parentElement;
      expect(card?.textContent).toContain("—");
    });
  });

  it("ordem e numeração: 01 Resultado, 02 Captação, 03 Jornada, 04 Plataformas", async () => {
    install(makeFilter(true), 10);
    render(<IndicadoresPage />);
    await waitFor(() => expect(screen.queryByText("Captação de Leads")).not.toBeNull());
    const text = document.body.textContent ?? "";
    expect(text.indexOf("Resultado")).toBeLessThan(text.indexOf("Captação de Leads"));
    expect(text.indexOf("Captação de Leads")).toBeLessThan(text.indexOf("Plataformas"));
    expect(text).toMatch(/02\s*Captação de Leads/);
    expect(text).toMatch(/04\s*Plataformas/);
  });
});

describe("Dashboard pago — inalterado", () => {
  it("mantém ROAS/Receita/Vendas, fetch de Hotmart e numeração 01-04", async () => {
    const urls = install(makeFilter(false), 10);
    render(<IndicadoresPage />);
    await waitFor(() => expect(screen.queryByText("ROAS")).not.toBeNull());
    expect(screen.queryByText("Receita BRL")).not.toBeNull();
    expect(screen.queryByText("Total de Vendas")).not.toBeNull();
    expect(screen.queryByText("Leads capturados")).toBeNull();
    await waitFor(() => expect(urls.some((u) => u.startsWith("/api/indicadores/hotmart"))).toBe(true));
    expect(urls.some((u) => u.startsWith("/api/indicadores/conversion-sources"))).toBe(true);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/03\s*Plataformas/);
    expect(text).toMatch(/04\s*Captação de Leads/);
  });
});
