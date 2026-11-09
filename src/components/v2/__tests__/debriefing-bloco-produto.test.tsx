/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import type { DebriefingProductMetrics } from "@/lib/indicadores/service/debriefing";
import { BlocoProduto, BlocosProdutos } from "../evento/debriefing/bloco-produto";

const norm = (s: string | null) => (s ?? "").replace(/\s/g, " ");

function produto(extra: Partial<DebriefingProductMetrics> = {}): DebriefingProductMetrics {
  return {
    product_id: "p1",
    product_name: "Produto A",
    total_sales: 812,
    total_sales_brl: 800,
    total_sales_foreign: 12,
    total_revenue_brl: 121400,
    offers_breakdown: [
      { offer_code: "zzz", offer_name: "Oferta principal", sales_count: 640, revenue: 96000 },
      { offer_code: "aaa", offer_name: "Oferta promocional", sales_count: 172, revenue: 25400 },
    ],
    daily_series: [],
    ...extra,
  };
}

describe("BlocoProduto", () => {
  it("mostra nome, vendas e faturamento do produto no cabeçalho", () => {
    render(<BlocoProduto produto={produto()} />);
    expect(screen.getByRole("heading", { name: "Produto A" })).toBeTruthy();
    expect(norm(screen.getByTestId("produto-totais").textContent)).toBe("812 vendas · R$ 121.400,00");
  });

  it("preserva a ordem das ofertas recebida (não reordena)", () => {
    render(<BlocoProduto produto={produto()} />);
    const linhas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(linhas.map((l) => within(l).getAllByRole("rowheader")[0].textContent)).toEqual([
      "Oferta principal",
      "Oferta promocional",
    ]);
    expect(norm(linhas[0].textContent)).toContain("640");
    expect(norm(linhas[0].textContent)).toContain("R$ 96.000,00");
  });

  it("tabela tem th com escopo: colunas Oferta/Vendas/Faturamento e linha por oferta", () => {
    render(<BlocoProduto produto={produto()} />);
    const cols = screen.getAllByRole("columnheader");
    expect(cols.map((c) => c.textContent)).toEqual(["Oferta", "Vendas", "Faturamento"]);
    cols.forEach((c) => expect(c.getAttribute("scope")).toBe("col"));
    screen.getAllByRole("rowheader").forEach((r) => expect(r.getAttribute("scope")).toBe("row"));
    expect(screen.getByRole("table", { name: "Ofertas de Produto A" })).toBeTruthy();
  });

  it("no celular a mesma informação aparece como lista", () => {
    render(<BlocoProduto produto={produto()} />);
    const itens = within(screen.getByRole("list", { name: "Ofertas de Produto A" })).getAllByRole("listitem");
    expect(itens).toHaveLength(2);
    expect(norm(itens[1].textContent)).toBe("Oferta promocional172 vendas · R$ 25.400,00");
  });

  it("produto zerado continua aparecendo, com zeros", () => {
    render(
      <BlocoProduto
        produto={produto({ product_name: "Produto B", total_sales: 0, total_revenue_brl: 0, offers_breakdown: [] })}
      />,
    );
    expect(screen.getByRole("heading", { name: "Produto B" })).toBeTruthy();
    expect(norm(screen.getByTestId("produto-totais").textContent)).toBe("0 vendas · R$ 0,00");
    expect(screen.getByText("Nenhuma oferta com vendas no período.")).toBeTruthy();
  });

  it("oferta com zero vendas é mostrada zerada", () => {
    render(
      <BlocoProduto
        produto={produto({ offers_breakdown: [{ offer_code: "x", offer_name: "Sem vendas", sales_count: 0, revenue: 0 }] })}
      />,
    );
    expect(norm(within(screen.getByRole("table")).getAllByRole("row")[1].textContent)).toContain("R$ 0,00");
  });

  it("com um produto só, não repete o cabeçalho (mas mantém a tabela nomeada)", () => {
    render(<BlocosProdutos products={[produto()]} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByTestId("produto-totais")).toBeNull();
    expect(screen.getByRole("table", { name: "Ofertas de Produto A" })).toBeTruthy();
  });

  it("com vários produtos, um bloco por produto com cabeçalho, na ordem recebida", () => {
    render(
      <BlocosProdutos
        products={[produto(), produto({ product_id: "p2", product_name: "Produto B", total_sales: 3, total_revenue_brl: 30 })]}
      />,
    );
    expect(screen.getAllByTestId("bloco-produto")).toHaveLength(2);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Produto A", "Produto B"]);
    expect(norm(screen.getAllByTestId("produto-totais")[1].textContent)).toBe("3 vendas · R$ 30,00");
  });
});
