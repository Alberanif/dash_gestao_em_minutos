/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { VendasScreen } from "../vendas-screen";
import type { HotmartProductOption } from "../types";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";

const PRODUCTS: HotmartProductOption[] = [{ product_id: "p1", product_name: "Produto Um", account_id: "acc-1" }];

function makeView(overrides: Partial<VendasViewRecord> = {}): VendasViewRecord {
  return {
    id: "v1",
    name: "Visão 1",
    account_id: "acc-1",
    product_id: "p1",
    offer_codes: ["OF-1", "OF-2"],
    folder_id: null,
    view_start_date: null,
    view_end_date: null,
    refresh_started_at: null,
    last_refresh_at: null,
    backfill_status: "done",
    backfill_from: null,
    migrated_from_cycle_id: null,
    created_by: "u1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const FOLDER = {
  id: "f1",
  name: "Lançamentos",
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as unknown as VendasFolderRecord;

interface Mock {
  views: VendasViewRecord[];
  unmigrated?: { id: string; name: string }[];
  folders?: VendasFolderRecord[];
  kpis?: { sales: number; refunded: number };
  daily?: { day: string; sales: number }[];
  offers?: { offer_code: string; offer_name: string | null; sales: number; refunded: number }[];
  // Sobrescritas por rota: "METHOD url" → resposta.
  overrides?: Record<string, { status?: number; body: unknown }>;
}

function installFetch(m: Mock) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const over = m.overrides?.[`${method} ${url}`];
    const respond = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    if (over) return respond(over.body, over.status ?? 200);
    const path = url.split("?")[0];
    if (path === "/api/vendas/views" && method === "GET") return respond({ views: m.views, unmigrated_cycles: m.unmigrated ?? [] });
    if (path === "/api/vendas/folders" && method === "GET") return respond({ folders: m.folders ?? [] });
    if (/\/kpis$/.test(path)) return respond(m.kpis ?? { sales: 7, refunded: 2 });
    if (/\/daily$/.test(path)) return respond({ rows: m.daily ?? [{ day: "2026-08-01", sales: 3 }, { day: "2026-08-02", sales: 4 }] });
    if (/\/hourly$/.test(path)) return respond({ rows: [{ hour: "2026-08-01T10", sales: 7 }] });
    if (/\/offers$/.test(path))
      return respond({
        rows: m.offers ?? [
          { offer_code: "OF-1", offer_name: "Oferta Um", sales: 7, refunded: 2 },
          { offer_code: "OF-2", offer_name: null, sales: 0, refunded: 0 },
        ],
      });
    if (/offer-options/.test(path)) return respond({ offers: [{ offer_code: "OF-1", offer_name: "Oferta Um", sales_count: 7 }] });
    return respond({ error: "sem mock" }, 404);
  }) as unknown as typeof global.fetch;
  return calls;
}

