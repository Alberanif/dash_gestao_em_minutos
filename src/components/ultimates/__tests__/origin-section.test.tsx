/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UltimatesDashboard } from "../ultimates-dashboard";
import type { CycleWithProducts } from "../types";
import type { UltimatesRosterRow } from "@/types/ultimates";

// Ciclo "Pitch PC Ao Vivo - 2026", o único configurado em origin-source.ts.
const CYCLE_COM_ORIGEM = "fa6160b9-984b-44a5-8171-8cddd5f18775";

function makeCycle(overrides: Partial<CycleWithProducts> = {}): CycleWithProducts {
  return {
    id: "c1",
    name: "Ciclo Julho",
    account_id: "acc-1",
    products: [{ product_id: "p1", product_name: "Produto Um" }],
    goal_percent: null,
    status: "ativo",
    refresh_started_at: null,
    last_refresh_at: null,
    created_by: "user-1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    counts_new_buyers: true,
    purchases_only: true,
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
    transaction_code: "TX1",
    ...overrides,
  };
}

const ROSTER: UltimatesRosterRow[] = [
  row({ buyer_id: "b1", email: "comprou1@ex.com", category: "renovado" }),
  row({ buyer_id: "b2", email: "comprou2@ex.com", category: "renovado" }),
  row({ buyer_id: "b3", email: "estornou@ex.com", category: "renovacao_reembolsada" }),
  row({ buyer_id: "b4", email: "nada@ex.com", category: "nao_renovado" }),
];

const BLOCKS = [
  {
    key: "modalidade",
    title: "Por modalidade",
    rows: [{ origin: "Presencial", purchases: 2, base: 10, conversion: 20 }],
  },
];

// Captura os corpos enviados ao endpoint de origem.
let originBodies: Array<{ emails: string[] }>;

function mockFetch(originResponse: { ok: boolean; body?: unknown } = { ok: true, body: { blocks: BLOCKS } }) {
  originBodies = [];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (url.includes("/origin-breakdown")) {
      originBodies.push(JSON.parse(String(init?.body)));
      return Promise.resolve({
        ok: originResponse.ok,
        json: async () => originResponse.body ?? {},
      });
    }
    if (url.includes("/roster")) {
      return Promise.resolve({ ok: true, json: async () => ({ rows: ROSTER }) });
    }
    if (url.includes("/hourly")) {
      return Promise.resolve({ ok: true, json: async () => ({ hours: [] }) });
    }
    if (url.includes("/daily")) {
      return Promise.resolve({ ok: true, json: async () => ({ days: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ offers: [], buyers: [] }) });
  }) as unknown as typeof global.fetch;
}

const noop = async () => true;

