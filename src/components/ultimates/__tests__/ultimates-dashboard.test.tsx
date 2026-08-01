/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UltimatesDashboard } from "../ultimates-dashboard";
import type { CycleWithProducts } from "../types";
import type { UltimatesRosterRow, UltimatesDailyRow, UltimatesHourlyRow } from "@/types/ultimates";

function makeCycle(overrides: Partial<CycleWithProducts> = {}): CycleWithProducts {
  return {
    id: "c1",
    name: "Ciclo Julho",
    account_id: "acc-1",
    products: [{ product_id: "p1", product_name: "Produto Um" }],
    goal_percent: 60,
    status: "ativo",
    refresh_started_at: null,
    last_refresh_at: null,
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    counts_new_buyers: true,
    purchases_only: false,
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

const HOURLY: UltimatesHourlyRow[] = [
  { hour: "2026-07-01T20", renewals: 1, new_buyers: 2 },
  { hour: "2026-07-02T09", renewals: 1, new_buyers: 0 },
];

function mockRosterAndDailyFetch() {
  global.fetch = jest.fn((url: string) => {
    if (url.includes("/roster")) {
      return Promise.resolve({ ok: true, json: async () => ({ rows: ROSTER }) });
    }
    if (url.includes("/hourly")) {
      return Promise.resolve({ ok: true, json: async () => ({ hours: HOURLY }) });
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
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

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
    render(<UltimatesDashboard cycle={makeCycle({ goal_percent: 60 })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);
    expect(await screen.findByTestId("ultimates-goal-bar")).toBeInTheDocument();
  });

  it("NÃO exibe a barra de meta quando goal_percent é null", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle({ goal_percent: null })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);
    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.queryByTestId("ultimates-goal-bar")).not.toBeInTheDocument();
  });

  it("renderiza o gráfico de renovações acumuladas a partir do daily", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);
    const chart = await screen.findByTestId("ultimates-cumulative-chart");
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute("data-series", "renovacoes");
  });

  it("o switch do card 02 troca a visualização para novos compradores, sem refetch", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

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
    render(<UltimatesDashboard cycle={makeCycle({ name: "Ciclo XPTO" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);
    expect(screen.getByTestId("ultimates-dashboard-slot")).toBeInTheDocument();
    expect(await screen.findByTestId("ultimates-selected-cycle")).toHaveTextContent("Ciclo XPTO");
  });

  it("mostra os produtos do ciclo no header", () => {
    mockRosterAndDailyFetch();
    render(
      <UltimatesDashboard
        cycle={makeCycle({
          products: [
            { product_id: "p1", product_name: "Anual" },
            { product_id: "p2", product_name: "Mensal" },
          ],
        })}
        role="gestor"
        onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );
    expect(screen.getByTestId("ultimates-cycle-products")).toHaveTextContent("Anual · Mensal");
  });

  it("mostra erro com opção de tentar novamente quando roster ou daily falham", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof global.fetch;
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);
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
    if (url.includes("/hourly")) return Promise.resolve({ ok: true, json: async () => ({ hours: [] }) });
    if (url.includes("/daily")) return Promise.resolve({ ok: true, json: async () => ({ days: [] }) });
    return Promise.resolve({ ok: false, json: async () => ({}) });
  }) as unknown as typeof global.fetch;
}

