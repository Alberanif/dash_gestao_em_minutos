/** @jest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FilterRecord } from "@/types/indicadores";
import { ZERADO_HOTMART, ZERADO_LEADS, ZERADO_META, montarConsulta, type Fonte } from "@/lib/indicadores/dashboard-evento";
import { ProvedorEvento } from "../evento/contexto";
import { ControlesDoEvento } from "../evento/controles";
import { BlocoResultado } from "../evento/bloco-resultado";
import { BlocoJornada } from "../evento/bloco-jornada";
import { Segmentado } from "../evento/segmentado";
import { TabelaDados } from "../charts/parts";
import { mockReducedMotion } from "./helpers";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../evento/charts-lazy", () => ({
  LineChartLazy: () => null,
  BarChartLazy: () => null,
  DonutChartLazy: () => null,
}));

const HOJE = "2026-07-28";
const PERIODO = { startDate: "2026-07-01", endDate: "2026-07-28", preset: "28d" as const };

function filtro(extra: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    account_id: "acc",
    name: "Imersão",
    hotmart_products: [{ product_id: "p1", product_name: "P1" }],
    meta_ads_terms: ["PC"],
    captacao_leads_eventos: ["Evento A"],
    is_organic: false,
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...extra,
  };
}

const metaFonte = (f: FilterRecord, spend: number): Fonte<typeof ZERADO_META> => ({
  data: { ...ZERADO_META, meta_spend: spend, meta_leads: 10, meta_impressions: 1000, meta_link_clicks: 100, meta_page_views: 80 },
  chave: montarConsulta(f, PERIODO).chave,
});
const hotmartFonte = (f: FilterRecord, receita: number): Fonte<typeof ZERADO_HOTMART> => ({
  data: { ...ZERADO_HOTMART, total_sales: 2, total_revenue: receita },
  chave: montarConsulta(f, PERIODO).chave,
});

function resposta(corpo: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(corpo) } as Response);
}

function montar(f: FilterRecord, filhos: React.ReactNode) {
  return render(
    <ProvedorEvento filter={f} filters={[f]} periodoInicial={PERIODO} hoje={HOJE}>
      <ControlesDoEvento />
      {filhos}
    </ProvedorEvento>,
  );
}

let fetchMock: jest.Mock;
/** URLs das consultas de dados; a leitura do status do "Atualizar Agora" não conta. */
const urlsDeDados = () =>
  fetchMock.mock.calls.map((c) => c[0] as string).filter((u) => !u.startsWith("/api/indicadores/refresh"));
beforeEach(() => {
  mockReducedMotion(true);
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  window.history.replaceState(null, "", "/v2/indicadores/x");
});