function renderDashboard(cycle: CycleWithProducts) {
  return render(
    <UltimatesDashboard
      cycle={cycle}
      role="gestor"
      onCountsNewBuyersChange={noop}
      onViewRangeChange={noop}
    />
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("seção Por origem", () => {
  it("não existe em ciclo sem base de origem configurada", async () => {
    mockFetch();
    renderDashboard(makeCycle());

    await screen.findByTestId("ultimates-selected-cycle");
    await waitFor(() => expect(screen.getByText("Roster")).toBeInTheDocument());

    expect(screen.queryByTestId("ultimates-origin-section")).not.toBeInTheDocument();
    expect(
      (global.fetch as jest.Mock).mock.calls.some(([url]) => String(url).includes("/origin-breakdown"))
    ).toBe(false);
  });

  it("aparece no ciclo configurado e exibe o cruzamento", async () => {
    mockFetch();
    renderDashboard(makeCycle({ id: CYCLE_COM_ORIGEM, name: "Pitch PC Ao Vivo - 2026" }));

    expect(await screen.findByTestId("ultimates-origin-section")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("ultimates-origin-block-modalidade")).toBeInTheDocument()
    );
    expect(screen.getByText("Presencial")).toBeInTheDocument();
    expect(screen.getByText("20,0%")).toBeInTheDocument();
  });

  it("manda só os emails contados como compra", async () => {
    mockFetch();
    renderDashboard(makeCycle({ id: CYCLE_COM_ORIGEM }));

    await waitFor(() => expect(originBodies.length).toBeGreaterThan(0));

    // Reembolsada e não renovada ficam de fora — é o que faz a soma da coluna
    // "Compras" fechar com o tile "Compras" do topo.
    expect(originBodies[originBodies.length - 1].emails).toEqual([
      "comprou1@ex.com",
      "comprou2@ex.com",
    ]);
  });

  it("avisa dentro da seção quando o cruzamento falha, sem derrubar o resto", async () => {
    mockFetch({ ok: false });
    renderDashboard(makeCycle({ id: CYCLE_COM_ORIGEM }));

    expect(await screen.findByTestId("ultimates-origin-error")).toBeInTheDocument();
    // O dashboard continua de pé.
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-dashboard-error")).not.toBeInTheDocument();
  });

  // A ordem das seções É informação: origem antes do Roster porque a leitura
  // vai do agregado para o nominal, e o Roster é a seção mais longa da página.
  // Sem esta guarda, qualquer refactor do JSX de ~120 linhas do dashboard
  // desfaz a ordem sem ninguém notar.
  it("renderiza Por origem antes do Roster", async () => {
    mockFetch();
    renderDashboard(makeCycle({ id: CYCLE_COM_ORIGEM, name: "Pitch PC Ao Vivo - 2026" }));

    await screen.findByTestId("ultimates-origin-section");

    const titulos = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual(["Visão do ciclo", "Evolução", "Por origem", "Roster"]);
  });

  // O índice do Roster é derivado, não literal: com "04" fixo, todo ciclo SEM
  // cruzamento de origem — que é a maioria — exibiria 01 → 02 → 04.
  it("numera as seções sem buraco nos dois casos", async () => {
    const indiceDe = (titulo: string) =>
      screen.getByText(titulo).previousElementSibling?.textContent;

    mockFetch();
    const comOrigem = renderDashboard(
      makeCycle({ id: CYCLE_COM_ORIGEM, name: "Pitch PC Ao Vivo - 2026" })
    );
    await screen.findByTestId("ultimates-origin-section");
    expect(indiceDe("Por origem")).toBe("03");
    expect(indiceDe("Roster")).toBe("04");
    comOrigem.unmount();

    mockFetch();
    renderDashboard(makeCycle());
    await screen.findByTestId("ultimates-selected-cycle");
    await waitFor(() => expect(screen.getByText("Roster")).toBeInTheDocument());
    expect(screen.queryByTestId("ultimates-origin-section")).not.toBeInTheDocument();
    expect(indiceDe("Roster")).toBe("03");
  });

  it("não cruza o ciclo inteiro antes da janela chegar", async () => {
    // Com período salvo, o roster recortado chega DEPOIS do roster do ciclo.
    // Cruzar no meio do caminho mostraria o número do ciclo inteiro piscando.
    let liberarRecorte: (() => void) | null = null;
    const recorteChegou = new Promise<void>((resolve) => {
      liberarRecorte = resolve;
    });

    originBodies = [];
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/origin-breakdown")) {
        originBodies.push(JSON.parse(String(init?.body)));
        return Promise.resolve({ ok: true, json: async () => ({ blocks: BLOCKS }) });
      }
      if (href.includes("/roster?start=")) {
        return recorteChegou.then(() => ({
          ok: true,
          json: async () => ({ rows: [ROSTER[0]] }),
        }));
      }
      if (href.includes("/roster")) {
        return Promise.resolve({ ok: true, json: async () => ({ rows: ROSTER }) });
      }
      if (href.includes("/hourly")) return Promise.resolve({ ok: true, json: async () => ({ hours: [] }) });
      if (href.includes("/daily")) return Promise.resolve({ ok: true, json: async () => ({ days: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({ offers: [], buyers: [] }) });
    }) as unknown as typeof global.fetch;

    renderDashboard(
      makeCycle({
        id: CYCLE_COM_ORIGEM,
        view_start_date: "2026-08-01",
        view_end_date: "2026-08-02",
      })
    );

    await screen.findByTestId("ultimates-origin-section");
    expect(originBodies).toHaveLength(0);

    liberarRecorte!();

    await waitFor(() => expect(originBodies.length).toBeGreaterThan(0));
    // Só o recorte foi cruzado, nunca o ciclo inteiro.
    for (const body of originBodies) {
      expect(body.emails).toEqual(["comprou1@ex.com"]);
    }
  });
});
