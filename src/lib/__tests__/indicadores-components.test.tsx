import { renderToStaticMarkup } from "react-dom/server";
import { HeroKpiCard } from "@/components/indicadores/hero-kpi-card";
import { KpiCell } from "@/components/indicadores/kpi-cell";
import { HorizontalFunnelFlow } from "@/components/indicadores/horizontal-funnel-flow";
import { LeadsSection } from "@/components/indicadores/leads-section";
import type { FunnelStage, ConversionRate } from "@/lib/utils/funnel-metrics";

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
