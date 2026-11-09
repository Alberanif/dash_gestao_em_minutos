/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { FilterRecord } from "@/types/indicadores";
import type { DebriefingMetrics } from "@/lib/indicadores/service/debriefing";
import { DebriefingView } from "@/components/indicadores/debriefing-view";
import { ProvedorEvento } from "../evento/contexto";
import { CorpoDoEvento } from "../evento/corpo-do-evento";
import { mockReducedMotion } from "./helpers";

/**
 * Paridade V1 x V2: com o MESMO fixture (vendas, BRL, moeda estrangeira, série diária, ofertas),
 * os números que a V2 mostra são os que a V1 mostra. A V1 é renderizada de verdade; o que ela
 * entrega ao gráfico (recharts) é capturado, porque o SVG não renderiza em jsdom.
 */

const dadosV1: { date: string; vendas: number; receita: number }[][] = [];
jest.mock("recharts", () => {
  const Null = () => null;
  return {
    ComposedChart: ({ data }: { data: { date: string; vendas: number; receita: number }[] }) => {
      dadosV1.push(data);
      return null;
    },
    Bar: Null,
    Line: Null,
    XAxis: Null,
    YAxis: Null,
    Tooltip: Null,
    CartesianGrid: Null,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: { toString(): string }) =>
    String(loader).includes("tela-debriefing")
      ? require("../evento/debriefing/tela-debriefing").TelaDebriefing
      : () => null,
}));
jest.mock("../evento/charts-lazy", () => {
  const c = jest.requireActual("../charts");
  return { LineChartLazy: c.LineChart, BarChartDiarioLazy: c.BarChartDiario };
});

const sp = (s: string) => s.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const brl = (n: number) =>
  sp(Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
const num = (n: number) => sp(Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n));

const PRODUTOS = [
  { product_id: "111", product_name: "Produto A", offer_codes: [] },
  { product_id: "222", product_name: "Produto B", offer_codes: [] },
];
const pt = (date: string, brlN: number, foreign: number, revenue: number) => ({
  date,
  sales_count: brlN + foreign,
  sales_brl: brlN,
  sales_foreign: foreign,
  revenue,
});
const METRICAS: DebriefingMetrics = {
  totals: { total_sales: 20, total_sales_brl: 17, total_sales_foreign: 3, total_revenue_brl: 4321.5 },
  daily_series: [pt("2026-01-01", 4, 1, 1200.25), pt("2026-01-02", 6, 0, 1500), pt("2026-01-03", 7, 2, 1621.25)],
  products: [
    {
      product_id: "111",
      product_name: "Produto A",
      total_sales: 8,
      total_sales_brl: 7,
      total_sales_foreign: 1,
      total_revenue_brl: 1700.75,
      offers_breakdown: [
        { offer_code: "oa1", offer_name: "Oferta A1", sales_count: 5, revenue: 1000.25 },
        { offer_code: "oa2", offer_name: "Oferta A2", sales_count: 3, revenue: 700.5 },
      ],
      daily_series: [pt("2026-01-01", 3, 1, 900.25), pt("2026-01-02", 4, 0, 800.5)],
    },
    {
      product_id: "222",
      product_name: "Produto B",
      total_sales: 12,
      total_sales_brl: 10,
      total_sales_foreign: 2,
      total_revenue_brl: 2620.75,
      offers_breakdown: [{ offer_code: "ob1", offer_name: "Oferta B1", sales_count: 12, revenue: 2620.75 }],
      daily_series: [pt("2026-01-01", 1, 0, 300), pt("2026-01-02", 2, 0, 700), pt("2026-01-03", 7, 2, 1620.75)],
    },
  ],
};

const FILTRO = {
  id: "11111111-1111-4111-8111-111111111111",
  account_id: "acc",
  name: "Imersão",
  hotmart_products: [],
  meta_ads_terms: [],
  captacao_leads_eventos: [],
  is_organic: false,
  status: "ativo",
  status_changed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  debriefing_products: PRODUTOS,
} as unknown as FilterRecord;

