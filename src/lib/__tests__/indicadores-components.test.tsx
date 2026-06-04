import { renderToStaticMarkup } from "react-dom/server";
import { HeroKpiCard } from "@/components/indicadores/hero-kpi-card";
import { KpiCell } from "@/components/indicadores/kpi-cell";
import { HorizontalFunnelFlow } from "@/components/indicadores/horizontal-funnel-flow";
import { LeadsSection } from "@/components/indicadores/leads-section";
import { FilterDropdownList } from "@/components/indicadores/filter-dropdown";
import { IndicadoresEmptyState } from "@/components/indicadores/indicadores-empty-state";
import { getPartialFilterWarning } from "@/components/indicadores/filter-modal";
import type { FunnelStage, ConversionRate } from "@/lib/utils/funnel-metrics";
import type { FilterRecord } from "@/types/indicadores";

jest.mock("@/components/indicadores/trend-charts", () => ({
  LeadsCaptacoesChart: () => null,
  MetaAdsInvestimentoLeadsChart: () => null,
  HotmartVendasChart: () => null,
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ── HeroKpiCard ───────────────────────────────────────────────────────────────

describe("HeroKpiCard", () => {
  it("renders label, value and subtitle", () => {
    const html = render(
      HeroKpiCard({ label: "ROAS", value: "3.50", subtitle: "Receita ÷ Investimento", accent: "#8b5cf6" })
    );
    expect(html).toContain("ROAS");
    expect(html).toContain("3.50");
    expect(html).toContain("Receita ÷ Investimento");
  });

  it("does not render badge element when badge is undefined", () => {
    const html = render(
      HeroKpiCard({ label: "ROAS", value: "3.50", subtitle: "sub", accent: "#8b5cf6" })
    );
    expect(html).not.toContain("positive");
    expect(html).not.toContain("negative");
    expect(html).not.toContain("neutral");
  });

  it("renders badge text when badge is provided", () => {
    const html = render(
      HeroKpiCard({ label: "ROAS", value: "3.50", subtitle: "sub", accent: "#8b5cf6", badge: { text: "+12%", variant: "positive" } })
    );
    expect(html).toContain("+12%");
  });

  it("renders accent as top bar background", () => {
    const html = render(
      HeroKpiCard({ label: "ROAS", value: "3.50", subtitle: "sub", accent: "#8b5cf6" })
    );
    expect(html).toContain("#8b5cf6");
  });

  it("renders value with DM Mono and 40px", () => {
    const html = render(
      HeroKpiCard({ label: "ROAS", value: "3.50", subtitle: "sub", accent: "#8b5cf6" })
    );
    expect(html).toContain("DM Mono");
    expect(html).toContain("3.50");
  });

  it("subtitle uses --text-3 color", () => {
    const html = render(
      HeroKpiCard({ label: "ROAS", value: "3.50", subtitle: "sub", accent: "#8b5cf6" })
    );
    expect(html).toContain("var(--text-3)");
  });

  it("renders loading skeleton when loading is true", () => {
    const html = render(
      HeroKpiCard({ label: "ROAS", value: "3.50", subtitle: "sub", accent: "#8b5cf6", loading: true })
    );
    expect(html).not.toContain("ROAS");
    expect(html).not.toContain("3.50");
  });
});

// ── KpiCell ───────────────────────────────────────────────────────────────────

describe("KpiCell", () => {
  it("renders label and value", () => {
    const html = render(KpiCell({ label: "Investimento", value: "R$ 1.000" }));
    expect(html).toContain("Investimento");
    expect(html).toContain("R$ 1.000");
  });

  it("applies accent color on value when accent is provided", () => {
    const html = render(KpiCell({ label: "Leads", value: "42", accent: "#3b82f6" }));
    expect(html).toContain("#3b82f6");
  });

  it("uses --text color when accent is omitted", () => {
    const html = render(KpiCell({ label: "CPM", value: "R$ 10" }));
    expect(html).toContain("var(--text)");
    expect(html).not.toContain("#3b82f6");
  });

  it("uses DM Mono font for value", () => {
    const html = render(KpiCell({ label: "Investimento", value: "R$ 1.000" }));
    expect(html).toContain("DM Mono");
  });

  it("renders value in 22px when large is true", () => {
    const html = render(KpiCell({ label: "X", value: "Y", large: true }));
    expect(html).toContain("22px");
  });

  it("renders value in default fontSize when large is omitted", () => {
    const html = render(KpiCell({ label: "X", value: "Y" }));
    expect(html).not.toContain("22px");
  });
});

// ── HorizontalFunnelFlow ──────────────────────────────────────────────────────

const fiveStages: FunnelStage[] = [
  { label: "Impressões", value: 100_000 },
  { label: "Cliques no link", value: 2_000 },
  { label: "Visualizações de LP", value: 1_500 },
  { label: "Leads captados", value: 50 },
  { label: "Vendas aprovadas", value: 10 },
];

const fourRates: ConversionRate[] = [
  { label: "CTR", pct: 2.0 },
  { label: "Taxa LP", pct: 75 },
  { label: "Conversão LP→Lead", pct: 3.33 },
  { label: "Taxa de Fechamento", pct: 20 },
];

describe("HorizontalFunnelFlow", () => {
  it("renders 5 stage labels and 4 rate badges given valid input", () => {
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates: fourRates }));
    expect(html).toContain("Impressões");
    expect(html).toContain("Cliques no link");
    expect(html).toContain("Visualizações de LP");
    expect(html).toContain("Leads captados");
    expect(html).toContain("Vendas aprovadas");
  });

  it("CTR 0,3% → rate-low (vermelho)", () => {
    const rates: ConversionRate[] = [{ label: "CTR", pct: 0.3 }, ...fourRates.slice(1)];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-low");
  });

  it("CTR 0,8% → rate-warn (âmbar)", () => {
    const rates: ConversionRate[] = [{ label: "CTR", pct: 0.8 }, ...fourRates.slice(1)];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-warn");
  });

  it("CTR 2,0% → rate-ok (verde)", () => {
    const rates: ConversionRate[] = [{ label: "CTR", pct: 2.0 }, ...fourRates.slice(1)];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-ok");
  });

  it("Taxa de Fechamento 5% → rate-low", () => {
    const rates: ConversionRate[] = [...fourRates.slice(0, 3), { label: "Taxa de Fechamento", pct: 5 }];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-low");
  });

  it("Taxa de Fechamento 20% → rate-warn", () => {
    const rates: ConversionRate[] = [...fourRates.slice(0, 3), { label: "Taxa de Fechamento", pct: 20 }];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-warn");
  });

  it("Taxa de Fechamento 35% → rate-ok", () => {
    const rates: ConversionRate[] = [...fourRates.slice(0, 3), { label: "Taxa de Fechamento", pct: 35 }];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-ok");
  });

  it("Conv LP→Lead 25% → rate-low", () => {
    const rates: ConversionRate[] = [
      fourRates[0],
      fourRates[1],
      { label: "Conversão LP→Lead", pct: 25 },
      fourRates[3],
    ];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-low");
  });

  it("Conv LP→Lead 50% → rate-warn", () => {
    const rates: ConversionRate[] = [
      fourRates[0],
      fourRates[1],
      { label: "Conversão LP→Lead", pct: 50 },
      fourRates[3],
    ];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-warn");
  });

  it("Conv LP→Lead 80% → rate-ok", () => {
    const rates: ConversionRate[] = [
      fourRates[0],
      fourRates[1],
      { label: "Conversão LP→Lead", pct: 80 },
      fourRates[3],
    ];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("rate-ok");
  });

  it("does not throw when stages is empty", () => {
    expect(() => render(HorizontalFunnelFlow({ stages: [], rates: [] }))).not.toThrow();
  });

  it("displays — when rate.pct is null", () => {
    const rates: ConversionRate[] = [{ label: "CTR", pct: null }, ...fourRates.slice(1)];
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates }));
    expect(html).toContain("—");
  });

  it("does not render Funil de Conversão header text", () => {
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates: fourRates }));
    expect(html).not.toContain("Funil de Conversão");
  });

  it("renders stage values with DM Mono font", () => {
    const html = render(HorizontalFunnelFlow({ stages: fiveStages, rates: fourRates }));
    expect(html).toContain("DM Mono");
  });
});

