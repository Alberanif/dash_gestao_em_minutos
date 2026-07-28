/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
  { day: "2026-07-01", renewals: 1, new_buyers: 2 },
  { day: "2026-07-02", renewals: 1, new_buyers: 0 },
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
    const chart = await screen.findByTestId("ultimates-cumulative-chart");
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute("data-series", "renovacoes");
  });

  it("o switch do card 02 troca a visualização para novos compradores, sem refetch", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" />);

    await screen.findByTestId("ultimates-cumulative-chart");
    const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;

    fireEvent.click(screen.getByTestId("ultimates-cumulative-series-novos"));

    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-series", "novos");
    expect(screen.getByText("Novos compradores acumulados")).toBeInTheDocument();
    // As duas séries vêm da MESMA carga do daily (critério 9) — alternar não
    // dispara chamada nova.
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBefore);
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

const WRITE_ROSTER: UltimatesRosterRow[] = [
  row({ buyer_id: "b1", name: "Renovou", email: "r1@example.com", category: "renovado", transaction_code: "HP-TX-1" }),
  row({ buyer_id: null, name: "Compra Nova", email: "novo@example.com", category: "novo_comprador", transaction_code: "HP-TX-2" }),
];

function mockWriteRosterFetch() {
  global.fetch = jest.fn((url: string) => {
    if (url.includes("/roster")) return Promise.resolve({ ok: true, json: async () => ({ rows: WRITE_ROSTER }) });
    if (url.includes("/daily")) return Promise.resolve({ ok: true, json: async () => ({ days: [] }) });
    return Promise.resolve({ ok: false, json: async () => ({}) });
  }) as unknown as typeof global.fetch;
}

describe("UltimatesDashboard — fluxos de escrita (critérios 6 e 11)", () => {
  it("gestor em ciclo ativo vê 'Carregar base' e pode abrir vínculo/desfazer", async () => {
    mockWriteRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="gestor" />);

    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.getByTestId("ultimates-upload-btn")).toBeInTheDocument();

    // Vínculo manual: botão na linha de novo comprador abre o modal.
    const linkBtn = screen.getByTestId("ultimates-link-buyer-novo@example.com");
    expect(linkBtn).not.toBeDisabled();
    fireEvent.click(linkBtn);
    expect(screen.getByTestId("ultimates-link-search")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    // Desfazer vínculo: botão na renovação da base abre o modal.
    fireEvent.click(screen.getByTestId("ultimates-unlink-buyer-r1@example.com"));
    expect(screen.getByTestId("ultimates-unlink-confirm-btn")).toBeInTheDocument();
  });

  it("ciclo encerrado: dashboard acessível mas escrita bloqueada (sem Carregar base nem ações)", async () => {
    mockWriteRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "encerrado" })} role="gestor" />);

    await screen.findByTestId("ultimates-kpi-row");
    // Dashboard segue acessível (tabela renderiza).
    expect(screen.getByText("Compra Nova")).toBeInTheDocument();
    // Mas nenhuma ação de escrita é oferecida.
    expect(screen.queryByTestId("ultimates-upload-btn")).not.toBeInTheDocument();
    const linkBtn = screen.getByTestId("ultimates-link-buyer-novo@example.com");
    expect(linkBtn).toBeDisabled();
    expect(screen.queryByTestId("ultimates-unlink-buyer-r1@example.com")).not.toBeInTheDocument();
  });

  it("analista não vê ações de escrita mesmo em ciclo ativo", async () => {
    mockWriteRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="analista" />);
    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.queryByTestId("ultimates-upload-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-link-buyer-novo@example.com")).not.toBeInTheDocument();
  });
});
