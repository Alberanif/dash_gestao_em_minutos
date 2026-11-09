/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { DebriefingProduct, FilterRecord } from "@/types/indicadores";
import type { DebriefingMetrics, DebriefingProductMetrics } from "@/lib/indicadores/service/debriefing";
import { selectDebriefingProducts } from "@/lib/indicadores/debriefing-selection";
import { ProvedorEvento } from "../evento/contexto";
import { ControlesDoEvento } from "../evento/controles";
import { CorpoDoEvento } from "../evento/corpo-do-evento";
import { Resultado } from "../evento/debriefing/resultado";
import { SeletorProdutos } from "../evento/debriefing/seletor-produtos";
import { mockReducedMotion } from "./helpers";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => require("../evento/debriefing/tela-debriefing").TelaDebriefing,
}));

// Formatação da V1 (debriefing-view.tsx), sem a troca de NBSP: a paridade é de número, não de espaço.
const v1BRL = (n: number) =>
  Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const v1Num = (n: number) => Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
const semEspecial = (s: string | null | undefined) => (s ?? "").replace(/[  ]/g, " ");

const A: DebriefingProduct = { product_id: "a", product_name: "Produto A", offer_codes: [] };
const B: DebriefingProduct = { product_id: "b", product_name: "Produto B", offer_codes: [] };

function produto(p: DebriefingProduct, brl: number, foreign: number, receita: number): DebriefingProductMetrics {
  return {
    product_id: p.product_id,
    product_name: p.product_name,
    total_sales: brl + foreign,
    total_sales_brl: brl,
    total_sales_foreign: foreign,
    total_revenue_brl: receita,
    offers_breakdown: [],
    daily_series: [{ date: "2026-07-02", sales_count: brl + foreign, sales_brl: brl, sales_foreign: foreign, revenue: receita }],
  };
}

const PA = produto(A, 812, 12, 121400.5);
const PB = produto(B, 355, 25, 62919.49);
const METRICAS: DebriefingMetrics = {
  totals: {
    total_sales: PA.total_sales + PB.total_sales,
    total_sales_brl: PA.total_sales_brl + PB.total_sales_brl,
    total_sales_foreign: PA.total_sales_foreign + PB.total_sales_foreign,
    total_revenue_brl: PA.total_revenue_brl + PB.total_revenue_brl,
  },
  daily_series: [],
  products: [PA, PB],
};

describe("Resultado", () => {
  it("mostra faturamento, vendas e moeda estrangeira com os números da V1", () => {
    render(<Resultado totais={METRICAS.totals} />);
    expect(semEspecial(screen.getByTestId("debriefing-faturamento").textContent)).toBe(semEspecial(v1BRL(METRICAS.totals.total_revenue_brl)));
    expect(semEspecial(screen.getByTestId("debriefing-total-vendas").textContent)).toBe(v1Num(METRICAS.totals.total_sales));
    expect(semEspecial(screen.getByTestId("debriefing-moeda-estrangeira").textContent)).toBe(v1Num(METRICAS.totals.total_sales_foreign));
    expect(screen.getByText("Faturamento total (R$)")).toBeTruthy();
    expect(screen.getByText("Total de vendas")).toBeTruthy();
    expect(screen.getByText("Vendas em moeda estrangeira")).toBeTruthy();
    expect(screen.getByText(`${v1Num(METRICAS.totals.total_sales_brl)} em reais, ${v1Num(METRICAS.totals.total_sales_foreign)} em moeda estrangeira`)).toBeTruthy();
  });

  it("o valor não carrega espaço não separável (cabe no celular)", () => {
    render(<Resultado totais={METRICAS.totals} />);
    expect(screen.getByTestId("debriefing-faturamento").textContent).not.toMatch(/[  ]/);
  });

  it("só o Faturamento usa o âmbar", () => {
    const { container } = render(<Resultado totais={METRICAS.totals} />);
    const ambar = Array.from(container.querySelectorAll("*")).filter((el) => /text-v2-ponto|bg-v2-ponto|ring-v2-ponto/.test(el.getAttribute("class") ?? ""));
    expect(ambar).toHaveLength(1);
    expect(ambar[0].getAttribute("data-testid")).toBe("debriefing-faturamento");
  });
});