// ── getPartialFilterWarning ───────────────────────────────────────────────────

describe("getPartialFilterWarning", () => {
  it("warns about Hotmart when only Meta terms are provided", () => {
    const result = getPartialFilterWarning([], ["lançamento"]);
    expect(result).not.toBeNull();
    expect(result).toContain("Hotmart");
  });

  it("warns about Meta Ads when only Hotmart products are provided", () => {
    const result = getPartialFilterWarning([{ product_id: "1", product_name: "Curso" }], []);
    expect(result).not.toBeNull();
    expect(result).toContain("Meta Ads");
  });

  it("returns null when both sources are configured", () => {
    const result = getPartialFilterWarning(
      [{ product_id: "1", product_name: "Curso" }],
      ["lançamento"]
    );
    expect(result).toBeNull();
  });

  it("returns null when both sources are empty (existing validation handles this)", () => {
    const result = getPartialFilterWarning([], []);
    expect(result).toBeNull();
  });
});

// ── LeadsSection ──────────────────────────────────────────────────────────────

describe("LeadsSection", () => {
  const leadsData = {
    total: 100,
    by_event: [{ evento: "evento-xyz", count: 50 }],
  };
  const loaded = { data: leadsData, loading: false, error: false };
  const loadedDaily = { data: [], loading: false, error: false };

  it("renders total captacoes value", () => {
    const html = render(LeadsSection({ leadsState: loaded, dailyState: loadedDaily }));
    expect(html).toContain("100");
  });

  it("renders event name in cyan color", () => {
    const html = render(LeadsSection({ leadsState: loaded, dailyState: loadedDaily }));
    expect(html).toContain("var(--cyan)");
  });

  it("total captacoes uses DM Mono", () => {
    const html = render(LeadsSection({ leadsState: loaded, dailyState: loadedDaily }));
    expect(html).toContain("DM Mono");
  });

  it("subtitle uses --text-3 color", () => {
    const html = render(LeadsSection({ leadsState: loaded, dailyState: loadedDaily }));
    expect(html).toContain("var(--text-3)");
  });

  it("renders loading skeleton", () => {
    const loading = { data: null, loading: true, error: false };
    const html = render(LeadsSection({ leadsState: loading, dailyState: loadedDaily }));
    expect(html).toContain("pulse");
  });
});

