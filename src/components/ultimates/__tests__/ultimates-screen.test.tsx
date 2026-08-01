/** @jest-environment jsdom */
import React from "react";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UltimatesScreen } from "../ultimates-screen";
import type { CycleWithProducts, HotmartProductOption } from "../types";

const PRODUCTS: HotmartProductOption[] = [{ product_id: "p1", product_name: "Produto Um", account_id: "acc-1" }];

function makeCycle(overrides: Partial<CycleWithProducts> = {}): CycleWithProducts {
  return {
    id: "c1",
    name: "Ciclo 1",
    account_id: "acc-1",
    products: [{ product_id: "p1", product_name: "Produto Um" }],
    goal_percent: 50,
    status: "ativo",
    refresh_started_at: null,
    last_refresh_at: null,
    created_by: "user-1",
    created_at: "2026-07-19T00:00:00Z",
    updated_at: "2026-07-19T00:00:00Z",
    counts_new_buyers: true,
    purchases_only: false,
    ...overrides,
  };
}

function mockCyclesFetch(cycles: CycleWithProducts[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ cycles }),
  }) as unknown as typeof global.fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("UltimatesScreen — estado vazio", () => {
  it("gestor vê CTA para criar o primeiro ciclo", async () => {
    mockCyclesFetch([]);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    expect(await screen.findByTestId("ultimates-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-create-cta")).toBeInTheDocument();
  });

  it("analista vê mensagem informativa, sem CTA de criação", async () => {
    mockCyclesFetch([]);
    render(<UltimatesScreen role="analista" products={PRODUCTS} />);

    expect(await screen.findByTestId("ultimates-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-create-cta")).not.toBeInTheDocument();
  });
});