describe("UltimatesDashboard — fluxos de escrita (critérios 6 e 11)", () => {
  it("gestor em ciclo ativo vê 'Carregar base' e pode abrir vínculo/desfazer", async () => {
    mockWriteRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

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
    render(<UltimatesDashboard cycle={makeCycle({ status: "encerrado" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

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
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="analista" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);
    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.queryByTestId("ultimates-upload-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-link-buyer-novo@example.com")).not.toBeInTheDocument();
  });
});

// ── Ofertas excluídas (PRD 2026-07-30) ──────────────────────────────────────

function mockFetchWithExcluded(excludedCount: number) {
  const offers = Array.from({ length: excludedCount }, (_, i) => ({
    id: `eo-${i}`,
    offer_code: `OFERTA_${i}`,
    offer_name: `Oferta ${i}`,
    note: null,
    excluded_by: "user-1",
    excluded_by_email: "gestor@ex.com",
    created_at: "2026-07-30T12:00:00Z",
  }));

  global.fetch = jest.fn((url: string) => {
    if (url.includes("/roster")) {
      return Promise.resolve({ ok: true, json: async () => ({ rows: ROSTER }) });
    }
    if (url.includes("/hourly")) {
      return Promise.resolve({ ok: true, json: async () => ({ hours: HOURLY }) });
    }
    if (url.includes("/daily")) {
      return Promise.resolve({ ok: true, json: async () => ({ days: DAILY }) });
    }
    if (url.includes("/excluded-offers")) {
      return Promise.resolve({ ok: true, json: async () => ({ offers }) });
    }
    if (url.includes("/offer-options")) {
      return Promise.resolve({ ok: true, json: async () => ({ offers: [] }) });
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  }) as unknown as typeof global.fetch;
}

describe("UltimatesDashboard — sinalização de ofertas excluídas", () => {
  it("mostra o contador no botão e a nota no card quando há ofertas excluídas", async () => {
    mockFetchWithExcluded(2);
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    // O botão aparece antes da contagem chegar (não some enquanto carrega);
    // o contador entra no rótulo assim que a lista responde.
    expect(await screen.findByText("Ofertas excluídas (2)")).toBeInTheDocument();

    const note = await screen.findByTestId("ultimates-excluded-offers-note");
    expect(note).toHaveTextContent("2 ofertas excluídas da contabilidade");
  });

  it("usa o singular com uma única oferta excluída", async () => {
    mockFetchWithExcluded(1);
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    expect(await screen.findByTestId("ultimates-excluded-offers-note")).toHaveTextContent(
      "1 oferta excluída da contabilidade"
    );
  });

  it("sem ofertas excluídas, não mostra contador nem nota", async () => {
    mockFetchWithExcluded(0);
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.getByTestId("ultimates-excluded-offers-btn")).toHaveTextContent(
      "Ofertas excluídas"
    );
    expect(screen.getByTestId("ultimates-excluded-offers-btn")).not.toHaveTextContent("(");
    expect(screen.queryByTestId("ultimates-excluded-offers-note")).not.toBeInTheDocument();
  });

  it("abre o modal ao clicar no botão", async () => {
    mockFetchWithExcluded(1);
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    fireEvent.click(await screen.findByTestId("ultimates-excluded-offers-btn"));

    expect(await screen.findByTestId("ultimates-excluded-offers-modal")).toBeInTheDocument();
  });

  it("mantém o botão disponível em ciclo encerrado (a lista continua editável)", async () => {
    mockFetchWithExcluded(0);
    render(<UltimatesDashboard cycle={makeCycle({ status: "encerrado" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");
    // "Carregar base" some em ciclo encerrado; esta lista não.
    expect(screen.queryByTestId("ultimates-upload-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("ultimates-excluded-offers-btn")).toBeInTheDocument();
  });

  it("mostra o botão para analista (leitura da lista)", async () => {
    mockFetchWithExcluded(1);
    render(<UltimatesDashboard cycle={makeCycle()} role="analista" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    expect(await screen.findByTestId("ultimates-excluded-offers-btn")).toBeInTheDocument();
  });
});

describe("UltimatesDashboard — modo sem novas compras", () => {
  const MIXED_ROSTER: UltimatesRosterRow[] = [
    row({ buyer_id: "b1", name: "Renovou", email: "r1@example.com", category: "renovado" }),
    row({ buyer_id: null, name: null, email: "fora@example.com", category: "novo_comprador" }),
  ];
  const MIXED_DAILY: UltimatesDailyRow[] = [{ day: "2026-07-01", renewals: 1, new_buyers: 1 }];

  function mockMixedFetch() {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/roster")) {
        return Promise.resolve({ ok: true, json: async () => ({ rows: MIXED_ROSTER }) });
      }
      if (url.includes("/hourly")) {
        return Promise.resolve({ ok: true, json: async () => ({ hours: [] }) });
      }
      if (url.includes("/daily")) {
        return Promise.resolve({ ok: true, json: async () => ({ days: MIXED_DAILY }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    }) as unknown as typeof global.fetch;
  }

  const onToggle = jest.fn().mockResolvedValue(true);

  it("mostra a nota de modo e troca o 5º tile por renovações sem vínculo", async () => {
    mockMixedFetch();
    render(
      <UltimatesDashboard
        cycle={makeCycle({ counts_new_buyers: false })}
        role="gestor"
        onCountsNewBuyersChange={onToggle}
        onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );

    expect(await screen.findByTestId("ultimates-new-purchases-note")).toHaveTextContent(
      "Compras de emails fora da base contam como renovação"
    );
    expect(screen.getByTestId("ultimates-kpi-renovacoes-sem-vinculo")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-kpi-novos-compradores")).toBeNull();
  });

  it("soma a venda sem vínculo no tile Renovados", async () => {
    mockMixedFetch();
    render(
      <UltimatesDashboard
        cycle={makeCycle({ counts_new_buyers: false })}
        role="gestor"
        onCountsNewBuyersChange={onToggle}
        onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );

    // base = 1 (só b1); renovados = 1 identificado + 1 sem vínculo = 2.
    // O tile mostra só o total — a decomposição fica no 5º tile.
    const tile = await screen.findByTestId("ultimates-kpi-renovados");
    expect(tile).toHaveTextContent("2");
    expect(tile).not.toHaveTextContent("sem vínculo");
  });

  it("esconde o switch de séries do gráfico", async () => {
    mockMixedFetch();
    render(
      <UltimatesDashboard
        cycle={makeCycle({ counts_new_buyers: false })}
        role="gestor"
        onCountsNewBuyersChange={onToggle}
        onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );

    await screen.findByTestId("ultimates-cumulative-chart");
    expect(screen.queryByTestId("ultimates-cumulative-series-switch")).toBeNull();
  });

  it("não mostra a nota nem troca o tile quando o ciclo admite novas compras", async () => {
    mockMixedFetch();
    render(
      <UltimatesDashboard
        cycle={makeCycle({ counts_new_buyers: true })}
        role="gestor"
        onCountsNewBuyersChange={onToggle}
        onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );

    expect(await screen.findByTestId("ultimates-kpi-novos-compradores")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-new-purchases-note")).toBeNull();
  });

  it("trava o switch em ciclo encerrado", async () => {
    mockMixedFetch();
    render(
      <UltimatesDashboard
        cycle={makeCycle({ status: "encerrado" })}
        role="gestor"
        onCountsNewBuyersChange={onToggle}
        onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );

    expect(await screen.findByTestId("ultimates-new-purchases-toggle")).toBeDisabled();
  });
});

// ── Regressão: paginação do roster não pode resetar sozinha (achado de review
// do commit 8c52c36) ────────────────────────────────────────────────────────

describe("UltimatesDashboard — paginação do roster no modo desligado", () => {
  // 25 linhas ⇒ 3 páginas de 10 (PAGE_SIZE do RosterTable). Todas com
  // category "renovado" e buyer_id preenchido: o mapeador de modo desligado
  // não precisa reclassificar nada aqui, só devolver um array NOVO a cada
  // chamada — é essa nova referência (não o conteúdo) que quebra a
  // memoização de `filtered` em roster-table.tsx quando não há useMemo em
  // volta de applyNewPurchasesModeToRoster.
  const MANY_ROSTER: UltimatesRosterRow[] = Array.from({ length: 25 }, (_, i) =>
    row({
      buyer_id: `pb${i + 1}`,
      name: `Participante ${String(i + 1).padStart(2, "0")}`,
      email: `p${String(i + 1).padStart(2, "0")}@example.com`,
      category: "renovado",
    })
  );

  function mockManyRosterFetch() {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/roster")) {
        return Promise.resolve({ ok: true, json: async () => ({ rows: MANY_ROSTER }) });
      }
      if (url.includes("/hourly")) {
        return Promise.resolve({ ok: true, json: async () => ({ hours: [] }) });
      }
      if (url.includes("/daily")) {
        return Promise.resolve({ ok: true, json: async () => ({ days: [] }) });
      }
      if (url.includes("/excluded-offers")) {
        return Promise.resolve({ ok: true, json: async () => ({ offers: [] }) });
      }
      if (url.includes("/offer-options")) {
        return Promise.resolve({ ok: true, json: async () => ({ offers: [] }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    }) as unknown as typeof global.fetch;
  }

  it("mantém a página 2 da tabela quando o dashboard re-renderiza (abrir um modal) com counts_new_buyers = false", async () => {
    mockManyRosterFetch();
    render(
      <UltimatesDashboard
        cycle={makeCycle({ counts_new_buyers: false })}
        role="gestor"
        onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );

    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 1 de 3");

    fireEvent.click(screen.getByTestId("data-table-next"));
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 2 de 3");

    // Provoca um re-render do dashboard sem tocar em roster/daily — abrir o
    // modal de ofertas excluídas passa por setExcludedOpen, que não altera
    // `roster` nem `countsNewBuyers`. Sem o useMemo do achado 1, isso ainda
    // assim gera um array novo em viewRoster e reseta a paginação.
    fireEvent.click(screen.getByTestId("ultimates-excluded-offers-btn"));
    await screen.findByTestId("ultimates-excluded-offers-modal");

    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 2 de 3");
  });
});

describe("UltimatesDashboard — granularidade do card Evolução", () => {
  it("busca a série horária junto com roster e daily", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-cumulative-chart");

    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("/api/ultimates/cycles/c1/hourly"))).toBe(true);
  });

  it("abre em dia e alterna o card para hora", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    const card = await screen.findByTestId("ultimates-cumulative-chart");
    expect(card).toHaveAttribute("data-granularity", "dia");

    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-hora"));

    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-granularity", "hora");
    expect(screen.getByText("Renovações acumuladas — por hora")).toBeInTheDocument();
  });

  it("a descrição da seção 02 segue a granularidade", async () => {
    mockRosterAndDailyFetch();
    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-cumulative-chart");
    expect(screen.getByText("Renovações e novos compradores, dia a dia")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-hora"));

    expect(screen.getByText("Renovações e novos compradores, hora a hora")).toBeInTheDocument();
  });

  // A descrição é o produto de duas dimensões (política do ciclo ×
  // granularidade) e só metade da matriz tinha teste. Este fecha a outra
  // metade: com o ciclo sem novas compras, a primeira parte não pode variar
  // com o chip e a segunda tem que continuar variando.
  it("a descrição da seção 02 combina as duas granularidades com o modo sem novas compras", async () => {
    mockRosterAndDailyFetch();
    render(
      <UltimatesDashboard
        cycle={makeCycle({ counts_new_buyers: false })}
        role="gestor"
        onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );

    await screen.findByTestId("ultimates-cumulative-chart");
    expect(screen.getByText("Renovações acumuladas, dia a dia")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-hora"));
    expect(screen.getByText("Renovações acumuladas, hora a hora")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-dia"));
    expect(screen.getByText("Renovações acumuladas, dia a dia")).toBeInTheDocument();
  });

  // Mesma garantia que o `series` já tem: o dashboard é renderizado sem
  // `key`, então a preferência de quem olha atravessa a troca de ciclo.
  it("a granularidade escolhida sobrevive à troca de ciclo", async () => {
    mockRosterAndDailyFetch();
    const { rerender } = render(
      <UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    await screen.findByTestId("ultimates-cumulative-chart");
    fireEvent.click(screen.getByTestId("ultimates-cumulative-granularity-hora"));
    expect(screen.getByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-granularity", "hora");

    rerender(
      <UltimatesDashboard
        cycle={makeCycle({ id: "c2", name: "Ciclo Agosto" })}
        role="gestor"
        onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );

    expect(await screen.findByTestId("ultimates-cumulative-chart")).toHaveAttribute("data-granularity", "hora");
  });

  // A horária é a mais nova e a menos validada das três chamadas — a migration
  // 054 pode nem ter subido ainda quando o deploy sair. Falhar nela não pode
  // levar junto KPIs, meta, roster, CSV e a curva DIÁRIA, que funcionam hoje:
  // o dashboard segue inteiro e só o chip "Hora" some, para ninguém clicar em
  // um botão que leva a um gráfico vazio.
  it("com a busca horária falhando, o dashboard renderiza e o chip Hora não é oferecido", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/hourly")) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      if (url.includes("/roster")) {
        return Promise.resolve({ ok: true, json: async () => ({ rows: ROSTER }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ days: DAILY }) });
    }) as unknown as typeof global.fetch;

    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    const card = await screen.findByTestId("ultimates-cumulative-chart");
    expect(screen.queryByTestId("ultimates-dashboard-error")).toBeNull();
    expect(screen.getByTestId("ultimates-kpi-row")).toBeInTheDocument();
    expect(screen.getByText("Renovou 1")).toBeInTheDocument();
    // A curva diária continua de pé, na granularidade padrão.
    expect(card).toHaveAttribute("data-granularity", "dia");
    expect(screen.queryByTestId("ultimates-cumulative-granularity-switch")).toBeNull();
    expect(screen.queryByTestId("ultimates-cumulative-granularity-hora")).toBeNull();
  });

  // Mesma garantia quando a rota nem responde (rede caiu, 404 de rota
  // inexistente antes do deploy): a rejeição do fetch horário não pode rejeitar
  // o Promise.all e derrubar as outras duas cargas com ela.
  it("com a busca horária rejeitando, o dashboard continua inteiro", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/hourly")) {
        return Promise.reject(new Error("network"));
      }
      if (url.includes("/roster")) {
        return Promise.resolve({ ok: true, json: async () => ({ rows: ROSTER }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ days: DAILY }) });
    }) as unknown as typeof global.fetch;

    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    expect(await screen.findByTestId("ultimates-cumulative-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-dashboard-error")).toBeNull();
    expect(screen.queryByTestId("ultimates-cumulative-granularity-switch")).toBeNull();
  });

  // Roster e daily continuam governando o erro exatamente como antes da
  // granularidade horária existir.
  it("continua acendendo o erro do card quando a daily falha", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/daily")) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      if (url.includes("/hourly")) {
        return Promise.resolve({ ok: true, json: async () => ({ hours: HOURLY }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ rows: ROSTER }) });
    }) as unknown as typeof global.fetch;

    render(<UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    expect(await screen.findByText("Tentar novamente")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-cumulative-chart")).toBeNull();
  });
});

const EDIT_ROSTER: UltimatesRosterRow[] = [
  row({ buyer_id: "b1", name: "Renovou", email: "r1@example.com", category: "renovado", transaction_code: "HP-TX-1", from_manual_link: true }),
  row({ buyer_id: "b2", name: "Não Renovou", email: "n1@example.com", category: "nao_renovado" }),
  row({ buyer_id: null, name: null, email: "novo@example.com", category: "novo_comprador", transaction_code: "HP-TX-9" }),
];

const EXCLUIDOS = [
  {
    id: "eb-1",
    email: "teste@empresa.com",
    name: "Teste Interno",
    note: null,
    excluded_by: "user-9",
    excluded_by_email: "gestor@empresa.com",
    created_at: "2026-07-30T12:00:00Z",
  },
];

function mockEditRosterFetch(excluidos: unknown[] = []) {
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    if (url.includes("/excluded-buyers")) {
      if (init?.method === "POST" || init?.method === "DELETE") {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ buyers: excluidos }) });
    }
    if (url.includes("/roster")) return Promise.resolve({ ok: true, json: async () => ({ rows: EDIT_ROSTER }) });
    if (url.includes("/hourly")) return Promise.resolve({ ok: true, json: async () => ({ hours: [] }) });
    if (url.includes("/daily")) return Promise.resolve({ ok: true, json: async () => ({ days: [] }) });
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
  global.fetch = fetchMock as unknown as typeof global.fetch;
  return fetchMock;
}

describe("UltimatesDashboard — edição do roster (PRD editar_roster)", () => {
  it("gestor em ciclo ativo vê as três ações na linha da base", async () => {
    mockEditRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");

    expect(screen.getByTestId("ultimates-mark-renewed-n1@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-edit-buyer-n1@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-exclude-buyer-n1@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-unlink-buyer-r1@example.com")).toBeInTheDocument();
  });

  it("ciclo encerrado mantém só 'Excluir' na linha da base", async () => {
    mockEditRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "encerrado" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");

    expect(screen.getByTestId("ultimates-exclude-buyer-n1@example.com")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-edit-buyer-n1@example.com")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-mark-renewed-n1@example.com")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-unlink-buyer-r1@example.com")).not.toBeInTheDocument();
  });

  it("analista não vê nenhuma ação de edição", async () => {
    mockEditRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="analista" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");

    expect(screen.queryByTestId("ultimates-exclude-buyer-n1@example.com")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-edit-buyer-n1@example.com")).not.toBeInTheDocument();
  });

  it("abre o modal de exclusão a partir da linha", async () => {
    mockEditRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");
    fireEvent.click(screen.getByTestId("ultimates-exclude-buyer-n1@example.com"));

    expect(screen.getByTestId("ultimates-exclude-confirm-btn")).toBeInTheDocument();
  });

  it("abre o vínculo invertido com as compras não atribuídas do ciclo", async () => {
    mockEditRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");
    fireEvent.click(screen.getByTestId("ultimates-mark-renewed-n1@example.com"));

    // A compra de novo@example.com é a candidata — veio do mesmo roster.
    expect(screen.getByTestId("ultimates-mark-renewed-select-HP-TX-9")).toBeInTheDocument();
  });

  it("abre o modal de edição de cadastro a partir da linha", async () => {
    mockEditRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");
    fireEvent.click(screen.getByTestId("ultimates-edit-buyer-n1@example.com"));

    expect(screen.getByTestId("ultimates-edit-confirm-btn")).toBeInTheDocument();
  });
});

describe("UltimatesDashboard — sinalização de leads excluídos", () => {
  it("exibe o contador no botão e no tile Base", async () => {
    mockEditRosterFetch(EXCLUIDOS);
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");

    expect(await screen.findByTestId("ultimates-excluded-buyers-btn")).toHaveTextContent(
      "Leads excluídos (1)"
    );
    expect(screen.getByTestId("ultimates-kpi-base")).toHaveTextContent("1 excluído");
  });

  it("sem exclusões, o botão aparece sem contador", async () => {
    mockEditRosterFetch();
    render(<UltimatesDashboard cycle={makeCycle({ status: "ativo" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");

    expect(screen.getByTestId("ultimates-excluded-buyers-btn")).toHaveTextContent("Leads excluídos");
    expect(screen.getByTestId("ultimates-excluded-buyers-btn")).not.toHaveTextContent("(");
  });

  it("o botão abre o modal de gestão mesmo em ciclo encerrado", async () => {
    mockEditRosterFetch(EXCLUIDOS);
    render(<UltimatesDashboard cycle={makeCycle({ status: "encerrado" })} role="gestor" onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)} />);

    await screen.findByTestId("ultimates-kpi-row");
    fireEvent.click(screen.getByTestId("ultimates-excluded-buyers-btn"));

    expect(await screen.findByTestId("ultimates-excluded-buyers-modal")).toBeInTheDocument();
  });
});

describe("UltimatesDashboard — filtro de datas", () => {
  // Roster da JANELA: quem movimentou no período, mais uma linha nao_renovado
  // (a RPC recortada continua devolvendo a base inteira — o descarte é da
  // exibição, não da rota).
  const ROSTER_JANELA: UltimatesRosterRow[] = [
    row({ buyer_id: "b1", name: "Renovou 1", email: "r1@example.com", category: "renovado" }),
    row({ buyer_id: "b3", name: "Não Renovou", email: "n1@example.com", category: "nao_renovado" }),
    row({ buyer_id: null, name: "Novo", email: "novo@example.com", category: "novo_comprador" }),
  ];

  function mockComJanela(janelaOk = true) {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/roster") && url.includes("start=")) {
        return janelaOk
          ? Promise.resolve({ ok: true, status: 200, json: async () => ({ rows: ROSTER_JANELA }) })
          : Promise.resolve({
              ok: false,
              status: 501,
              json: async () => ({ error: "Recorte por data indisponível" }),
            });
      }
      if (url.includes("/roster")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ rows: ROSTER }) });
      }
      if (url.includes("/hourly")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ hours: HOURLY }) });
      }
      if (url.includes("/daily")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ days: DAILY }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    }) as unknown as typeof global.fetch;
  }

  // Ciclo COM janela salva (migration 063). O período não é mais escolhido na
  // tela: ele chega pronto na prop, e o dashboard só o aplica.
  const COM_JANELA = { view_start_date: "2026-07-01", view_end_date: "2026-07-02" };

  it("ciclo sem janela não busca o roster recortado", async () => {
    mockComJanela();
    render(
      <UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    await screen.findByTestId("ultimates-kpi-row");
    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("start="))).toBe(false);
    expect(screen.queryByTestId("ultimates-date-note")).not.toBeInTheDocument();
  });

  it("ciclo com janela recorta na PRIMEIRA carga, sem ninguém clicar", async () => {
    mockComJanela();
    render(
      <UltimatesDashboard cycle={makeCycle(COM_JANELA)} role="gestor" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    // Base = 3 (roster do ciclo, inalterado). Renovados = 1 e novos = 1 (janela).
    expect(await screen.findByTestId("ultimates-date-note")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-kpi-base")).toHaveTextContent("3");
    expect(screen.getByTestId("ultimates-kpi-renovados")).toHaveTextContent("1");
    expect(screen.getByTestId("ultimates-kpi-novos-compradores")).toHaveTextContent("1");

    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("start=2026-07-01&end=2026-07-02"))).toBe(true);
  });

  it("com janela, a tabela mostra só quem movimentou — sem os não renovados", async () => {
    mockComJanela();
    render(
      <UltimatesDashboard cycle={makeCycle(COM_JANELA)} role="gestor" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    expect(await screen.findByText("Novo")).toBeInTheDocument();
    expect(screen.getByText("Renovou 1")).toBeInTheDocument();
    expect(screen.queryByText("Não Renovou")).not.toBeInTheDocument();
  });

  it("gestor salvando manda o intervalo para o pai, não para o navegador", async () => {
    mockComJanela();
    const onViewRangeChange = jest.fn().mockResolvedValue(true);
    render(
      <UltimatesDashboard cycle={makeCycle()} role="gestor" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={onViewRangeChange} />
    );

    fireEvent.change(await screen.findByTestId("ultimates-date-start"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByTestId("ultimates-date-end"), {
      target: { value: "2026-07-02" },
    });
    fireEvent.click(screen.getByTestId("ultimates-date-apply"));

    expect(onViewRangeChange).toHaveBeenCalledWith("c1", {
      start: "2026-07-01",
      end: "2026-07-02",
    });
    // A janela só muda quando a prop muda: o dashboard NÃO aplica localmente o
    // que ainda não foi confirmado pelo banco.
    expect(screen.queryByTestId("ultimates-date-note")).not.toBeInTheDocument();
  });

  it("gestor limpando manda null para o pai", async () => {
    mockComJanela();
    const onViewRangeChange = jest.fn().mockResolvedValue(true);
    render(
      <UltimatesDashboard cycle={makeCycle(COM_JANELA)} role="gestor" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={onViewRangeChange} />
    );

    fireEvent.click(await screen.findByTestId("ultimates-date-clear"));
    expect(onViewRangeChange).toHaveBeenCalledWith("c1", null);
  });

  it("analista vê a janela do ciclo, sem poder mexer", async () => {
    mockComJanela();
    render(
      <UltimatesDashboard cycle={makeCycle(COM_JANELA)} role="analista" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    expect(await screen.findByTestId("ultimates-date-readonly")).toHaveTextContent(
      "01/07/2026 – 02/07/2026"
    );
    expect(screen.queryByTestId("ultimates-date-start")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-date-apply")).not.toBeInTheDocument();
    // E o recorte vale para ele igualzinho.
    expect(screen.getByTestId("ultimates-kpi-renovados")).toHaveTextContent("1");
  });

  it("analista em ciclo sem janela não vê barra nenhuma", async () => {
    mockComJanela();
    render(
      <UltimatesDashboard cycle={makeCycle()} role="analista" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.queryByTestId("ultimates-date-filter")).not.toBeInTheDocument();
  });

  it("a janela acompanha a troca de ciclo, em vez de vazar para o próximo", async () => {
    mockComJanela();
    const { rerender } = render(
      <UltimatesDashboard cycle={makeCycle(COM_JANELA)} role="gestor" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );
    await screen.findByTestId("ultimates-date-note");

    rerender(
      <UltimatesDashboard cycle={makeCycle({ id: "c2", name: "Ciclo Agosto" })} role="gestor" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    // Ciclo novo não tem janela: volta a base inteira, sem nota e sem os campos
    // preenchidos com as datas do ciclo anterior.
    expect(await screen.findByText("Não Renovou")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-date-note")).not.toBeInTheDocument();
    expect((screen.getByTestId("ultimates-date-start") as HTMLInputElement).value).toBe("");
  });

  it("recorte que falha degrada sozinho: dash inteiro do ciclo + aviso", async () => {
    mockComJanela(false);
    render(
      <UltimatesDashboard cycle={makeCycle(COM_JANELA)} role="gestor" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    expect(await screen.findByTestId("ultimates-date-unavailable")).toBeInTheDocument();
    // Nada zerado nem em branco: todos os tiles caem de volta para o ciclo.
    expect(screen.getByTestId("ultimates-kpi-renovados")).toHaveTextContent("2");
    expect(screen.queryByTestId("ultimates-date-note")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-dashboard-error")).not.toBeInTheDocument();
  });

  it("o aviso de recorte falho chega até quem não edita", async () => {
    mockComJanela(false);
    render(
      <UltimatesDashboard cycle={makeCycle(COM_JANELA)} role="analista" onCountsNewBuyersChange={jest.fn()} onViewRangeChange={jest.fn().mockResolvedValue(true)} />
    );

    expect(await screen.findByTestId("ultimates-date-unavailable")).toBeInTheDocument();
  });
});

describe("UltimatesDashboard — modo Apenas Compras (#154)", () => {
  function renderPurchases(overrides: Partial<CycleWithProducts> = {}) {
    mockRosterAndDailyFetch();
    return render(
      <UltimatesDashboard
        cycle={makeCycle({ purchases_only: true, ...overrides })}
        role="gestor"
        onCountsNewBuyersChange={jest.fn().mockResolvedValue(true)} onViewRangeChange={jest.fn().mockResolvedValue(true)}
      />
    );
  }

  it("esconde 'Carregar base' e o interruptor Novas Compras", async () => {
    renderPurchases();
    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.queryByTestId("ultimates-upload-btn")).toBeNull();
    expect(screen.queryByTestId("ultimates-new-purchases-toggle")).toBeNull();
  });

  it("mantém Ofertas excluídas, Leads excluídos e Atualizar agora", async () => {
    renderPurchases();
    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.getByTestId("ultimates-excluded-offers-btn")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-excluded-buyers-btn")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-refresh-controls")).toBeInTheDocument();
  });

  it("mostra os tiles de compra e nenhum tile de renovação", async () => {
    renderPurchases();
    await screen.findByTestId("ultimates-kpi-row");
    // ROSTER tem 2 renovado -> 2 compras.
    expect(screen.getByTestId("ultimates-kpi-compras")).toHaveTextContent("2");
    expect(screen.getByTestId("ultimates-kpi-valor-total")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-kpi-base")).toBeNull();
    expect(screen.queryByTestId("ultimates-kpi-renovados")).toBeNull();
  });

  it("não mostra a barra de meta mesmo com goal_percent cadastrado", async () => {
    renderPurchases({ goal_percent: 60 });
    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.queryByTestId("ultimates-goal-bar")).toBeNull();
  });

  it("descreve a Seção 01 como 'Compras do ciclo'", async () => {
    renderPurchases();
    await screen.findByTestId("ultimates-kpi-row");
    expect(screen.getByText("Compras do ciclo")).toBeInTheDocument();
  });

  it("gráfico é série única de compras, sem seletor de séries", async () => {
    renderPurchases();
    await screen.findByTestId("ultimates-cumulative-chart");
    expect(screen.queryByTestId("ultimates-cumulative-series-switch")).toBeNull();
    expect(screen.getByText("Compras acumuladas")).toBeInTheDocument();
  });

  it("roster oferece só Editar e Excluir por linha (sem vincular/marcar/desfazer)", async () => {
    renderPurchases();
    await screen.findByTestId("ultimates-kpi-row");
    // ROSTER tem b1/b2 renovado (materializados) e b3 nao_renovado — mas em
    // compras não há vínculo nem marcar renovado.
    expect(screen.getByTestId("ultimates-edit-buyer-r1@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-exclude-buyer-r1@example.com")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-mark-renewed-n1@example.com")).toBeNull();
    expect(screen.queryByTestId("ultimates-link-buyer-r1@example.com")).toBeNull();
    expect(screen.queryByTestId("ultimates-unlink-buyer-r1@example.com")).toBeNull();
  });
});
