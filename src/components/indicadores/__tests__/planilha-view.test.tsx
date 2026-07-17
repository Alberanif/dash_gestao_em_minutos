/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlanilhaView, type PlanilhaViewProps } from "../planilha-view";
import type {
  GlobalMetricsWithWeeks,
  GlobalHotmartMetricsWithWeeks,
  GlobalLeadsMetricsWithWeeks,
  ConversionSourcesWithWeeks,
  WeekWindow,
} from "@/types/indicadores";

// Exemplo do PRD: 06/07 a 22/07 → 3 semanas quinta→quarta
const WEEKS: WeekWindow[] = [
  { index: 1, startDate: "2026-07-06", endDate: "2026-07-08" },
  { index: 2, startDate: "2026-07-09", endDate: "2026-07-15" },
  { index: 3, startDate: "2026-07-16", endDate: "2026-07-22" },
];

const META: GlobalMetricsWithWeeks = {
  meta_spend: 600,
  meta_cpm: 60,
  meta_ctr: 3,
  meta_leads: 60,
  meta_checkout: 12,
  meta_impressions: 10000,
  meta_link_clicks: 300,
  meta_page_views: 240,
  meta_connect_rate: 80,
  meta_lp_conversion: 25,
  meta_cpl_traffic: 10,
  weeks: [
    { ...WEEKS[0], meta_spend: 100, meta_cpm: 50, meta_ctr: 2.5, meta_leads: 10, meta_checkout: 2, meta_impressions: 2000, meta_link_clicks: 50, meta_page_views: 40, meta_connect_rate: 80, meta_lp_conversion: 25, meta_cpl_traffic: 10 },
    { ...WEEKS[1], meta_spend: 200, meta_cpm: 50, meta_ctr: 2.5, meta_leads: 20, meta_checkout: 4, meta_impressions: 4000, meta_link_clicks: 100, meta_page_views: 80, meta_connect_rate: 80, meta_lp_conversion: 25, meta_cpl_traffic: 10 },
    { ...WEEKS[2], meta_spend: 300, meta_cpm: 75, meta_ctr: 3.75, meta_leads: 30, meta_checkout: 6, meta_impressions: 4000, meta_link_clicks: 150, meta_page_views: 120, meta_connect_rate: 80, meta_lp_conversion: 25, meta_cpl_traffic: 10 },
  ],
};

const META_EMPTY_WEEK2: GlobalMetricsWithWeeks = {
  ...META,
  weeks: [
    META.weeks[0],
    { ...WEEKS[1], meta_spend: 0, meta_cpm: 0, meta_ctr: 0, meta_leads: 0, meta_checkout: 0, meta_impressions: 0, meta_link_clicks: 0, meta_page_views: 0, meta_connect_rate: null, meta_lp_conversion: null, meta_cpl_traffic: null },
    META.weeks[2],
  ],
};

const HOTMART: GlobalHotmartMetricsWithWeeks = {
  products: [],
  total_sales: 30,
  total_sales_brl: 30,
  total_sales_foreign: 0,
  total_revenue: 1200,
  weeks: [
    { ...WEEKS[0], total_sales: 5, total_sales_brl: 5, total_sales_foreign: 0, total_revenue: 200 },
    { ...WEEKS[1], total_sales: 10, total_sales_brl: 10, total_sales_foreign: 0, total_revenue: 400 },
    { ...WEEKS[2], total_sales: 15, total_sales_brl: 15, total_sales_foreign: 0, total_revenue: 600 },
  ],
};

const LEADS: GlobalLeadsMetricsWithWeeks = {
  total: 42,
  by_event: [],
  by_source: [
    { source: "youtube", count: 12 },
    { source: "meta", count: 30 },
  ],
  weeks: [
    { ...WEEKS[0], total: 10, by_source: [{ source: "meta", count: 10 }, { source: "youtube", count: 0 }] },
    { ...WEEKS[1], total: 25, by_source: [{ source: "meta", count: 20 }, { source: "youtube", count: 5 }] },
    { ...WEEKS[2], total: 7, by_source: [{ source: "meta", count: 0 }, { source: "youtube", count: 7 }] },
  ],
};

const SOURCES: ConversionSourcesWithWeeks = {
  sources: [
    { source: "email", count: 5 },
    { source: "instagram", count: 25 },
  ],
  weeks: [
    { ...WEEKS[0], sources: [{ source: "instagram", count: 4 }, { source: "email", count: 0 }] },
    { ...WEEKS[1], sources: [{ source: "instagram", count: 21 }, { source: "email", count: 3 }] },
    { ...WEEKS[2], sources: [{ source: "instagram", count: 0 }, { source: "email", count: 2 }] },
  ],
};

function section<T>(data: T): { data: T; loading: boolean; error: boolean } {
  return { data, loading: false, error: false };
}

function renderView(overrides: Partial<PlanilhaViewProps> = {}) {
  const props: PlanilhaViewProps = {
    weeks: WEEKS,
    metaState: section(META),
    hotmartState: section(HOTMART),
    leadsState: section(LEADS),
    sourcesState: section(SOURCES),
    hasMetaFilter: true,
    hasHotmartFilter: true,
    hasLeadsFilter: true,
    ...overrides,
  };
  return render(<PlanilhaView {...props} />);
}