describe("UltimatesScreen — gates de papel com ciclos existentes", () => {
  it("gestor vê botão Novo ciclo e botão de editar o ciclo selecionado", async () => {
    mockCyclesFetch([makeCycle()]);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    expect(await screen.findByTestId("ultimates-new-cycle-btn")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-edit-cycle-btn")).toBeInTheDocument();
  });

  it("analista não vê botão Novo ciclo nem botão de editar", async () => {
    mockCyclesFetch([makeCycle()]);
    render(<UltimatesScreen role="analista" products={PRODUCTS} />);

    expect(await screen.findByTestId("ultimates-dashboard-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-new-cycle-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-edit-cycle-btn")).not.toBeInTheDocument();
  });
});

describe("UltimatesScreen — seletor de ciclo", () => {
  it("abre no ciclo ativo mais recente, mesmo quando não é o primeiro/mais recente da lista", async () => {
    // Ordenado created_at desc, como o contrato de GET /api/ultimates/cycles: o
    // primeiro (mais recente) está encerrado; o ativo mais recente vem depois.
    const cycles = [
      makeCycle({ id: "c3", name: "Ciclo Mais Recente (encerrado)", status: "encerrado", created_at: "2026-07-19T00:00:00Z" }),
      makeCycle({ id: "c2", name: "Ciclo Ativo Recente", status: "ativo", created_at: "2026-07-18T00:00:00Z" }),
      makeCycle({ id: "c1", name: "Ciclo Ativo Antigo", status: "ativo", created_at: "2026-07-01T00:00:00Z" }),
    ];
    mockCyclesFetch(cycles);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    expect(await screen.findByTestId("ultimates-selected-cycle")).toHaveTextContent("Ciclo Ativo Recente");
  });

  it("cai no ciclo mais recente (mesmo encerrado) quando não há nenhum ativo", async () => {
    const cycles = [
      makeCycle({ id: "c2", name: "Encerrado Recente", status: "encerrado", created_at: "2026-07-19T00:00:00Z" }),
      makeCycle({ id: "c1", name: "Encerrado Antigo", status: "encerrado", created_at: "2026-07-01T00:00:00Z" }),
    ];
    mockCyclesFetch(cycles);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    expect(await screen.findByTestId("ultimates-selected-cycle")).toHaveTextContent("Encerrado Recente");
  });

  it("ciclo encerrado exibe badge 'Encerrado' no seletor; ciclo ativo convive com ele e ambos ficam disponíveis", async () => {
    const cycles = [
      makeCycle({ id: "c2", name: "Ciclo Encerrado", status: "encerrado", created_at: "2026-07-19T00:00:00Z" }),
      makeCycle({ id: "c1", name: "Ciclo Ativo", status: "ativo", created_at: "2026-07-18T00:00:00Z" }),
    ];
    mockCyclesFetch(cycles);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    await screen.findByTestId("ultimates-dashboard-slot");

    const selector = screen.getByTestId("ultimates-cycle-selector");
    const encerradoOption = within(selector).getByTestId("ultimates-cycle-option-c2");
    expect(within(encerradoOption).getByText("Encerrado")).toBeInTheDocument();
    expect(within(selector).getByTestId("ultimates-cycle-option-c1")).toBeInTheDocument();
  });
});

describe("UltimatesScreen — exclusão de ciclo", () => {
  function mockCyclesAndDelete(cycles: CycleWithProducts[], deleteOk = true) {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve({ ok: deleteOk, status: deleteOk ? 200 : 500, json: async () => ({}) });
      }
      // Rotas do dashboard (roster / daily / excluded-offers) — vazias bastam.
      if (url.includes("/api/ultimates/cycles/")) {
        return Promise.resolve({ ok: true, json: async () => ({ rows: [], days: [], offers: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ cycles }) });
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;
    return fetchMock;
  }

  async function deleteSelectedCycle(name: string) {
    fireEvent.click(screen.getByTestId("ultimates-edit-cycle-btn"));
    fireEvent.click(await screen.findByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: name },
    });
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));
  }

  // A reseleção usa selectInitialCycleId, não "o primeiro da lista": com um
  // encerrado mais recente sobrando, cair no primeiro abriria o encerrado.
  it("remove o ciclo excluído do seletor e reseleciona o ativo mais recente restante", async () => {
    const cycles = [
      makeCycle({ id: "c3", name: "Encerrado Recente", status: "encerrado", created_at: "2026-07-19T00:00:00Z" }),
      makeCycle({ id: "c2", name: "Ativo Recente", status: "ativo", created_at: "2026-07-18T00:00:00Z" }),
      makeCycle({ id: "c1", name: "Ativo Antigo", status: "ativo", created_at: "2026-07-01T00:00:00Z" }),
    ];
    const fetchMock = mockCyclesAndDelete(cycles);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    expect(await screen.findByTestId("ultimates-selected-cycle")).toHaveTextContent("Ativo Recente");

    await deleteSelectedCycle("Ativo Recente");

    await waitFor(() =>
      expect(screen.queryByTestId("ultimates-cycle-option-c2")).not.toBeInTheDocument()
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/ultimates/cycles/c2", { method: "DELETE" });
    expect(screen.getByTestId("ultimates-selected-cycle")).toHaveTextContent("Ativo Antigo");
    expect(screen.getByTestId("ultimates-cycle-option-c3")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-cycle-option-c1")).toBeInTheDocument();
  });

  it("excluir o último ciclo cai no estado vazio, sem seleção pendurada", async () => {
    mockCyclesAndDelete([makeCycle({ id: "c1", name: "Único Ciclo" })]);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    await screen.findByTestId("ultimates-dashboard-slot");
    await deleteSelectedCycle("Único Ciclo");

    expect(await screen.findByTestId("ultimates-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-cycle-selector")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-dashboard-slot")).not.toBeInTheDocument();
  });

  it("fecha o modal ao concluir a exclusão", async () => {
    mockCyclesAndDelete([
      makeCycle({ id: "c2", name: "Ciclo Alvo", created_at: "2026-07-19T00:00:00Z" }),
      makeCycle({ id: "c1", name: "Ciclo Restante", created_at: "2026-07-01T00:00:00Z" }),
    ]);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    await screen.findByTestId("ultimates-dashboard-slot");
    await deleteSelectedCycle("Ciclo Alvo");

    await waitFor(() => expect(screen.queryByTestId("cycle-form-save")).not.toBeInTheDocument());
    expect(screen.getByTestId("ultimates-selected-cycle")).toHaveTextContent("Ciclo Restante");
  });

  it("falha na exclusão mantém o ciclo na lista e o modal aberto", async () => {
    mockCyclesAndDelete([makeCycle({ id: "c1", name: "Único Ciclo" })], false);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    await screen.findByTestId("ultimates-dashboard-slot");
    await deleteSelectedCycle("Único Ciclo");

    expect(await screen.findByTestId("cycle-form-delete-error")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-cycle-option-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-empty-state")).not.toBeInTheDocument();
  });

  it("analista não alcança a exclusão: sem botão de editar, sem modal", async () => {
    mockCyclesAndDelete([makeCycle({ id: "c1", name: "Único Ciclo" })]);
    render(<UltimatesScreen role="analista" products={PRODUCTS} />);

    await screen.findByTestId("ultimates-dashboard-slot");
    expect(screen.queryByTestId("ultimates-edit-cycle-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-delete-open")).not.toBeInTheDocument();
  });
});

describe("UltimatesScreen — persistência do switch Novas Compras", () => {
  function mockCyclesAndPatch(patchOk: boolean, initialCountsNewBuyers = true) {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Promise.resolve({ ok: patchOk, json: async () => ({}) });
      }
      // Rotas do dashboard (roster / daily / excluded-offers) — vazias bastam.
      if (url.includes("/api/ultimates/cycles/")) {
        return Promise.resolve({ ok: true, json: async () => ({ rows: [], days: [], offers: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ cycles: [makeCycle({ counts_new_buyers: initialCountsNewBuyers })] }),
      });
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;
    return fetchMock;
  }

  it("faz PATCH com countsNewBuyers ao alternar", async () => {
    const fetchMock = mockCyclesAndPatch(true);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    fireEvent.click(await screen.findByTestId("ultimates-new-purchases-toggle"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/ultimates/cycles/c1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ countsNewBuyers: false }),
        })
      )
    );
  });

  it("aplica de forma otimista antes da resposta", async () => {
    mockCyclesAndPatch(true);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    const toggle = await screen.findByTestId("ultimates-new-purchases-toggle");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByTestId("ultimates-new-purchases-toggle")).toHaveAttribute(
        "aria-checked",
        "false"
      )
    );
  });

  it("reverte o switch e mostra o erro quando o PATCH falha", async () => {
    mockCyclesAndPatch(false);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    const toggle = await screen.findByTestId("ultimates-new-purchases-toggle");
    fireEvent.click(toggle);

    expect(await screen.findByTestId("ultimates-new-purchases-feedback")).toHaveTextContent(
      "Não foi possível salvar a configuração."
    );
    expect(screen.getByTestId("ultimates-new-purchases-toggle")).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("reverte o switch para 'false' quando o PATCH falha partindo de counts_new_buyers = false", async () => {
    // Simétrico ao teste acima, mas partindo do estado oposto: a fixture do
    // describe é counts_new_buyers = true, então o teste anterior só percorre
    // true → false → true. Uma implementação que troque `previous` por um
    // literal `true` hardcoded passaria idêntico nele. Partindo de false, o
    // rollback correto é false → true → false; um literal `true` faria o
    // switch terminar em "true" e este teste capturaria o erro.
    mockCyclesAndPatch(false, false);
    render(<UltimatesScreen role="gestor" products={PRODUCTS} />);

    const toggle = await screen.findByTestId("ultimates-new-purchases-toggle");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);

    expect(await screen.findByTestId("ultimates-new-purchases-feedback")).toHaveTextContent(
      "Não foi possível salvar a configuração."
    );
    expect(screen.getByTestId("ultimates-new-purchases-toggle")).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("o switch fica travado para analista", async () => {
    mockCyclesAndPatch(true);
    render(<UltimatesScreen role="analista" products={PRODUCTS} />);

    expect(await screen.findByTestId("ultimates-new-purchases-toggle")).toBeDisabled();
  });
});
