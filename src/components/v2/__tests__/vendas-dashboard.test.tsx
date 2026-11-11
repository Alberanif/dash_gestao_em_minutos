/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TelaDeVendas } from "../vendas/tela-de-vendas";
import type { UserRole } from "@/types/auth";
import { PRODUCTS, makeView, instalaFetch } from "./vendas-helpers";

const SEM_EDICAO = "leitor" as unknown as UserRole;

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("Dashboard: cabeçalho e permissões", () => {
  it("mostra produto e número de ofertas, no singular e no plural", async () => {
    instalaFetch({ views: [makeView({ offer_codes: ["OF-1"] })] });
    const { unmount } = render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-product")).toHaveTextContent("Produto Um, 1 oferta");
    unmount();

    instalaFetch({ views: [makeView()] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-product")).toHaveTextContent("Produto Um, 2 ofertas");
  });

  it("gestor e analista veem editar período e Atualizar agora", async () => {
    for (const role of ["gestor", "analista"] as const) {
      instalaFetch({ views: [makeView()] });
      const { unmount } = render(<TelaDeVendas role={role} products={PRODUCTS} />);
      await screen.findByTestId("view-dashboard");
      expect(screen.getByTestId("vendas-date-apply")).toBeInTheDocument();
      expect(screen.getByTestId("vendas-refresh-btn")).toBeInTheDocument();
      expect(screen.queryByTestId("vendas-date-readonly")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("papel sem edição vê o período salvo só como texto e não consegue alterá-lo", async () => {
    instalaFetch({ views: [makeView({ view_start_date: "2026-08-01", view_end_date: "2026-08-10" })] });
    render(<TelaDeVendas role={SEM_EDICAO} products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");
    expect(screen.getByTestId("vendas-date-readonly")).toHaveTextContent("01/08/2026 – 10/08/2026");
    expect(screen.queryByTestId("vendas-date-apply")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vendas-date-start")).not.toBeInTheDocument();
  });
});

describe("Dashboard: números", () => {
  it("KPI de vendas e de reembolsadas vêm da API, sem alerta quando os totais batem", async () => {
    instalaFetch({ views: [makeView()] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales-value")).toHaveTextContent("7");
    expect(screen.getByTestId("view-kpi-refunded-value")).toHaveTextContent("2");
    expect(screen.queryByTestId("view-totals-mismatch")).not.toBeInTheDocument();
  });

  it("o âmbar marca só o número de Vendas; Reembolsadas fica em tom neutro", async () => {
    instalaFetch({ views: [makeView()] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales-value")).toHaveClass("text-v2-ponto");
    expect(screen.getByTestId("view-kpi-refunded").innerHTML).not.toContain("v2-ponto");
  });

  it("avisa quando KPI, dia e oferta divergem", async () => {
    instalaFetch({ views: [makeView()], kpis: { sales: 9, refunded: 0 } });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-totals-mismatch")).toHaveTextContent("KPI 9");
  });

  it("indicador de reembolsadas explica o reembolso retroativo", async () => {
    instalaFetch({ views: [makeView()] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-refunded");
    expect(screen.queryByTestId("view-refunded-help")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-refunded-help-btn"));
    expect(screen.getByTestId("view-refunded-help")).toHaveTextContent("retroativo");
    expect(screen.getByTestId("view-refunded-help-btn")).toHaveAttribute("aria-expanded", "true");
  });

  it("usa as quatro rotas de dados, sem período quando a visualização não tem", async () => {
    const calls = instalaFetch({ views: [makeView()] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    for (const rota of ["kpis", "daily", "offers", "hourly"]) {
      expect(calls.some((c) => c.method === "GET" && c.url === `/api/vendas/views/v1/${rota}`)).toBe(true);
    }
  });

  it("período salvo vai nas rotas de dados como start/end", async () => {
    const calls = instalaFetch({ views: [makeView({ view_start_date: "2026-08-01", view_end_date: "2026-08-10" })] });
    render(<TelaDeVendas role="analista" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    for (const rota of ["kpis", "daily", "offers", "hourly"]) {
      expect(calls.some((c) => c.url === `/api/vendas/views/v1/${rota}?start=2026-08-01&end=2026-08-10`)).toBe(true);
    }
  });

  it("sem /hourly a visualização funciona", async () => {
    instalaFetch({
      views: [makeView()],
      overrides: { "GET /api/vendas/views/v1/hourly": { status: 500, body: { error: "x" } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-kpi-sales-value")).toHaveTextContent("7");
    expect(screen.queryByTestId("view-load-error")).not.toBeInTheDocument();
  });

  it("falha nos números mostra o erro e 'Tentar novamente' relê", async () => {
    const calls = instalaFetch({
      views: [makeView()],
      overrides: { "GET /api/vendas/views/v1/kpis": { status: 500, body: { error: "x" } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    const erro = await screen.findByTestId("view-load-error");
    expect(erro).toHaveTextContent("Falha ao carregar os números.");
    const antes = calls.filter((c) => c.url.endsWith("/kpis")).length;
    fireEvent.click(erro.querySelector("button")!);
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/kpis")).length).toBe(antes + 1));
  });

  it("enquanto os números não chegam mostra o esqueleto e sem KPI", async () => {
    instalaFetch({ views: [makeView()] });
    const base = global.fetch;
    let liberar: () => void = () => {};
    const trava = new Promise<void>((r) => (liberar = r));
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/kpis")) await trava;
      return base(url, init);
    }) as unknown as typeof global.fetch;

    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("view-kpi-sales")).not.toBeInTheDocument();
    liberar();
    await screen.findByTestId("view-kpi-sales");
    expect(screen.queryByTestId("view-loading")).not.toBeInTheDocument();
  });

  it("gestor salva o período por PATCH e os números são relidos com ele", async () => {
    const atualizada = makeView({ view_start_date: "2026-08-01", view_end_date: "2026-08-05" });
    const calls = instalaFetch({
      views: [makeView()],
      overrides: { "PATCH /api/vendas/views/v1": { body: { view: atualizada } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    fireEvent.change(screen.getByTestId("vendas-date-start"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByTestId("vendas-date-end"), { target: { value: "2026-08-05" } });
    fireEvent.click(screen.getByTestId("vendas-date-apply"));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        view_start_date: "2026-08-01",
        view_end_date: "2026-08-05",
      }),
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes("kpis?start=2026-08-01&end=2026-08-05"))).toBe(true));
  });

  it("Atualizar agora com sucesso recarrega os números", async () => {
    const calls = instalaFetch({
      views: [makeView()],
      overrides: {
        "POST /api/vendas/views/v1/refresh": { body: { upserted: 3, lastRefreshAt: "2026-08-03T10:00:00Z" } },
      },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-kpi-sales");
    const antes = calls.filter((c) => c.url.endsWith("/kpis")).length;
    fireEvent.click(screen.getByTestId("vendas-refresh-btn"));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/kpis")).length).toBe(antes + 1));
  });
});

describe("Dashboard: estados da coleta", () => {
  it("done: histórico completo, sem selo de incompleto", async () => {
    instalaFetch({ views: [makeView({ backfill_status: "done" })] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-backfill-notice")).toHaveAttribute("data-backfill-status", "done");
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales")).not.toHaveTextContent(/parcial|Coletando|falhou/);
  });

  it("running: 'Coletando histórico…' e o KPI não se apresenta como completo", async () => {
    instalaFetch({ views: [makeView({ backfill_status: "running" })] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-backfill-notice")).toHaveTextContent("Coletando histórico…");
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales")).toHaveTextContent("Coletando histórico…");
  });

  it("partial: mostra a data inicial e marca o KPI como parcial", async () => {
    instalaFetch({ views: [makeView({ backfill_status: "partial", backfill_from: "2026-07-01" })] });
    render(<TelaDeVendas role="analista" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-backfill-notice")).toHaveTextContent("a partir de 01/07/2026");
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales")).toHaveTextContent("Histórico parcial");
  });

  it("failed: mensagem de falha, KPI marcado e 'Tentar novamente' dispara o refresh da visualização", async () => {
    const calls = instalaFetch({
      views: [makeView({ backfill_status: "failed" })],
      overrides: {
        "POST /api/vendas/views/v1/refresh": { body: { view: makeView({ backfill_status: "running" }) } },
      },
    });
    render(<TelaDeVendas role="analista" products={PRODUCTS} />);
    expect(await screen.findByTestId("view-backfill-notice")).toHaveTextContent("Não foi possível coletar o histórico");
    await screen.findByTestId("view-kpi-sales");
    expect(screen.getByTestId("view-kpi-sales")).toHaveTextContent("Coleta falhou");
    fireEvent.click(screen.getByTestId("view-backfill-retry"));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.url === "/api/vendas/views/v1/refresh")).toBe(true),
    );
  });

  it("falha do retry (409) mostra o erro do servidor", async () => {
    instalaFetch({
      views: [makeView({ backfill_status: "failed" })],
      overrides: {
        "POST /api/vendas/views/v1/refresh": { status: 409, body: { error: "Atualização já em andamento." } },
      },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("view-backfill-retry"));
    expect(await screen.findByTestId("view-backfill-retry-error")).toHaveTextContent("Atualização já em andamento.");
  });

  it("done e running não oferecem 'Tentar novamente'", async () => {
    instalaFetch({ views: [makeView({ backfill_status: "running" })] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await screen.findByTestId("view-backfill-notice");
    expect(screen.queryByTestId("view-backfill-retry")).not.toBeInTheDocument();
  });
});
