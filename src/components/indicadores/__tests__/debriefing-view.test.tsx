/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// Recharts não renderiza em jsdom sem dimensões; o gráfico não é o objeto deste teste.
jest.mock("recharts", () => {
  const Null = () => null;
  return {
    ComposedChart: Null,
    Bar: Null,
    Line: Null,
    XAxis: Null,
    YAxis: Null,
    Tooltip: Null,
    CartesianGrid: Null,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

import { DebriefingView } from "../debriefing-view";
import type { FilterRecord } from "@/types/indicadores";

const BASE: FilterRecord = {
  id: "f-1",
  account_id: "acc-1",
  name: "Filtro",
  hotmart_products: [],
  meta_ads_terms: [],
  captacao_leads_eventos: [],
  status: "ativo",
  status_changed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const METRICS = {
  totals: { total_sales: 5, total_sales_brl: 5, total_sales_foreign: 0, total_revenue_brl: 1500 },
  daily_series: [{ date: "2026-01-01", sales_count: 5, sales_brl: 5, sales_foreign: 0, revenue: 1500 }],
  products: [
    {
      product_id: "111",
      product_name: "Produto A",
      total_sales: 2,
      total_sales_brl: 2,
      total_sales_foreign: 0,
      total_revenue_brl: 500,
      offers_breakdown: [{ offer_code: "oa1", offer_name: "Oferta A1", sales_count: 2, revenue: 500 }],
    },
    {
      product_id: "222",
      product_name: "Produto B",
      total_sales: 3,
      total_sales_brl: 3,
      total_sales_foreign: 0,
      total_revenue_brl: 1000,
      offers_breakdown: [
        { offer_code: "ob1", offer_name: "Oferta B1", sales_count: 1, revenue: 400 },
        { offer_code: "ob2", offer_name: "Oferta B2", sales_count: 2, revenue: 600 },
      ],
    },
  ],
};

let fetchMock: jest.Mock;

function installFetch(body: unknown) {
  fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => body }));
  global.fetch = fetchMock as unknown as typeof fetch;
}

function renderView(filter: FilterRecord | null) {
  return render(<DebriefingView filter={filter} startDate="2026-01-01" endDate="2026-01-31" />);
}

describe("DebriefingView", () => {
  it("2 produtos: manda ambos na rota, soma KPIs e agrupa a tabela com subtotais", async () => {
    installFetch(METRICS);
    renderView({
      ...BASE,
      debriefing_products: [
        { product_id: "111", product_name: "Produto A", offer_codes: [] },
        { product_id: "222", product_name: "Produto B", offer_codes: ["ob1"] },
      ],
    });

    await waitFor(() => expect(screen.getByText("Total de Vendas")).toBeInTheDocument());

    const url = String(fetchMock.mock.calls[0][0]);
    const sent = JSON.parse(new URL(url, "http://x").searchParams.get("products") ?? "[]");
    expect(sent.map((p: { product_id: string }) => p.product_id)).toEqual(["111", "222"]);
    expect(sent[1].offer_codes).toEqual(["ob1"]);

    // Cabeçalho multi-produto: nomes e contagem
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Produto A, Produto B");
    expect(screen.getByText("2 produtos")).toBeInTheDocument();

    // KPI consolidado
    expect(screen.getByText("5")).toBeInTheDocument();

    // Dois grupos com subtotal correto
    const subA = screen.getByTestId("debriefing-subtotal-111");
    const subB = screen.getByTestId("debriefing-subtotal-222");
    expect(within(subA).getByText("2")).toBeInTheDocument();
    expect(subA).toHaveTextContent(/R\$\s*500,00/);
    expect(within(subB).getByText("3")).toBeInTheDocument();
    expect(subB).toHaveTextContent(/R\$\s*1\.000,00/);

    // Ofertas dentro do grupo do seu produto
    const groupB = screen.getByTestId("debriefing-group-222");
    expect(within(groupB).getByText("Oferta B1")).toBeInTheDocument();
    expect(within(groupB).getByText("Oferta B2")).toBeInTheDocument();
    expect(within(groupB).queryByText("Oferta A1")).not.toBeInTheDocument();
  });

  it("filtro legado (main_hotmart_product) vira 1 produto: cabeçalho com nome e id", async () => {
    installFetch({ ...METRICS, products: [METRICS.products[0]] });
    renderView({
      ...BASE,
      main_hotmart_product: { product_id: "111", product_name: "Produto A" },
      debriefing_offer_codes: ["oa1"],
    });

    await waitFor(() => expect(screen.getByText("Total de Vendas")).toBeInTheDocument());

    const url = String(fetchMock.mock.calls[0][0]);
    const sent = JSON.parse(new URL(url, "http://x").searchParams.get("products") ?? "[]");
    expect(sent).toEqual([{ product_id: "111", product_name: "Produto A", offer_codes: ["oa1"] }]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Produto A");
    expect(screen.getByText("ID Hotmart: #111")).toBeInTheDocument();
  });

  it("aba somente leitura: sem filtro de ofertas e nenhum PUT disparado", async () => {
    installFetch(METRICS);
    renderView({
      ...BASE,
      debriefing_products: [{ product_id: "111", product_name: "Produto A", offer_codes: [] }],
    });

    await waitFor(() => expect(screen.getByText("Total de Vendas")).toBeInTheDocument());

    expect(screen.queryByText("Filtro de Ofertas")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/oferta/i)).not.toBeInTheDocument();
    const methods = fetchMock.mock.calls.map((c) => (c[1] as RequestInit | undefined)?.method ?? "GET");
    expect(methods).not.toContain("PUT");
  });

  it("sem produtos: mostra estado vazio com botão de configurar e não chama a rota", () => {
    installFetch(METRICS);
    const onEdit = jest.fn();
    render(<DebriefingView filter={{ ...BASE, debriefing_products: [] }} startDate="a" endDate="b" onEditFilter={onEdit} />);

    expect(screen.getByTestId("debriefing-empty-state")).toBeInTheDocument();
    expect(screen.getByText("Nenhum Produto Principal Configurado")).toBeInTheDocument();
    screen.getByRole("button", { name: "Configurar Produto Principal" }).click();
    expect(onEdit).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
