/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UltimatesDashboard } from "../ultimates-dashboard";
import type { CycleWithProduct } from "../types";
import type { UltimatesRosterRow, UltimatesDailyRow } from "@/types/ultimates";

function makeCycle(overrides: Partial<CycleWithProduct> = {}): CycleWithProduct {
  return {
    id: "c1",
    name: "Ciclo Julho",
    account_id: "acc-1",
    product_id: "p1",
    product_name: "Produto Um",
    goal_percent: 60,
    status: "ativo",
    refresh_started_at: null,
    last_refresh_at: null,
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: "b1",
    name: "Fulano",
    email: "fulano@example.com",
    phone: null,
    extra: {},
    category: "renovado",
    renewed_at: null,
    total_value: null,
    transaction_code: null,
    ...overrides,
  };
}

const ROSTER: UltimatesRosterRow[] = [
  row({ buyer_id: "b1", name: "Renovou 1", email: "r1@example.com", category: "renovado" }),
  row({ buyer_id: "b2", name: "Renovou 2", email: "r2@example.com", category: "renovado" }),
  row({ buyer_id: "b3", name: "Não Renovou", email: "n1@example.com", category: "nao_renovado" }),
];

const DAILY: UltimatesDailyRow[] = [
  { day: "2026-07-01", renewals: 1 },
  { day: "2026-07-02", renewals: 1 },
];

function mockRosterAndDailyFetch() {
  global.fetch = jest.fn((url: string) => {
    if (url.includes("/roster")) {
      return Promise.resolve({ ok: true, json: async () => ({ rows: ROSTER }) });
    }
    if (url.includes("/daily")) {
      return Promise.resolve({ ok: true, json: async () => ({ days: DAILY }) });
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  }) as unknown as typeof global.fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("UltimatesDashboard — wiring de KPIs/meta/gráfico/tabela sobre a mesma fonte (critério 9)", () => {
  it("busca roster + daily do ciclo selecionado e renderiza KPIs consistentes com o roster", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" />);

    expect(await screen.findByTestId("ultimates-kpi-row")).toBeInTheDocument();
    // base = 3 (todas com buyer_id != null); renovados = 2.
    expect(screen.getByTestId("ultimates-kpi-base")).toHaveTextContent("3");
    expect(screen.getByTestId("ultimates-kpi-renovados")).toHaveTextContent("2");

    // A tabela vem da mesma chamada — a mesma pessoa aparece nas duas.
    expect(screen.getByText("Renovou 1")).toBeInTheDocument();
    expect(screen.getByText("Não Renovou")).toBeInTheDocument();
  });

  it("exibe a barra de meta quando goal_percent está cadastrada", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle({ goal_percent: 60 })} role="gestor" />);
    expect(await screen.findByTestId("ultimates-goal-bar")).toBeInTheDocument();
  });

  it("NÃO exibe a barra de meta quando goal_percent é null", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle({ goal_percent: null })} role="gestor" />);
    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.queryByTestId("ultimates-goal-bar")).not.toBeInTheDocument();
  });

  it("renderiza o gráfico de renovações acumuladas a partir do daily", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" />);
    expect(await screen.findByTestId("ultimates-cumulative-chart")).toBeInTheDocument();
  });

  it("mantém o testid de slot e o nome do ciclo selecionado (contrato da task #122)", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle({ name: "Ciclo XPTO" })} role="gestor" />);
    expect(screen.getByTestId("ultimates-dashboard-slot")).toBeInTheDocument();
    expect(await screen.findByTestId("ultimates-selected-cycle")).toHaveTextContent("Ciclo XPTO");
  });

  it("mostra erro com opção de tentar novamente quando roster ou daily falham", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof global.fetch;
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" />);
    expect(await screen.findByTestId("ultimates-dashboard-error")).toBeInTheDocument();
  });
});