function rowByName(name: RegExp | string): HTMLElement {
  return screen.getByRole("row", { name });
}

describe("PlanilhaView — estrutura", () => {
  it("renderiza os 4 blocos na ordem: Resumo, Meta Ads, Leads por origem, Vendas por origem (RF-1)", () => {
    renderView();

    const headers = screen.getAllByTestId("planilha-block-title").map((el) => el.textContent);
    expect(headers).toEqual(["Resumo", "Meta Ads", "Leads por origem", "Vendas por origem"]);
  });

  it("renderiza a coluna Total e uma coluna por semana com o intervalo no cabeçalho", () => {
    renderView();

    expect(screen.getByRole("columnheader", { name: "Total" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Semana 1.*06\/07.*08\/07/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Semana 2.*09\/07.*15\/07/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Semana 3.*16\/07.*22\/07/ })).toBeInTheDocument();
  });
});

describe("PlanilhaView — valores e formatação", () => {
  it("mostra os valores do Resumo formatados: ROAS por coluna, receita BRL e vendas", () => {
    renderView();

    // ROAS por coluna a partir dos brutos da coluna: 1200/600, 200/100, 400/200, 600/300
    const roas = rowByName(/ROAS/);
    expect(within(roas).getAllByText("2.00×")).toHaveLength(4);

    const receita = rowByName(/Receita BRL/);
    expect(within(receita).getByText("R$ 1.200")).toBeInTheDocument();
    expect(within(receita).getByText("R$ 600")).toBeInTheDocument();
  });

  it("mostra os 8 KPIs do Meta Ads com valores por semana", () => {
    renderView();

    const investimento = rowByName(/Investimento/);
    expect(within(investimento).getByText("R$ 600")).toBeInTheDocument();
    expect(within(investimento).getByText("R$ 100")).toBeInTheDocument();

    const ctr = rowByName(/CTR/);
    expect(within(ctr).getByText("3.00%")).toBeInTheDocument();
    expect(within(ctr).getByText("3.75%")).toBeInTheDocument();

    for (const label of ["Investimento", "Leads Gerados", "CPM", "CTR", "CPL Tráfego", "Connect Rate", "Conv. LP", "Checkout"]) {
      expect(screen.getByRole("row", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("razão não calculável numa semana sai como — (nunca Infinity, NaN ou 0 enganoso)", () => {
    renderView({ metaState: section(META_EMPTY_WEEK2) });

    const cpl = rowByName(/CPL Tráfego/);
    expect(within(cpl).getByText("—")).toBeInTheDocument();
    expect(within(cpl).queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
  });

  it("lista TODAS as origens de leads em ordem decrescente pelo Total, com linha Total de Leads", () => {
    renderView();

    const rows = screen.getAllByTestId("planilha-leads-row").map((el) => el.textContent);
    expect(rows[0]).toContain("meta");     // 30 > 12
    expect(rows[1]).toContain("youtube");

    const total = rowByName(/Total de Leads/);
    expect(within(total).getByText("42")).toBeInTheDocument();
  });

  it("origem zerada numa semana mostra 0 na célula daquela semana", () => {
    renderView();

    const youtube = screen.getAllByTestId("planilha-leads-row")[1];
    expect(within(youtube as HTMLElement).getAllByText("0").length).toBeGreaterThan(0);
  });

  it("lista as origens de venda em ordem decrescente pelo Total, com linha Total de Vendas", () => {
    renderView();

    const rows = screen.getAllByTestId("planilha-vendas-row").map((el) => el.textContent);
    expect(rows[0]).toContain("instagram"); // 25 > 5
    expect(rows[1]).toContain("email");

    // "Total de Vendas" também existe no Resumo — o do bloco 4 tem testid próprio
    const total = screen.getByTestId("planilha-vendas-total");
    expect(within(total).getByText("30")).toBeInTheDocument();
  });
});

describe("PlanilhaView — estados", () => {
  it("mostra skeleton enquanto os dados carregam", () => {
    renderView({ metaState: { data: null, loading: true, error: false } });

    expect(screen.getAllByTestId("planilha-skeleton").length).toBeGreaterThan(0);
  });

  it("mostra erro somente no bloco que falhou", () => {
    renderView({ metaState: { data: null, loading: false, error: true } });

    expect(screen.getByText(/Erro ao carregar dados do Meta Ads/)).toBeInTheDocument();
    // os demais blocos seguem renderizando valores
    expect(within(rowByName(/Receita BRL/)).getByText("R$ 1.200")).toBeInTheDocument();
  });

  it("fonte não configurada mostra o aviso e mantém o bloco com valores zerados/—", () => {
    renderView({ hasHotmartFilter: false });

    expect(screen.getAllByText(/não configurado neste filtro — dados zerados/).length).toBeGreaterThan(0);
    // a estrutura do bloco continua presente
    expect(screen.getByRole("row", { name: /Receita BRL/ })).toBeInTheDocument();
  });
});
