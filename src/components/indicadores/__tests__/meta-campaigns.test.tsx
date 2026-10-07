/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlatformsCard } from "../platforms-card";
import type {
  GlobalMetrics,
  GlobalHotmartMetrics,
  MetaCampaignRow,
  MetaCampaignsResponse,
} from "@/types/indicadores";

jest.mock("../trend-charts", () => ({
  MetaAdsInvestimentoLeadsChart: () => null,
  HotmartVendasChart: () => null,
}));
jest.mock("../hotmart-card", () => ({
  HotmartPanel: () => <div>hotmart-panel</div>,
}));

const M: GlobalMetrics = {
  meta_spend: 1000,
  meta_cpm: 10,
  meta_ctr: 2,
  meta_leads: 100,
  meta_checkout: 5,
  meta_impressions: 1000,
  meta_link_clicks: 20,
  meta_page_views: 10,
  meta_connect_rate: 50,
  meta_lp_conversion: 10,
  meta_cpl_traffic: 10,
};

function row(i: number, over: Partial<MetaCampaignRow> = {}): MetaCampaignRow {
  return { ...M, campaign_id: `c${i}`, campaign_name: `Campanha ${i}`, ...over };
}

function resp(n: number, hidden = 0, total: Partial<GlobalMetrics> = {}): MetaCampaignsResponse {
  return {
    campaigns: Array.from({ length: n }, (_, i) => row(i + 1)),
    hidden_zero_spend: hidden,
    total: { ...M, meta_spend: 1234.5, ...total },
  };
}

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

const hotmart = { products: [] } as unknown as GlobalHotmartMetrics;
const idle = { data: null, loading: false, error: false };

function card(props: { hasMetaFilter?: boolean; campaignsParams?: string } = {}) {
  return (
    <PlatformsCard
      metaState={{ data: M, loading: false, error: false }}
      hotmartState={{ data: hotmart, loading: false, error: false }}
      dailyState={idle}
      hasMetaFilter={props.hasMetaFilter}
      campaignsParams={props.campaignsParams ?? "?a=1"}
    />
  );
}

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("Ver Mais / busca por nome", () => {
  afterEach(() => jest.useRealTimers());
  const search = () => screen.getByLabelText("Buscar campanha por nome");

  it("só busca após o debounce, com q codificado, e volta à página 1", async () => {
    fetchMock.mockImplementation(() => okJson(resp(7)));
    render(card());
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");
    fireEvent.click(screen.getByText("Próxima"));

    jest.useFakeTimers();
    fireEvent.change(search(), { target: { value: " black&lp " } });
    act(() => { jest.advanceTimersByTime(299); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(1); });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/indicadores/campaigns?a=1&q=black%26lp");
    jest.useRealTimers();

    await screen.findByText("Campanha 1");
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
  });

  it("sem resultado mostra a mensagem com o termo", async () => {
    fetchMock.mockImplementationOnce(() => okJson(resp(2)));
    render(card());
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");

    fetchMock.mockImplementation(() => okJson(resp(0, 0)));
    fireEvent.change(search(), { target: { value: "xyz" } });
    await screen.findByText("Nenhuma campanha encontrada para 'xyz'.");
    expect(search()).toHaveValue("xyz");
  });

  it("× limpa o campo e restaura a lista completa", async () => {
    fetchMock.mockImplementation(() => okJson(resp(2)));
    render(card());
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");
    fireEvent.change(search(), { target: { value: "abc" } });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/indicadores/campaigns?a=1&q=abc"),
    );

    fireEvent.click(screen.getByLabelText("Limpar busca"));
    expect(search()).toHaveValue("");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/indicadores/campaigns?a=1"),
    );
  });

  it("o termo sobrevive à mudança de params e zera ao Voltar", async () => {
    fetchMock.mockImplementation(() => okJson(resp(2)));
    const { rerender } = render(card({ campaignsParams: "?a=1" }));
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");
    fireEvent.change(search(), { target: { value: "abc" } });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/indicadores/campaigns?a=1&q=abc"),
    );

    rerender(card({ campaignsParams: "?a=2" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/indicadores/campaigns?a=2&q=abc"),
    );
    expect(search()).toHaveValue("abc");

    fireEvent.click(screen.getByText("← Voltar"));
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");
    expect(search()).toHaveValue("");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/indicadores/campaigns?a=2");
  });
});