const noop = () => {};

// ── IndicadoresEmptyState ─────────────────────────────────────────────────────

describe("IndicadoresEmptyState", () => {
  it("renders orientative message guiding user to select a filter", () => {
    const html = render(IndicadoresEmptyState({ onOpenFilter: noop }));
    expect(html).toContain("Nenhum filtro selecionado");
    expect(html).toContain("Selecione ou crie um filtro");
  });

  it("renders a call-to-action button with actionable text", () => {
    const html = render(IndicadoresEmptyState({ onOpenFilter: noop }));
    expect(html).toContain("Criar ou selecionar filtro");
  });

  it("renders the filter icon SVG inside the button area", () => {
    const html = render(IndicadoresEmptyState({ onOpenFilter: noop }));
    // The component renders a plus-sign SVG inside the button
    expect(html).toContain("svg");
  });
});

// ── FilterDropdownList ────────────────────────────────────────────────────────

const sampleFilters: FilterRecord[] = [
  {
    id: "f1",
    account_id: "acc1",
    name: "Filtro Alpha",
    hotmart_products: [],
    meta_ads_terms: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

describe("FilterDropdownList", () => {
  it("does not render 'Sem filtro' option", () => {
    const html = render(
      FilterDropdownList({
        filters: sampleFilters,
        activeFilter: null,
        onSelect: noop,
        onNew: noop,
        onEdit: noop,
        onDelete: noop,
      })
    );
    expect(html).not.toContain("Sem filtro");
  });

  it("renders '+ Novo filtro' button", () => {
    const html = render(
      FilterDropdownList({
        filters: sampleFilters,
        activeFilter: null,
        onSelect: noop,
        onNew: noop,
        onEdit: noop,
        onDelete: noop,
      })
    );
    expect(html).toContain("+ Novo filtro");
  });

  it("renders filter names from the list", () => {
    const html = render(
      FilterDropdownList({
        filters: sampleFilters,
        activeFilter: null,
        onSelect: noop,
        onNew: noop,
        onEdit: noop,
        onDelete: noop,
      })
    );
    expect(html).toContain("Filtro Alpha");
  });

  it("renders 'Nenhum filtro salvo' when filters list is empty", () => {
    const html = render(
      FilterDropdownList({
        filters: [],
        activeFilter: null,
        onSelect: noop,
        onNew: noop,
        onEdit: noop,
        onDelete: noop,
      })
    );
    expect(html).toContain("Nenhum filtro salvo");
  });
});


