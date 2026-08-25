/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import IndicadoresPage from "../page";
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

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const LS_FILTER_ID = "indicadores_active_filter_id";

const FILTER: FilterRecord = {
  id: "f-1",
  account_id: "acc-1",
  name: "Protocolo 6%",
  hotmart_products: [{ product_id: "8043650", product_name: "Protocolo 6%" }],
  meta_ads_terms: [],
  captacao_leads_eventos: [],
  status: "ativo",
  status_changed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function jsonOk(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

/**
 * A resposta de /api/indicadores/hotmart é controlada manualmente por chamada:
 * a 1ª chamada (período padrão 28d, disparada no mount) fica pendente até o
 * teste resolvê-la; a 2ª chamada (período que o teste escolhe depois) resolve
 * na hora. Isso simula a janela antiga (mais lenta) respondendo DEPOIS da
 * janela nova (mais rápida) — a ordem real que causou o bug.
 */
function installFetchWithControlledHotmart() {
  const hotmartResolvers: Array<(body: unknown) => void> = [];
  const hotmartUrls: string[] = [];

  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.startsWith("/api/accounts")) return jsonOk([{ id: "acc-1" }]);
    if (url.startsWith("/api/indicadores/filters")) return jsonOk([FILTER]);
    if (url.startsWith("/api/indicadores/leads")) return jsonOk({ total: 0, by_event: [], by_source: [] });
    if (url.startsWith("/api/indicadores/daily")) return jsonOk([]);
    if (url.startsWith("/api/indicadores/metrics")) return jsonOk(null);
    if (url.startsWith("/api/indicadores/conversion-sources")) return jsonOk([]);
    if (url.startsWith("/api/indicadores/hotmart")) {
      hotmartUrls.push(url);
      return new Promise<Response>((resolve) => {
        hotmartResolvers.push((body: unknown) =>
          resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response));
      });
    }
    return jsonOk(null);
  }) as unknown as typeof fetch;

  return {
    hotmartCallCount: () => hotmartResolvers.length,
    hotmartUrls,
    // 1-based, como nas chamadas reais (1ª chamada = índice 1).
    resolveHotmartCall: (callNumber: number, body: unknown) => hotmartResolvers[callNumber - 1](body),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("IndicadoresPage — resposta desatualizada da Hotmart", () => {
  it("mantém o total da janela de datas mais recente mesmo quando a resposta da janela antiga chega depois", async () => {
    localStorage.setItem(LS_FILTER_ID, FILTER.id);
    const { resolveHotmartCall, hotmartCallCount } = installFetchWithControlledHotmart();

    render(<IndicadoresPage />);

    // 1ª chamada (janela padrão 28d) disparada no mount; ainda pendente.
    await waitFor(() => expect(hotmartCallCount()).toBeGreaterThanOrEqual(1));

    // Usuário troca a janela de datas — cada edição dispara sua própria
    // chamada (React comita os dois fireEvent em separado).
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
    fireEvent.change(dateInputs[0], { target: { value: "2026-07-02" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-08-25" } });

    // Espera todas as chamadas disparadas pelas duas edições existirem, e
    // resolve qualquer uma intermediária (a que interessa é sempre a última).
    await waitFor(() => expect(hotmartCallCount()).toBeGreaterThanOrEqual(2));
    const finalCallCountBeforeResolve = hotmartCallCount();
    for (let call = 2; call < finalCallCountBeforeResolve; call++) {
      resolveHotmartCall(call, { products: [], total_sales: 0, total_sales_brl: 0, total_sales_foreign: 0, total_revenue: 0 });
    }

    // A última chamada (janela 02/07–25/08, a que o usuário efetivamente
    // pediu) responde primeiro, com o total correto.
    const finalCall = finalCallCountBeforeResolve;
    resolveHotmartCall(finalCall, {
      products: [],
      total_sales: 918,
      total_sales_brl: 868,
      total_sales_foreign: 50,
      total_revenue: 25508.73,
    });

    await waitFor(() => expect(screen.queryByText("918")).not.toBeNull());

    // A 1ª chamada (janela antiga 28d) só responde AGORA, depois da nova.
    resolveHotmartCall(1, {
      products: [],
      total_sales: 625,
      total_sales_brl: 625,
      total_sales_foreign: 0,
      total_revenue: 17921,
    });

    // Dá tempo real para a resposta desatualizada, se for aceita, se propagar
    // ao DOM — sem isso um waitFor que já começa "verde" passaria sem provar
    // nada.
    await new Promise((r) => setTimeout(r, 100));

    // A resposta desatualizada não pode sobrescrever o total da janela atual.
    expect(screen.queryByText("625")).toBeNull();
    expect(screen.queryByText("918")).not.toBeNull();
  });
});