beforeEach(() => {
  mockReducedMotion(true);
  dadosV1.length = 0;
  window.history.replaceState(null, "", "/v2/indicadores/x");
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => METRICAS })) as unknown as typeof fetch;
});
afterEach(cleanup);

/** "01/01/2026 | 1.200,25" -> 1200.25 (a tabela alternativa do gráfico usa pt-BR). */
const valorDaCelula = (linha: string) => Number(linha.split(" | ")[1].replace(/\./g, "").replace(",", "."));

/** Números da V1 para o recorte atual. */
async function lerV1(clicar: string[]) {
  render(<DebriefingView filter={FILTRO} startDate="2026-01-01" endDate="2026-01-31" />);
  await waitFor(() => expect(screen.getByText("Total de Vendas")).toBeTruthy());
  if (clicar.length) {
    fireEvent.click(screen.getByRole("button", { name: /Produtos · / }));
    for (const nome of clicar) fireEvent.click(screen.getByRole("button", { name: nome }));
  }
  const kpi = (rotulo: string) => sp(screen.getByText(rotulo).parentElement!.children[1].textContent ?? "");
  const grupos = Array.from(document.querySelectorAll('[data-testid^="debriefing-group-"]')).map((g) => {
    const linhas = Array.from(g.querySelectorAll("tr")).map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent ?? ""));
    const [sub, ...ofertas] = linhas;
    return {
      id: g.getAttribute("data-testid")!.replace("debriefing-group-", ""),
      vendas: sp(sub[1]),
      faturamento: sp(sub[2]),
      ofertas: ofertas.map((o) => ({ nome: sp(o[0]).replace(/\s*\(.*\)$/, ""), vendas: sp(o[1]), faturamento: sp(o[2]) })),
    };
  });
  const serie = dadosV1[dadosV1.length - 1].map((d) => ({ dia: d.date, vendas: d.vendas, receita: d.receita }));
  const lido = {
    vendas: kpi("Total de Vendas"),
    faturamento: kpi("Faturamento Total (R$)"),
    estrangeira: kpi("Vendas Moeda Estrangeira"),
    sub: sp(screen.getByText("Total de Vendas").parentElement!.children[2].textContent ?? ""),
    grupos,
    serie,
  };
  cleanup();
  return lido;
}

/** Números da V2 para o recorte atual. */
async function lerV2(clicar: string[]) {
  render(
    <ProvedorEvento
      filter={FILTRO}
      filters={[FILTRO]}
      periodoInicial={{ startDate: "2026-01-01", endDate: "2026-01-31", preset: null }}
      hoje="2026-01-31"
      visaoInicial="debriefing"
    >
      <CorpoDoEvento dashboard={<p>blocos</p>} />
    </ProvedorEvento>,
  );
  await screen.findByTestId("debriefing-faturamento");
  for (const nome of clicar) fireEvent.click(screen.getByRole("button", { name: nome }));
  const blocos = screen.getAllByTestId("bloco-produto").map((b) => {
    const linhas = Array.from(b.querySelectorAll("table tbody tr")).map((tr) => ({
      nome: sp(tr.querySelector("th")!.textContent ?? ""),
      vendas: sp(tr.querySelectorAll("td")[0].textContent ?? ""),
      faturamento: sp(tr.querySelectorAll("td")[1].textContent ?? ""),
    }));
    return { titulo: b.querySelector("h3")?.textContent ?? null, totais: sp(b.querySelector('[data-testid="produto-totais"]')?.textContent ?? ""), ofertas: linhas };
  });
  // Série diária: percorre os dias pelo teclado e lê o painel de leitura.
  const linhaGrafico = screen.getAllByRole("group").find((g) => g.getAttribute("aria-label") !== "Produtos")!;
  const serie: { dia: string; texto: string }[] = [];
  fireEvent.keyDown(linhaGrafico, { key: "Home" });
  for (;;) {
    const t = sp(screen.getByTestId("leitura-dia").textContent ?? "");
    serie.push({ dia: t.slice(0, 5), texto: t });
    const antes = t;
    fireEvent.keyDown(linhaGrafico, { key: "ArrowRight" });
    if (sp(screen.getByTestId("leitura-dia").textContent ?? "") === antes) break;
  }
  // O que os gráficos desenham (tabelas alternativas): faturamento por dia e vendas por dia.
  const [tabLinha, tabBarras] = Array.from(document.querySelectorAll("table")).filter((t) => t.querySelector("th[scope=col]")?.textContent !== "Oferta");
  const celulas = (t: Element) => Array.from(t.querySelectorAll("tbody tr")).map((tr) => Array.from(tr.querySelectorAll("th,td")).map((c) => sp(c.textContent ?? "")).join(" | "));
  const graficos = { linha: celulas(tabLinha), barras: celulas(tabBarras) };
  const lido = {
    graficos,
    vendas: sp(screen.getByTestId("debriefing-total-vendas").textContent ?? ""),
    faturamento: sp(screen.getByTestId("debriefing-faturamento").textContent ?? ""),
    estrangeira: sp(screen.getByTestId("debriefing-moeda-estrangeira").textContent ?? ""),
    sub: sp(within(screen.getByRole("region", { name: "Resultado" })).getByText(/em reais/).textContent ?? ""),
    blocos,
    serie,
  };
  cleanup();
  return lido;
}

