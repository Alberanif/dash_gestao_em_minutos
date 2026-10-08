/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import IndicadoresPage from "../page";
import IndicadoresEventoPage from "../[id]/page";
import { IndicadoresDashboard } from "../indicadores-dashboard";
import type { FilterRecord } from "@/types/indicadores";

jest.mock("@/components/indicadores/trend-charts", () => ({
  ChartSkeleton: () => null,
  MetaAdsInvestimentoLeadsChart: () => null,
  MetaAdsCplChart: () => null,
  HotmartVendasChart: () => null,
  LeadsCaptacoesChart: () => null,
}));

const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace, push: jest.fn() }),
}));

const LS_FILTER_ID = "indicadores_active_filter_id";
const SS_NOTICE = "indicadores_notice";

const ID_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ID_B = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ID_MISSING = "11111111-2222-4333-8444-555555555555";

function makeFilter(id: string, name: string): FilterRecord {
  return {
    id,
    account_id: "acc-1",
    name,
    hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
    meta_ads_terms: ["PC"],
    captacao_leads_eventos: ["evento-a"],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

let requests: string[] = [];

function jsonOk(body: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
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
    if (url.startsWith("/api/indicadores/conversion-sources")) return jsonOk([]);
    return jsonOk(null);
  }) as unknown as typeof fetch;
}

const hits = (path: string) => requests.filter((u) => u.startsWith(path));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  replace.mockClear();
  window.history.replaceState(null, "", "/");
});

describe("/indicadores/[id] — evento ativo definido pela URL", () => {
  it("abre o evento do ID e grava no localStorage, ignorando o que estava salvo", async () => {
    localStorage.setItem(LS_FILTER_ID, ID_B);
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    await waitFor(() => expect(hits("/api/indicadores/daily").length).toBeGreaterThan(0));
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_A);
    expect(screen.getAllByText("Evento A").length).toBeGreaterThan(0);
    expect(screen.queryByText("Evento B")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("respeita ?view= junto com o ID", async () => {
    window.history.replaceState(null, "", `/indicadores/${ID_A}?view=planilha`);
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    expect(await screen.findByTestId("planilha-view")).toBeTruthy();
  });

  it("ID inexistente: replace para /indicadores, limpa o localStorage que apontava para ele e avisa", async () => {
    localStorage.setItem(LS_FILTER_ID, ID_MISSING);
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard eventId={ID_MISSING} />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/indicadores"));
    expect(localStorage.getItem(LS_FILTER_ID)).toBeNull();
    expect(sessionStorage.getItem(SS_NOTICE)).toMatch(/Evento não encontrado/);
  });

  it("ID inexistente não apaga um localStorage que aponta para outro evento", async () => {
    localStorage.setItem(LS_FILTER_ID, ID_A);
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard eventId={ID_MISSING} />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/indicadores"));
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_A);
  });

  it("ID malformado: replace sem consultar o banco (nenhum fetch)", async () => {
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard eventId="nao-e-uuid" />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/indicadores"));
    expect(requests).toEqual([]);
    expect(sessionStorage.getItem(SS_NOTICE)).toMatch(/Evento não encontrado/);
  });

  it("mostra o aviso deixado pela tela anterior e o remove depois de um tempo", async () => {
    jest.useFakeTimers();
    try {
      sessionStorage.setItem(SS_NOTICE, "Evento não encontrado. teste");
      installFetch([]);
      render(<IndicadoresDashboard />);

      expect(screen.getByTestId("indicadores-notice").textContent).toMatch(/teste/);
      expect(sessionStorage.getItem(SS_NOTICE)).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      expect(screen.queryByTestId("indicadores-notice")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("compatibilidade das rotas", () => {
  it("/indicadores sem ID continua restaurando do localStorage (e faz replace para o ID)", async () => {
    localStorage.setItem(LS_FILTER_ID, ID_B);
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    render(<IndicadoresPage />);

    await waitFor(() => expect(hits("/api/indicadores/daily").length).toBeGreaterThan(0));
    expect(replace).toHaveBeenCalledWith(`/indicadores/${ID_B}`);
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_B);
  });

  it("/indicadores sem ID e sem evento salvo mostra a tela vazia", async () => {
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresPage />);

    await waitFor(() => expect(hits("/api/indicadores/filters").length).toBeGreaterThan(0));
    expect(hits("/api/indicadores/daily")).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
  });

  it("a rota [id] repassa o ID da URL (params assíncrono) ao dashboard", async () => {
    const el = (await IndicadoresEventoPage({ params: Promise.resolve({ id: ID_A }) })) as React.ReactElement<{
      eventId: string;
    }>;
    expect(el.type).toBe(IndicadoresDashboard);
    expect(el.props.eventId).toBe(ID_A);
  });
});
