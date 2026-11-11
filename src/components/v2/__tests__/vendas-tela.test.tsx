/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TelaDeVendas } from "../vendas/tela-de-vendas";
import type { ProdutoHotmart } from "../vendas/tipos";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";
import type { UserRole } from "@/types/auth";

// O tipo só admite gestor e analista; o guard da página barra o resto. A tela ainda assim nega edição a qualquer outro valor.
const SEM_EDICAO = "leitor" as unknown as UserRole;

const PRODUCTS: ProdutoHotmart[] = [{ product_id: "p1", product_name: "Produto Um", account_id: "acc-1" }];

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

const PASTA = {
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
  viewsStatus?: number;
  overrides?: Record<string, { status?: number; body: unknown }>;
}

function instalaFetch(m: Mock) {
  const calls: { method: string; url: string }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url });
    const respond = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    const over = m.overrides?.[`${method} ${url}`];
    if (over) return respond(over.body, over.status ?? 200);
    if (url === "/api/vendas/views") {
      return m.viewsStatus && m.viewsStatus >= 400
        ? respond({ error: "x" }, m.viewsStatus)
        : respond({ views: m.views, unmigrated_cycles: m.unmigrated ?? [] });
    }
    if (url === "/api/vendas/folders") return respond({ folders: m.folders ?? [] });
    return respond({ error: "sem mock" }, 404);
  }) as unknown as typeof global.fetch;
  return calls;
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("TelaDeVendas: estado vazio e papéis", () => {
  it("gestor e analista sem visualizações veem o convite para criar", async () => {
    for (const role of ["gestor", "analista"] as const) {
      instalaFetch({ views: [] });
      const { unmount } = render(<TelaDeVendas role={role} products={PRODUCTS} />);
      expect(await screen.findByTestId("vendas-empty-state")).toHaveTextContent("Nenhuma visualização criada ainda");
      expect(screen.getByTestId("vendas-empty-state")).toHaveTextContent("Crie a primeira visualização");
      unmount();
    }
  });

  it("papel sem edição vê a mensagem de espera, sem convite para criar", async () => {
    instalaFetch({ views: [] });
    render(<TelaDeVendas role={SEM_EDICAO} products={PRODUCTS} />);
    const vazio = await screen.findByTestId("vendas-empty-state");
    expect(vazio).toHaveTextContent("Assim que alguém criar a primeira visualização");
    expect(vazio).not.toHaveTextContent("Crie a primeira visualização");
  });

  it("aviso de ciclos não migrados aparece para quem edita e não para quem só lê", async () => {
    const mock = { views: [makeView()], unmigrated: [{ id: "c1", name: "Ciclo A" }, { id: "c2", name: "Ciclo B" }] };
    instalaFetch(mock);
    const { unmount } = render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("vendas-unmigrated-notice")).toHaveTextContent(
      "2 ciclos antigos não foram migrados por falta de ofertas configuradas.",
    );
    unmount();

    instalaFetch({ ...mock, unmigrated: [{ id: "c1", name: "Ciclo A" }] });
    const { unmount: u2 } = render(<TelaDeVendas role="analista" products={PRODUCTS} />);
    expect(await screen.findByTestId("vendas-unmigrated-notice")).toHaveTextContent("1 ciclo antigo não foi migrado");
    u2();

    instalaFetch(mock);
    render(<TelaDeVendas role={SEM_EDICAO} products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");
    expect(screen.queryByTestId("vendas-unmigrated-notice")).not.toBeInTheDocument();
  });
});