let confirmSpy: jest.SpyInstance;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  confirmSpy = jest.spyOn(window, "confirm").mockImplementation(() => true);
  alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  // Nenhum fluxo da tela pode recorrer aos diálogos nativos.
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(alertSpy).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("VendasScreen — estado vazio e papéis", () => {
  it("gestor sem visualizações vê o CTA de criar", async () => {
    installFetch({ views: [] });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    expect(await screen.findByText("Nenhuma visualização criada ainda")).toBeInTheDocument();
    expect(screen.getByTestId("vendas-create-cta")).toBeInTheDocument();
  });

  it("analista sem visualizações vê texto informativo, sem CTA nem botão de criar", async () => {
    installFetch({ views: [] });
    render(<VendasScreen role="analista" products={PRODUCTS} />);
    expect(await screen.findByText("Nenhuma visualização criada ainda")).toBeInTheDocument();
    expect(screen.queryByTestId("vendas-create-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vendas-new-view-btn")).not.toBeInTheDocument();
  });

  it("gestor vê criar, editar e editar período; analista não vê nenhum deles (mas vê Atualizar agora)", async () => {
    installFetch({ views: [makeView()], folders: [FOLDER] });
    const { unmount } = render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");
    expect(screen.getByTestId("vendas-new-view-btn")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-edit-cycle-btn")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-date-apply")).toBeInTheDocument();
    unmount();

    installFetch({ views: [makeView({ view_start_date: "2026-08-01", view_end_date: "2026-08-10" })], folders: [FOLDER] });
    render(<VendasScreen role="analista" products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");
    expect(screen.queryByTestId("vendas-new-view-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vendas-new-folder-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-edit-cycle-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-date-apply")).not.toBeInTheDocument();
    expect(screen.getByTestId("ultimates-date-readonly")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-refresh-btn")).toBeInTheDocument();
  });

  it("abre a visualização mais recente por created_at", async () => {
    installFetch({
      views: [
        makeView({ id: "velha", name: "Velha", created_at: "2026-01-01T00:00:00Z" }),
        makeView({ id: "nova", name: "Nova", created_at: "2026-08-05T00:00:00Z" }),
      ],
    });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-selected-name")).toHaveTextContent("Nova");
  });

  it("aviso de ciclos antigos não migrados aparece só para o gestor", async () => {
    const mock = { views: [makeView()], unmigrated: [{ id: "c1", name: "Ciclo A" }, { id: "c2", name: "Ciclo B" }] };
    installFetch(mock);
    const { unmount } = render(<VendasScreen role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("vendas-unmigrated-notice")).toHaveTextContent(
      "2 ciclos antigos não foram migrados por falta de ofertas configuradas."
    );
    unmount();

    installFetch(mock);
    render(<VendasScreen role="analista" products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");
    expect(screen.queryByTestId("vendas-unmigrated-notice")).not.toBeInTheDocument();
  });
});

describe("VendasScreen — números do dashboard", () => {
  it("KPI, soma do gráfico por dia e soma da quebra por oferta mostram o mesmo total, sem alerta de divergência", async () => {
    installFetch({ views: [makeView()] });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales-value")).toHaveTextContent("7");
    expect(screen.getByText("Total no gráfico: 7")).toBeInTheDocument();
    expect(screen.getByText("Total nas ofertas: 7")).toBeInTheDocument();
    expect(screen.getByTestId("view-kpi-refunded-value")).toHaveTextContent("2");
    expect(screen.queryByTestId("view-totals-mismatch")).not.toBeInTheDocument();
  });

  it("avisa quando KPI, dia e oferta divergem", async () => {
    installFetch({ views: [makeView()], kpis: { sales: 9, refunded: 0 } });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-totals-mismatch")).toHaveTextContent("KPI 9");
  });

  it("oferta sem venda coletada aparece com 0 e a marca '0 vendas coletadas'; oferta com venda não tem a marca", async () => {
    installFetch({ views: [makeView()] });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-offers-list");
    expect(screen.getByTestId("view-offer-OF-2-sales")).toHaveTextContent("0");
    expect(screen.getByTestId("view-offer-OF-2-empty")).toHaveTextContent("0 vendas coletadas");
    expect(screen.queryByTestId("view-offer-OF-1-empty")).not.toBeInTheDocument();
  });

  it("indicador de reembolsadas explica o reembolso retroativo", async () => {
    installFetch({ views: [makeView()] });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-refunded");
    expect(screen.queryByTestId("view-refunded-help")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-refunded-help-btn"));
    expect(screen.getByTestId("view-refunded-help")).toHaveTextContent("retroativo");
  });

  it("alternar para Hora troca o título do gráfico por dia", async () => {
    installFetch({ views: [makeView()] });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-daily-chart");
    expect(screen.getByTestId("view-daily-chart")).toHaveTextContent("Vendas por dia");
    fireEvent.click(screen.getByTestId("view-daily-granularity-hora"));
    expect(screen.getByTestId("view-daily-chart")).toHaveTextContent("Vendas por hora");
  });

  it("período salvo vai nas rotas de dados como start/end", async () => {
    const calls = installFetch({ views: [makeView({ view_start_date: "2026-08-01", view_end_date: "2026-08-10" })] });
    render(<VendasScreen role="analista" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    expect(calls.some((c) => c.url === "/api/vendas/views/v1/kpis?start=2026-08-01&end=2026-08-10")).toBe(true);
  });

  it("gestor salva o período por PATCH da visualização e os números são relidos com ele", async () => {
    const updated = makeView({ view_start_date: "2026-08-01", view_end_date: "2026-08-05" });
    const calls = installFetch({
      views: [makeView()],
      overrides: { "PATCH /api/vendas/views/v1": { body: { view: updated } } },
    });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    fireEvent.change(screen.getByTestId("ultimates-date-start"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByTestId("ultimates-date-end"), { target: { value: "2026-08-05" } });
    fireEvent.click(screen.getByTestId("ultimates-date-apply"));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ view_start_date: "2026-08-01", view_end_date: "2026-08-05" })
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes("kpis?start=2026-08-01&end=2026-08-05"))).toBe(true));
  });
});

