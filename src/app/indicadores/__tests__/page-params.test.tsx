/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import IndicadoresPage from "../page";
import { calcPresetDates } from "@/lib/utils/period-presets";
import type { FilterRecord } from "@/types/indicadores";

// Recharts não renderiza em jsdom sem dimensões; os gráficos não são o objeto
// deste teste.
jest.mock("@/components/indicadores/trend-charts", () => ({
  ChartSkeleton: () => null,
  MetaAdsInvestimentoLeadsChart: () => null,
  MetaAdsCplChart: () => null,
  HotmartVendasChart: () => null,
  LeadsCaptacoesChart: () => null,
}));

const LS_FILTER_ID = "indicadores_active_filter_id";

const FULL_FILTER: FilterRecord = {
  id: "f-1",
  account_id: "acc-1",
  name: "Ingresso PC Ao Vivo",
  hotmart_products: [
    { product_id: "111", product_name: "Ingresso" },
    { product_id: "222", product_name: "Upsell" },
  ],
  meta_ads_terms: ["PC Ao Vivo", "Ingresso"],
  captacao_leads_eventos: ["evento-a", "evento-b"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const HOTMART_PAYLOAD = {
  products: [
    { product_id: "111", product_name: "Ingresso", sales_count: 3, revenue: 300 },
    { product_id: "222", product_name: "Upsell", sales_count: 1, revenue: 100 },
  ],
  total_sales: 4,
  total_sales_brl: 4,
  total_sales_foreign: 0,
  total_revenue: 400,
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
    if (url.startsWith("/api/indicadores/hotmart")) return jsonOk(HOTMART_PAYLOAD);
    if (url.startsWith("/api/indicadores/conversion-sources")) return jsonOk([]);
    if (url.startsWith("/api/hotmart/offers")) {
      return jsonOk([{ offer_code: "OFERTA-X", offer_name: "Oferta X", price: 100 }]);
    }
    return jsonOk(null);
  }) as unknown as typeof fetch;
}

/** Os parâmetros que de fato chegaram a um endpoint, já decodificados. */
function paramsSentTo(path: string): URLSearchParams[] {
  return requests
    .filter((url) => url.startsWith(path))
    .map((url) => new URLSearchParams(url.slice(url.indexOf("?"))));
}

function lastParamsSentTo(path: string): URLSearchParams {
  const all = paramsSentTo(path);
  if (all.length === 0) throw new Error(`nenhuma requisição para ${path}`);
  return all[all.length - 1];
}

const DAILY = "/api/indicadores/daily";
const METRICS = "/api/indicadores/metrics";
const HOTMART = "/api/indicadores/hotmart";
const SOURCES = "/api/indicadores/conversion-sources";
const LEADS = "/api/indicadores/leads";

/** Endpoints que recebem o filtro inteiro (Meta + Hotmart + eventos + oferta). */
const FULL_SCOPE_ENDPOINTS = [DAILY, METRICS, HOTMART, SOURCES];

async function renderWithActiveFilter(filter: FilterRecord) {
  localStorage.setItem(LS_FILTER_ID, filter.id);
  installFetch([filter]);
  render(<IndicadoresPage />);
  await waitFor(() => expect(paramsSentTo(DAILY).length).toBeGreaterThan(0));
}

beforeEach(() => {
  localStorage.clear();
});