describe("TelaDeVendas: lista e seleção", () => {
  it("abre a visualização mais recente por created_at", async () => {
    instalaFetch({
      views: [
        makeView({ id: "velha", name: "Velha", created_at: "2026-01-01T00:00:00Z" }),
        makeView({ id: "nova", name: "Nova", created_at: "2026-08-05T00:00:00Z" }),
      ],
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-selected-name")).toHaveTextContent("Nova");
    expect(screen.getByTestId("view-product")).toHaveTextContent("Produto Um");
  });

  it("agrupa por pasta, com 'Sem pasta' por último, e só o grupo da selecionada começa aberto", async () => {
    instalaFetch({
      views: [
        makeView({ id: "a", name: "Solta", created_at: "2026-08-05T00:00:00Z" }),
        makeView({ id: "b", name: "Da pasta", folder_id: "f1", created_at: "2026-08-01T00:00:00Z" }),
      ],
      folders: [PASTA],
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");

    const secoes = screen.getAllByTestId(/^folder-section-/);
    expect(secoes.map((s) => s.getAttribute("data-testid"))).toEqual(["folder-section-f1", "folder-section-unfoldered"]);
    expect(screen.getByTestId("folder-toggle-btn-unfoldered")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("folder-toggle-btn-f1")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("vendas-view-option-b")).not.toBeInTheDocument();
  });

  it("trocar de visualização muda o dashboard e marca só a escolhida", async () => {
    instalaFetch({
      views: [
        makeView({ id: "a", name: "Primeira", created_at: "2026-08-05T00:00:00Z" }),
        makeView({ id: "b", name: "Segunda", created_at: "2026-08-01T00:00:00Z" }),
      ],
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-selected-name")).toHaveTextContent("Primeira");

    fireEvent.click(screen.getByTestId("vendas-view-option-b"));
    expect(screen.getByTestId("view-selected-name")).toHaveTextContent("Segunda");
    expect(screen.getByTestId("vendas-view-option-b")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("vendas-view-option-a")).toHaveAttribute("aria-pressed", "false");
  });

  it("abrir uma pasta fechada mostra as visualizações dela", async () => {
    instalaFetch({
      views: [
        makeView({ id: "a", name: "Solta", created_at: "2026-08-05T00:00:00Z" }),
        makeView({ id: "b", name: "Da pasta", folder_id: "f1", created_at: "2026-08-01T00:00:00Z" }),
      ],
      folders: [PASTA],
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");

    fireEvent.click(screen.getByTestId("folder-toggle-btn-f1"));
    expect(screen.getByTestId("vendas-view-option-b")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("folder-toggle-btn-f1"));
    expect(screen.queryByTestId("vendas-view-option-b")).not.toBeInTheDocument();
  });
});

describe("TelaDeVendas: erro e coleta", () => {
  it("falha na lista mostra o erro e 'Tentar novamente' relê", async () => {
    const calls = instalaFetch({ views: [], viewsStatus: 500 });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByText("Falha ao carregar os dados.")).toBeInTheDocument();

    const antes = calls.filter((c) => c.url === "/api/vendas/views").length;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/vendas/views").length).toBe(antes + 1));
  });

  it("enquanto a coleta roda, relê a visualização a cada 5 s", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask"] });
    const calls = instalaFetch({
      views: [makeView({ backfill_status: "running" })],
      overrides: { "GET /api/vendas/views/v1": { body: { view: makeView({ backfill_status: "done" }) } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");
    await React.act(async () => {
      jest.advanceTimersByTime(4900);
    });
    expect(calls.some((c) => c.url === "/api/vendas/views/v1")).toBe(false);

    await React.act(async () => {
      jest.advanceTimersByTime(200);
    });
    await waitFor(() => expect(calls.some((c) => c.method === "GET" && c.url === "/api/vendas/views/v1")).toBe(true));

    // Concluída, o polling para.
    const lidas = calls.filter((c) => c.url === "/api/vendas/views/v1").length;
    await React.act(async () => {
      jest.advanceTimersByTime(15000);
    });
    expect(calls.filter((c) => c.url === "/api/vendas/views/v1").length).toBe(lidas);
  });

  it("coleta concluída não faz polling", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask"] });
    const calls = instalaFetch({ views: [makeView({ backfill_status: "done" })] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");
    await React.act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(calls.some((c) => c.url === "/api/vendas/views/v1")).toBe(false);
  });
});