describe("Ver Mais / lista de campanhas", () => {
  it("nao mostra Ver Mais sem filtro Meta", () => {
    render(card({ hasMetaFilter: false }));
    expect(screen.queryByText("Ver Mais")).toBeNull();
  });

  it("abre a lista, pagina de 5 em 5, mostra Total e aviso de ocultas", async () => {
    fetchMock.mockImplementation(() => okJson(resp(7, 3)));
    render(card());
    fireEvent.click(screen.getByText("Ver Mais"));

    await screen.findByText("Campanha 1");
    expect(fetchMock).toHaveBeenCalledWith("/api/indicadores/campaigns?a=1");
    expect(screen.getAllByTestId("campaign-row")).toHaveLength(5);
    expect(screen.getByTestId("campaign-total")).toHaveTextContent("R$ 1.234,50");
    expect(screen.getByText("3 campanhas sem gasto ocultas")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Próxima"));
    expect(screen.getAllByTestId("campaign-row")).toHaveLength(2);
    expect(screen.getByText("Campanha 6")).toBeInTheDocument();
    expect(screen.queryByText("Campanha 1")).toBeNull();
  });

  it("nao mostra aviso quando nao ha ocultas", async () => {
    fetchMock.mockImplementation(() => okJson(resp(2, 0)));
    render(card());
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");
    expect(screen.queryByText(/sem gasto oculta/)).toBeNull();
  });

  it("Voltar retorna ao resumo de KPIs", async () => {
    fetchMock.mockImplementation(() => okJson(resp(2)));
    render(card());
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");
    fireEvent.click(screen.getByText("← Voltar"));
    expect(screen.getByText("Ver Mais")).toBeInTheDocument();
    expect(screen.queryByText("Campanha 1")).toBeNull();
  });

  it("trocar para Hotmart e voltar reabre no resumo", async () => {
    fetchMock.mockImplementation(() => okJson(resp(2)));
    render(card());
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");
    fireEvent.click(screen.getByRole("tab", { name: /Hotmart/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Meta Ads/ }));
    expect(screen.getByText("Ver Mais")).toBeInTheDocument();
  });

  it("mostra erro e vazio", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response),
    );
    const { unmount } = render(card());
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText(/Erro ao carregar campanhas/);
    unmount();

    fetchMock.mockImplementation(() => okJson(resp(0, 2)));
    render(card());
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText(/Nenhuma campanha com gasto/);
  });

  it("mudar params recarrega e volta a pagina 1", async () => {
    fetchMock.mockImplementation(() => okJson(resp(7)));
    const { rerender } = render(card({ campaignsParams: "?a=1" }));
    fireEvent.click(screen.getByText("Ver Mais"));
    await screen.findByText("Campanha 1");
    fireEvent.click(screen.getByText("Próxima"));
    expect(screen.getByText("Campanha 6")).toBeInTheDocument();

    rerender(card({ campaignsParams: "?a=2" }));
    await screen.findByText("Campanha 1");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/indicadores/campaigns?a=2");
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
  });

  it("resposta antiga nao sobrescreve a mais recente", async () => {
    let resolveOld: (v: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolveOld = r)))
      .mockImplementationOnce(() =>
        okJson({ ...resp(1), campaigns: [row(1, { campaign_name: "NOVA" })] }),
      );
    const { rerender } = render(card({ campaignsParams: "?a=1" }));
    fireEvent.click(screen.getByText("Ver Mais"));
    rerender(card({ campaignsParams: "?a=2" }));
    await screen.findByText("NOVA");

    await act(async () => {
      resolveOld({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...resp(1), campaigns: [row(1, { campaign_name: "VELHA" })] }),
      } as Response);
    });
    await waitFor(() => expect(screen.queryByText("VELHA")).toBeNull());
    expect(screen.getByText("NOVA")).toBeInTheDocument();
  });
});