describe("SeletorProdutos", () => {
  it("some com 1 produto", () => {
    const { container } = render(<SeletorProdutos produtos={[A]} selecionados={[]} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("vazio = Todos pressionado; chips com aria-pressed", () => {
    render(<SeletorProdutos produtos={[A, B]} selecionados={["b"]} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Produto A" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Produto B" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("clicar alterna via toggleProductSelection; marcar todos volta a vazio; Todos limpa", () => {
    const onChange = jest.fn();
    const { rerender } = render(<SeletorProdutos produtos={[A, B]} selecionados={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Produto A" }));
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
    rerender(<SeletorProdutos produtos={[A, B]} selecionados={["a"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Produto B" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Produto A" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("o âmbar só aparece nos chips selecionados", () => {
    render(<SeletorProdutos produtos={[A, B]} selecionados={["a"]} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Produto A" }).className).toMatch(/text-v2-ponto/);
    expect(screen.getByRole("button", { name: "Produto B" }).className).not.toMatch(/v2-ponto/);
    expect(screen.getByRole("button", { name: "Todos" }).className).not.toMatch(/v2-ponto/);
  });

  it("rola na horizontal no celular e quebra linha no desktop", () => {
    render(<SeletorProdutos produtos={[A, B]} selecionados={[]} onChange={() => {}} />);
    const grupo = screen.getByRole("group", { name: "Produtos" });
    expect(grupo.className).toMatch(/overflow-x-auto/);
    expect(grupo.className).toMatch(/@xl:flex-wrap/);
  });
});

describe("TelaDebriefing: chips e resultado", () => {
  const PERIODO = { startDate: "2026-07-01", endDate: "2026-07-07", preset: null };
  const filtro = {
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
    debriefing_products: [A, B],
  } as unknown as FilterRecord;

  beforeEach(() => {
    mockReducedMotion(true);
    window.history.replaceState(null, "", "/v2/indicadores/x");
    global.fetch = jest.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(String(url).startsWith("/api/indicadores/debriefing") ? METRICAS : {}),
      }),
    ) as unknown as typeof fetch;
  });

  function montar() {
    return render(
      <ProvedorEvento filter={filtro} filters={[filtro]} periodoInicial={PERIODO} hoje="2026-07-28" visaoInicial="debriefing">
        <ControlesDoEvento />
        <CorpoDoEvento dashboard={<p>blocos</p>} />
      </ProvedorEvento>,
    );
  }
  const faturamento = () => semEspecial(screen.getByTestId("debriefing-faturamento").textContent);

  it("Todos: totais de metrics.totals; chip selecionado: total do produto, idêntico ao recorte da V1", async () => {
    montar();
    await screen.findByTestId("debriefing-faturamento");
    expect(faturamento()).toBe(semEspecial(v1BRL(METRICAS.totals.total_revenue_brl)));

    fireEvent.click(screen.getByRole("button", { name: "Produto A" }));
    const so = selectDebriefingProducts(METRICAS, ["a"]).totals;
    expect(faturamento()).toBe(semEspecial(v1BRL(so.total_revenue_brl)));
    expect(semEspecial(screen.getByTestId("debriefing-total-vendas").textContent)).toBe(v1Num(so.total_sales));
    expect(semEspecial(screen.getByTestId("debriefing-moeda-estrangeira").textContent)).toBe(v1Num(so.total_sales_foreign));
    expect(screen.getByRole("button", { name: "Produto A" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("volta para Todos ao trocar o período", async () => {
    montar();
    await screen.findByTestId("debriefing-faturamento");
    fireEvent.click(screen.getByRole("button", { name: "Produto A" }));
    expect(screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("tab", { name: "28 dias" }));
    await screen.findByRole("button", { name: "Todos" });
    expect(screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Produto A" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("a página usa o formatador sem NBSP e o resultado respeita o fluxo de chips dentro do grupo", async () => {
    montar();
    await screen.findByTestId("debriefing-faturamento");
    expect(within(screen.getByRole("group", { name: "Produtos" })).getAllByRole("button")).toHaveLength(3);
  });
});

describe("guarda de fonte", () => {
  it("resultado.tsx e seletor não usam caixa-alta nem recharts", () => {
    for (const f of ["resultado.tsx", "seletor-produtos.tsx"]) {
      const src = readFileSync(join(__dirname, "../evento/debriefing", f), "utf8");
      expect(src).not.toMatch(/uppercase|recharts/);
    }
  });
});
