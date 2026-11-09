/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DebriefingProduct, FilterRecord } from "@/types/indicadores";
import type { DebriefingMetrics } from "@/lib/indicadores/service/debriefing";
import { ProvedorEvento } from "../evento/contexto";
import { ControlesDoEvento } from "../evento/controles";
import { CorpoDoEvento } from "../evento/corpo-do-evento";
import { mockReducedMotion } from "./helpers";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
// O import dinâmico vira o componente real, para testar a visão de ponta a ponta.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => require("../evento/debriefing/tela-debriefing").TelaDebriefing,
}));

const HOJE = "2026-07-28";
const PERIODO = { startDate: "2026-07-01", endDate: "2026-07-07", preset: null };
const PRODUTO: DebriefingProduct = { product_id: "p1", product_name: "Produto A", offer_codes: ["o1"] };

function filtro(debriefing_products: DebriefingProduct[] | null): FilterRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    account_id: "acc",
    name: "Imersão",
    hotmart_products: [],
    meta_ads_terms: [],
    captacao_leads_eventos: [],
    is_organic: false,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    debriefing_products,
  } as unknown as FilterRecord;
}

const metricas = (vendas: number): DebriefingMetrics => ({
  totals: { total_sales: vendas, total_sales_brl: vendas, total_sales_foreign: 0, total_revenue_brl: vendas * 100 },
  daily_series: [],
  products: [],
});

const resposta = (corpo: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(corpo) } as Response);

let fetchMock: jest.Mock;
const chamadasDebriefing = () =>
  fetchMock.mock.calls.filter((c) => String(c[0]).startsWith("/api/indicadores/debriefing"));

function montar(f: FilterRecord, visaoInicial: "dashboard" | "debriefing" = "debriefing") {
  return render(
    <ProvedorEvento filter={f} filters={[f]} periodoInicial={PERIODO} hoje={HOJE} visaoInicial={visaoInicial}>
      <ControlesDoEvento />
      <CorpoDoEvento dashboard={<p>blocos</p>} />
    </ProvedorEvento>,
  );
}

/** Respostas sucessivas do Debriefing; o status do "Atualizar Agora" não consome a fila. */
function fila(...respostas: Array<() => Promise<Response>>) {
  const resto = [...respostas];
  fetchMock.mockImplementation((url: string) => {
    if (!url.startsWith("/api/indicadores/debriefing")) return resposta({});
    return (resto.length > 1 ? resto.shift()! : resto[0])();
  });
}

beforeEach(() => {
  mockReducedMotion(true);
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  window.history.replaceState(null, "", "/v2/indicadores/x");
});

describe("use-debriefing: consulta", () => {
  it("não consulta a API com a visão Dashboard", async () => {
    fetchMock.mockImplementation(() => resposta({}));
    montar(filtro([PRODUTO]), "dashboard");
    await act(async () => {});
    expect(chamadasDebriefing()).toHaveLength(0);
  });

  it("consulta ao abrir o Debriefing, com products em JSON e as datas do período", async () => {
    fetchMock.mockImplementation(() => resposta(metricas(3)));
    montar(filtro([PRODUTO]), "dashboard");
    fireEvent.click(screen.getByRole("tab", { name: "Debriefing" }));
    await waitFor(() => expect(chamadasDebriefing()).toHaveLength(1));
    const url = new URL(chamadasDebriefing()[0][0] as string, "http://x");
    expect(url.searchParams.get("start_date")).toBe("2026-07-01");
    expect(url.searchParams.get("end_date")).toBe("2026-07-07");
    expect(JSON.parse(url.searchParams.get("products")!)).toEqual([
      { product_id: "p1", product_name: "Produto A", offer_codes: ["o1"] },
    ]);
  });

  it("voltar para o Debriefing com a mesma chave não refaz a consulta", async () => {
    fetchMock.mockImplementation(() => resposta(metricas(3)));
    montar(filtro([PRODUTO]));
    await screen.findByTestId("debriefing-conteudo");
    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));
    fireEvent.click(screen.getByRole("tab", { name: "Debriefing" }));
    await screen.findByTestId("debriefing-conteudo");
    expect(chamadasDebriefing()).toHaveLength(1);
  });

  it("trocar o período mantém o dado anterior (esmaecido) até o novo chegar", async () => {
    let liberar!: (v: Response) => void;
    fila(
      () => resposta(metricas(3)),
      () => new Promise<Response>((r) => (liberar = r)),
    );
    montar(filtro([PRODUTO]));
    await screen.findByTestId("debriefing-conteudo");
    fireEvent.click(screen.getByRole("tab", { name: "7 dias" }));
    await waitFor(() => expect(chamadasDebriefing()).toHaveLength(2));
    expect(screen.getByTestId("debriefing-conteudo")).toBeTruthy();
    expect(screen.queryByTestId("debriefing-carregando")).toBeNull();
    expect(screen.getByTestId("debriefing-conteudo").parentElement?.className).toContain("opacity-50");
    await act(async () => liberar({ ok: true, status: 200, json: () => Promise.resolve(metricas(5)) } as Response));
    await waitFor(() =>
      expect(screen.getByTestId("debriefing-conteudo").parentElement?.className).not.toContain("opacity-50"),
    );
  });
});

describe("TelaDebriefing: estados", () => {
  it("carregando mostra o esqueleto", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    montar(filtro([PRODUTO]));
    expect(screen.getByTestId("debriefing-carregando")).toBeTruthy();
  });

  it("erro mostra a mensagem e 'Tentar de novo' refaz a consulta", async () => {
    fila(
      () => resposta({ error: "x" }, false),
      () => resposta(metricas(2)),
    );
    montar(filtro([PRODUTO]));
    expect(await screen.findByText("Não foi possível carregar as vendas.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Debriefing" })).toBeTruthy(); // herói segue utilizável
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByTestId("debriefing-conteudo");
    expect(chamadasDebriefing()).toHaveLength(2);
  });

  it("período sem vendas", async () => {
    fetchMock.mockImplementation(() => resposta(metricas(0)));
    montar(filtro([PRODUTO]));
    expect(
      await screen.findByText("Nenhuma venda de Produto A entre 01/07 e 07/07. Tente um período maior."),
    ).toBeTruthy();
  });

  it("sem produto principal: mensagem, link para a lista de eventos e nenhuma consulta", async () => {
    fetchMock.mockImplementation(() => resposta({}));
    montar(filtro([]));
    expect(screen.getByText("Este evento ainda não tem produto principal.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Configurar produto principal" });
    expect(link.getAttribute("href")).toBe("/v2/indicadores/eventos");
    await act(async () => {});
    expect(chamadasDebriefing()).toHaveLength(0);
  });

  it("produto legado (main_hotmart_product) vale via resolveDebriefingProducts", async () => {
    fetchMock.mockImplementation(() => resposta(metricas(1)));
    const f = {
      ...filtro(null),
      main_hotmart_product: { product_id: "p9", product_name: "Legado" },
      debriefing_offer_codes: ["z"],
    } as FilterRecord;
    montar(f);
    await screen.findByTestId("debriefing-conteudo");
    const url = new URL(chamadasDebriefing()[0][0] as string, "http://x");
    expect(JSON.parse(url.searchParams.get("products")!)[0]).toMatchObject({ product_id: "p9", offer_codes: ["z"] });
  });
});