describe("paridade V1 x V2 (mesmo fixture)", () => {
  it.each([
    ["Todos os produtos", [] as string[], ["111", "222"]],
    ["só o Produto B (chip)", ["Produto B"], ["222"]],
  ])("%s: vendas, BRL, moeda estrangeira, série diária e ofertas", async (_t, clicar, ids) => {
    const v1 = await lerV1(clicar);
    const v2 = await lerV2(clicar);

    // Vendas, faturamento em BRL e moeda estrangeira.
    expect(v2.vendas).toBe(v1.vendas);
    expect(v2.faturamento).toBe(v1.faturamento);
    expect(v2.estrangeira).toBe(v1.estrangeira);
    // Quebra BRL x estrangeira (a V1 mostra "N vendas em BRL | M em moeda estrangeira").
    const [vBrl, vEst] = (v1.sub.match(/\d+/g) ?? []).map(Number);
    expect(v2.sub).toBe(`${num(vBrl)} em reais, ${num(vEst)} em moeda estrangeira`);

    // Ofertas e subtotais, produto a produto, na mesma ordem.
    expect(v2.blocos).toHaveLength(ids.length);
    expect(v1.grupos.map((g) => g.id)).toEqual(ids);
    v1.grupos.forEach((g, i) => {
      // Com um produto só a V2 não repete o cabeçalho (os totais são os do Resultado, já comparados acima).
      if (ids.length > 1) expect(v2.blocos[i].totais).toBe(`${g.vendas} ${g.vendas === "1" ? "venda" : "vendas"} · ${g.faturamento}`);
      expect(v2.blocos[i].ofertas).toEqual(g.ofertas);
    });

    // Série diária: mesmos dias, mesmas vendas, mesmo faturamento.
    expect(v2.serie.map((s) => s.dia)).toEqual(v1.serie.map((s) => s.dia));
    v1.serie.forEach((d, i) => {
      expect(v2.serie[i].texto).toBe(`${d.dia} · ${num(d.vendas)} ${d.vendas === 1 ? "venda" : "vendas"} · ${brl(d.receita)}`);
      // E o que os dois gráficos desenham é a mesma série (não só o painel de leitura).
      expect(valorDaCelula(v2.graficos.linha[i])).toBe(d.receita);
      expect(valorDaCelula(v2.graficos.barras[i])).toBe(d.vendas);
    });
  });

  it("o fixture exercita o que a paridade promete (guarda contra comparar vazio com vazio)", async () => {
    const v2 = await lerV2([]);
    expect(v2.estrangeira).toBe("3");
    expect(v2.serie).toHaveLength(3);
    expect(v2.blocos.flatMap((b) => b.ofertas)).toHaveLength(3);
    expect(v2.faturamento).toBe(brl(4321.5));
  });
});