describe("BlocoResultado", () => {
  it("mostra o dado do servidor sem consultar a rede", () => {
    const f = filtro();
    montar(f, <BlocoResultado meta={metaFonte(f, 200)} hotmart={hotmartFonte(f, 1000)} />);
    expect(screen.getByText("5,00×")).toBeTruthy();
    expect(screen.getByText("R$ 1.000,00")).toBeTruthy();
    expect(urlsDeDados()).toHaveLength(0);
  });

  it("trocar o período consulta as rotas atuais com as datas novas e mantém o dado antigo até chegar", async () => {
    const f = filtro();
    let liberar: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/indicadores/metrics")) return resposta({ ...ZERADO_META, meta_spend: 100 });
      return new Promise<Response>((resolve) => (liberar = resolve));
    });
    montar(f, <BlocoResultado meta={metaFonte(f, 200)} hotmart={hotmartFonte(f, 1000)} />);

    fireEvent.click(screen.getByRole("tab", { name: "7 dias" }));

    await waitFor(() => expect(urlsDeDados()).toHaveLength(2));
    const urls = urlsDeDados();
    expect(urls.every((u) => u.includes("start_date=2026-07-21") && u.includes("end_date=2026-07-28"))).toBe(true);
    expect(urls.some((u) => u.startsWith("/api/indicadores/hotmart"))).toBe(true);
    // Enquanto a Hotmart não responde, o dado anterior segue na tela, esmaecido.
    expect(screen.getByText("R$ 1.000,00")).toBeTruthy();
    expect(document.querySelector("[aria-busy=true]")).not.toBeNull();
    expect(document.querySelector("[aria-busy=true]")?.className).toContain("opacity-60");

    await act(async () => liberar({ ok: true, status: 200, json: () => Promise.resolve({ ...ZERADO_HOTMART, total_sales: 1, total_revenue: 500 }) } as Response));
    await waitFor(() => expect(screen.getByText("R$ 500,00")).toBeTruthy());
    expect(screen.getByText("5,00×")).toBeTruthy();
    expect(window.location.search).toContain("de=2026-07-21");
  });

  it("fonte não configurada não vai à rede e o ROAS aparece como traço", async () => {
    const f = filtro({ hotmart_products: [], captacao_leads_eventos: [] });
    fetchMock.mockImplementation(() => resposta({ ...ZERADO_META, meta_spend: 50 }));
    montar(f, <BlocoResultado />);
    await waitFor(() => expect(screen.getByText("Receita")).toBeTruthy());
    const urls = urlsDeDados();
    expect(urls.some((u) => u.startsWith("/api/indicadores/hotmart"))).toBe(false);
    expect(urls.some((u) => u.startsWith("/api/indicadores/metrics"))).toBe(true);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("erro de API mostra o aviso e permite tentar de novo", async () => {
    const f = filtro();
    fetchMock.mockImplementation(() => resposta({}, false));
    montar(f, <BlocoResultado />);
    expect(await screen.findByText("Não foi possível carregar este bloco.", {}, { timeout: 4000 })).toBeTruthy();
    fetchMock.mockImplementation((url: string) =>
      resposta(url.includes("hotmart") ? { ...ZERADO_HOTMART, total_sales: 3, total_revenue: 300 } : { ...ZERADO_META, meta_spend: 100 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(screen.getByText("R$ 300,00")).toBeTruthy());
  });

  it("primeira carga sem dado do servidor mostra esqueleto, não zero", () => {
    const f = filtro();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    montar(f, <BlocoResultado />);
    expect(screen.queryByText("R$ 0,00")).toBeNull();
    expect(screen.queryByText("Receita")).toBeNull();
  });
});

describe("BlocoJornada", () => {
  it("só aparece com Meta e Hotmart configurados", () => {
    const f = filtro({ meta_ads_terms: [] });
    const { container } = montar(f, <BlocoJornada />);
    expect(container.querySelector("#titulo-jornada")).toBeNull();
  });

  it("com as duas fontes mostra um card por etapa, e as taxas do V1 nas cordas, sem faixa de custos abaixo", () => {
    const f = filtro();
    const leads: Fonte<typeof ZERADO_LEADS> = { data: { ...ZERADO_LEADS, total: 8 }, chave: montarConsulta(f, PERIODO).chave };
    montar(f, <BlocoJornada meta={metaFonte(f, 200)} hotmart={hotmartFonte(f, 1000)} leads={leads} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Impressões")).toBeTruthy();
    expect(screen.getByText("Vendas aprovadas")).toBeTruthy();
    expect(screen.getByText(/^CTR:/)).toBeTruthy(); // a taxa mora na corda; o leitor de tela a ouve no card de chegada
    expect(screen.queryByText("CPA")).toBeNull();
  });
});

describe("Segmentado", () => {
  const opcoes = [
    { value: "a" as const, label: "A" },
    { value: "b" as const, label: "B" },
    { value: "c" as const, label: "C" },
  ];

  it("setas, Home e End movem o foco e a seleção, com volta nas pontas", () => {
    const onChange = jest.fn();
    render(<Segmentado rotulo="Teste" valor="a" onChange={onChange} opcoes={opcoes} />);
    const [a, , c] = screen.getAllByRole("tab");
    fireEvent.keyDown(a, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("c");
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("a");
    fireEvent.keyDown(a, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(c, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  it("só a aba marcada é focável por Tab; valor nulo deixa a primeira focável", () => {
    const { rerender } = render(<Segmentado rotulo="Teste" valor="b" onChange={() => {}} opcoes={opcoes} />);
    expect(screen.getAllByRole("tab").map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
    expect(screen.getByRole("tab", { name: "B" }).getAttribute("aria-selected")).toBe("true");
    rerender(<Segmentado rotulo="Teste" valor={null} onChange={() => {}} opcoes={opcoes} />);
    expect(screen.getAllByRole("tab").map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(screen.getAllByRole("tab").every((t) => t.getAttribute("aria-selected") === "false")).toBe(true);
  });
});

describe("ControlesDoEvento", () => {
  it("datas livres desmarcam o preset e gravam o período na URL", () => {
    const f = filtro();
    montar(f, null);
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-07-05" } });
    expect(screen.getByRole("tab", { name: "28 dias" }).getAttribute("data-state")).toBe("inactive");
    expect(window.location.search).toContain("de=2026-07-05");
  });

  it("não oferece seletor de evento: o dashboard é o que foi aberto", () => {
    montar(filtro(), null);
    expect(screen.queryByLabelText("Evento")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("início depois do fim é ignorado", () => {
    const f = filtro();
    montar(f, null);
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-08-30" } });
    expect(window.location.search).toBe("");
  });
});

describe("CamadaAnimada dos gráficos", () => {
  it("traz o próprio LazyMotion: sem provedor acima o m.g ficaria em opacity 0 e o gráfico, invisível", () => {
    const src = readFileSync(join(__dirname, "../charts/parts.tsx"), "utf8");
    expect(src).toMatch(/<LazyMotion features=\{domAnimation\}>/);
  });
});

describe("TabelaDados dos gráficos", () => {
  it("o sr-only fica no div, não na tabela (tabela com sr-only alarga a rolagem no celular)", () => {
    const { container } = render(<TabelaDados legenda="L" colunas={["a", "b"]} linhas={[["1", "2"]]} />);
    const tabela = container.querySelector("table")!;
    expect(tabela.className).not.toContain("sr-only");
    expect(tabela.parentElement?.className).toContain("sr-only");
  });
});