describe("VendasScreen — estados do backfill", () => {
  it("done: histórico completo, sem selo de incompleto", async () => {
    installFetch({ views: [makeView({ backfill_status: "done" })] });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    const notice = await screen.findByTestId("view-backfill-notice");
    expect(notice).toHaveAttribute("data-backfill-status", "done");
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales")).not.toHaveTextContent(/parcial|Coletando|falhou/);
  });

  it("running: 'Coletando histórico…' e o KPI não se apresenta como completo", async () => {
    installFetch({ views: [makeView({ backfill_status: "running" })] });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-backfill-notice")).toHaveTextContent("Coletando histórico…");
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales")).toHaveTextContent("Coletando histórico…");
  });

  it("partial: mostra a data inicial e marca o KPI como parcial", async () => {
    installFetch({ views: [makeView({ backfill_status: "partial", backfill_from: "2026-07-01" })] });
    render(<VendasScreen role="analista" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-backfill-notice")).toHaveTextContent("a partir de 01/07/2026");
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales")).toHaveTextContent("Histórico parcial");
  });

  it("failed: mensagem de falha, KPI marcado e 'Tentar novamente' dispara o refresh da visualização", async () => {
    const calls = installFetch({
      views: [makeView({ backfill_status: "failed" })],
      overrides: { "POST /api/vendas/views/v1/refresh": { body: { view: makeView({ backfill_status: "running" }) } } },
    });
    render(<VendasScreen role="analista" products={PRODUCTS} />);
    const notice = await screen.findByTestId("view-backfill-notice");
    expect(notice).toHaveTextContent("Não foi possível coletar o histórico");
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales")).toHaveTextContent("Coleta falhou");
    fireEvent.click(screen.getByTestId("view-backfill-retry"));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url === "/api/vendas/views/v1/refresh")).toBe(true));
  });

  it("falha do retry (409) mostra o erro do servidor", async () => {
    installFetch({
      views: [makeView({ backfill_status: "failed" })],
      overrides: { "POST /api/vendas/views/v1/refresh": { status: 409, body: { error: "Atualização já em andamento." } } },
    });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("view-backfill-retry"));
    expect(await screen.findByTestId("view-backfill-retry-error")).toHaveTextContent("Atualização já em andamento.");
  });

  it("running faz poll da visualização até concluir", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask"] });
    const calls = installFetch({
      views: [makeView({ backfill_status: "running" })],
      overrides: { "GET /api/vendas/views/v1": { body: { view: makeView({ backfill_status: "done" }) } } },
    });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-backfill-notice");
    await React.act(async () => {
      jest.advanceTimersByTime(5100);
    });
    await waitFor(() => expect(screen.getByTestId("view-backfill-notice")).toHaveAttribute("data-backfill-status", "done"));
    expect(calls.some((c) => c.method === "GET" && c.url === "/api/vendas/views/v1")).toBe(true);
  });
});

describe("VendasScreen — exclusão com diálogo próprio", () => {
  async function openEditAndDelete() {
    fireEvent.click(await screen.findByTestId("ultimates-edit-cycle-btn"));
    fireEvent.click(await screen.findByTestId("view-form-delete-open"));
  }

  it("excluir visualização: cancelar não chama a API, confirmar faz DELETE e remove da lista", async () => {
    const calls = installFetch({
      views: [
        makeView({ id: "v1", name: "Visão 1", created_at: "2026-08-02T00:00:00Z" }),
        makeView({ id: "v2", name: "Visão 2", created_at: "2026-08-01T00:00:00Z" }),
      ],
      overrides: { "DELETE /api/vendas/views/v1": { body: { ok: true } } },
    });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await openEditAndDelete();

    expect(screen.getByTestId("confirm-dialog")).toHaveAttribute("role", "alertdialog");
    fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByTestId("view-form-delete-open"));
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/vendas/views/v1")).toBe(true));
    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("view-selected-name")).toHaveTextContent("Visão 2"));
  });

  it("erro da API fica no diálogo, que permanece aberto (sem alert)", async () => {
    installFetch({
      views: [makeView()],
      overrides: { "DELETE /api/vendas/views/v1": { status: 500, body: { error: "Falha no banco" } } },
    });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    await openEditAndDelete();
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(await screen.findByTestId("confirm-dialog-error")).toHaveTextContent("Falha no banco");
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
  });

  it("excluir pasta usa o mesmo diálogo (sem confirm nativo) e solta as visualizações para 'Sem pasta'", async () => {
    const calls = installFetch({
      views: [makeView({ folder_id: "f1" })],
      folders: [FOLDER],
      overrides: { "DELETE /api/vendas/folders/f1": { body: { ok: true } } },
    });
    render(<VendasScreen role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("folder-menu-btn-f1"));
    fireEvent.click(screen.getByTestId("folder-delete-btn-f1"));
    expect(screen.getByTestId("confirm-dialog")).toHaveTextContent("Lançamentos");
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/vendas/folders/f1")).toBe(true));
    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument());
    expect(screen.queryByTestId("folder-section-f1")).not.toBeInTheDocument();
    expect(screen.getByTestId("folder-section-unfoldered")).toBeInTheDocument();
  });
});