describe("IndicadoresPage — parâmetros enviados aos endpoints", () => {
  it("envia a cada endpoint de escopo completo o período e todo o conteúdo do filtro", async () => {
    await renderWithActiveFilter(FULL_FILTER);
    const { startDate, endDate } = calcPresetDates("28d", new Date().toISOString().slice(0, 10));

    for (const endpoint of FULL_SCOPE_ENDPOINTS) {
      const params = lastParamsSentTo(endpoint);
      expect(params.get("start_date")).toBe(startDate);
      expect(params.get("end_date")).toBe(endDate);
      expect(params.getAll("meta_terms[]")).toEqual(["PC Ao Vivo", "Ingresso"]);
      expect(params.getAll("product_ids[]")).toEqual(["111", "222"]);
      expect(params.getAll("eventos[]")).toEqual(["evento-a", "evento-b"]);
    }
  });

  it("envia ao endpoint de leads apenas os eventos — ele não filtra por produto nem por termo de Meta", async () => {
    await renderWithActiveFilter(FULL_FILTER);

    const params = lastParamsSentTo(LEADS);
    expect(params.getAll("eventos[]")).toEqual(["evento-a", "evento-b"]);
    expect(params.getAll("meta_terms[]")).toEqual([]);
    expect(params.getAll("product_ids[]")).toEqual([]);
    expect(params.get("start_date")).toBeTruthy();
    expect(params.get("end_date")).toBeTruthy();
  });

  it("nunca envia filter_id — nenhum endpoint de indicadores lê esse parâmetro", async () => {
    await renderWithActiveFilter(FULL_FILTER);

    const todas = requests.filter((url) => url.startsWith("/api/indicadores/"));
    expect(todas.length).toBeGreaterThan(0);
    for (const url of todas) {
      expect(new URLSearchParams(url.slice(url.indexOf("?"))).has("filter_id")).toBe(false);
    }
  });

  it("não consulta as fontes que o filtro não configura — elas nascem zeradas, sem spinner", async () => {
    await renderWithActiveFilter({
      ...FULL_FILTER,
      meta_ads_terms: [],
      captacao_leads_eventos: [],
    });

    // Hotmart configurado: consultado.
    expect(paramsSentTo(HOTMART).length).toBeGreaterThan(0);
    expect(paramsSentTo(SOURCES).length).toBeGreaterThan(0);
    // Meta e leads não configurados: nunca consultados.
    expect(paramsSentTo(METRICS)).toEqual([]);
    expect(paramsSentTo(LEADS)).toEqual([]);
    // O período (daily) continua sendo consultado sempre.
    expect(paramsSentTo(DAILY).length).toBeGreaterThan(0);
  });

  it("não consulta endpoint algum de indicadores enquanto não há filtro ativo", async () => {
    installFetch([FULL_FILTER]);
    render(<IndicadoresPage />);

    await waitFor(() => expect(requests.some((u) => u.startsWith("/api/indicadores/filters"))).toBe(true));

    expect(paramsSentTo(DAILY)).toEqual([]);
    expect(paramsSentTo(HOTMART)).toEqual([]);
    expect(paramsSentTo(METRICS)).toEqual([]);
    expect(paramsSentTo(LEADS)).toEqual([]);
  });

  it("propaga a oferta selecionada aos endpoints de escopo completo, mas nunca ao de leads", async () => {
    await renderWithActiveFilter(FULL_FILTER);

    // Abre o painel Hotmart e seleciona produto + oferta.
    fireEvent.click(screen.getByRole("tab", { name: /Hotmart/i }));
    const [produtoSelect] = screen.getAllByRole("combobox");
    fireEvent.change(produtoSelect, { target: { value: "111" } });

    await waitFor(() => expect(screen.getAllByRole("combobox").length).toBe(2));
    const ofertaSelect = screen.getAllByRole("combobox")[1];
    await waitFor(() => expect(ofertaSelect.querySelectorAll("option").length).toBeGreaterThan(1));
    fireEvent.change(ofertaSelect, { target: { value: "OFERTA-X" } });

    await waitFor(() => expect(lastParamsSentTo(HOTMART).get("offer_code")).toBe("OFERTA-X"));

    for (const endpoint of FULL_SCOPE_ENDPOINTS) {
      expect(lastParamsSentTo(endpoint).get("offer_code")).toBe("OFERTA-X");
    }
    // O endpoint de leads não filtra por oferta: nenhuma requisição carrega offer_code.
    for (const params of paramsSentTo(LEADS)) {
      expect(params.has("offer_code")).toBe(false);
    }
  });
});
