import { renderToStaticMarkup } from "react-dom/server";
import { HeroKpiCard } from "@/components/indicadores/hero-kpi-card";
import { KpiCell } from "@/components/indicadores/kpi-cell";
import { HorizontalFunnelFlow } from "@/components/indicadores/horizontal-funnel-flow";
import { LeadsSection } from "@/components/indicadores/leads-section";
import { ConversionSourcesCard } from "@/components/indicadores/conversion-sources-card";
import { FilterDropdownList } from "@/components/indicadores/filter-dropdown";
import { IndicadoresEmptyState } from "@/components/indicadores/indicadores-empty-state";
import { getPartialFilterWarning, FilterModal } from "@/components/indicadores/filter-modal";
import { MetaAdsPanel } from "@/components/indicadores/meta-ads-card";
import { HotmartPanel } from "@/components/indicadores/hotmart-card";
import { PlatformsCard } from "@/components/indicadores/platforms-card";
import { NotConfiguredBadge } from "@/components/indicadores/not-configured-badge";
import type { FunnelStage, ConversionRate } from "@/lib/utils/funnel-metrics";
import type { FilterRecord } from "@/types/indicadores";

import React from "react";

jest.mock("@/components/indicadores/trend-charts", () => ({
  LeadsCaptacoesChart: () => React.createElement("span", { "data-chart": "leads" }, null),
  MetaAdsInvestimentoLeadsChart: () => React.createElement("span", { "data-chart": "meta" }, null),
  HotmartVendasChart: () => React.createElement("span", { "data-chart": "hotmart" }, null),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ── HeroKpiCard ───────────────────────────────────────────────────────────────

describe("HeroKpiCard", () => {
  it("renders label, value and subtitle", () => {
    const html = render(
      <HeroKpiCard label="ROAS" value="3.50" subtitle="Receita ÷ Investimento" dotColor="var(--violet)" />
    );
    expect(html).toContain("ROAS");
    expect(html).toContain("3.50");
    expect(html).toContain("Receita ÷ Investimento");
  });

  it("renders the dot with the provided color", () => {
    const html = render(
      <HeroKpiCard label="ROAS" value="3.50" subtitle="sub" dotColor="var(--violet)" />
    );
    expect(html).toContain("var(--violet)");
  });

  it("renders value monochrome (--text-strong) at 36px", () => {
    const html = render(
      <HeroKpiCard label="ROAS" value="3.50" subtitle="sub" dotColor="var(--violet)" />
    );
    expect(html).toContain("var(--text-strong)");
    expect(html).toContain("font-size:36px");
  });

  it("subtitle uses --text-3 color", () => {
    const html = render(
      <HeroKpiCard label="ROAS" value="3.50" subtitle="sub" dotColor="var(--violet)" />
    );
    expect(html).toContain("var(--text-3)");
  });

  it("renders loading skeleton when loading is true", () => {
    const html = render(
      <HeroKpiCard label="ROAS" value="3.50" subtitle="sub" dotColor="var(--violet)" loading />
    );
    expect(html).not.toContain("ROAS");
    expect(html).not.toContain("3.50");
    expect(html).toContain("pulse");
  });
});

// ── KpiCell ───────────────────────────────────────────────────────────────────

describe("KpiCell", () => {
  it("renders label and value", () => {
    const html = render(<KpiCell label="Investimento" value="R$ 1.000" />);
    expect(html).toContain("Investimento");
    expect(html).toContain("R$ 1.000");
  });

  it("renders value in 24px when large is true", () => {
    const html = render(<KpiCell label="X" value="Y" large />);
    expect(html).toContain("font-size:24px");
    expect(html).toContain("var(--text-strong)");
  });

  it("renders value in 15px secondary style when large is omitted", () => {
    const html = render(<KpiCell label="X" value="Y" />);
    expect(html).toContain("font-size:15px");
    expect(html).toContain("var(--text-2)");
  });

  it("renders large value muted when muted is true", () => {
    const html = render(<KpiCell label="Vendas Ext." value="1" large muted />);
    expect(html).toContain("font-size:24px");
    expect(html).toContain("var(--text-2)");
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
  it("renders 5 stage labels given valid input", () => {
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={fourRates} />);
    expect(html).toContain("Impressões");
    expect(html).toContain("Cliques no link");
    expect(html).toContain("Visualizações de LP");
    expect(html).toContain("Leads captados");
    expect(html).toContain("Vendas aprovadas");
  });

  it("CTR 0,3% → rate-low (vermelho)", () => {
    const rates: ConversionRate[] = [{ label: "CTR", pct: 0.3 }, ...fourRates.slice(1)];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-low");
  });

  it("CTR 0,8% → rate-warn (âmbar)", () => {
    const rates: ConversionRate[] = [{ label: "CTR", pct: 0.8 }, ...fourRates.slice(1)];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-warn");
  });

  it("CTR 2,0% → rate-ok (verde)", () => {
    const rates: ConversionRate[] = [{ label: "CTR", pct: 2.0 }, ...fourRates.slice(1)];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-ok");
  });

  it("Taxa de Fechamento 5% → rate-low", () => {
    const rates: ConversionRate[] = [...fourRates.slice(0, 3), { label: "Taxa de Fechamento", pct: 5 }];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-low");
  });

  it("Taxa de Fechamento 20% → rate-warn", () => {
    const rates: ConversionRate[] = [...fourRates.slice(0, 3), { label: "Taxa de Fechamento", pct: 20 }];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-warn");
  });

  it("Taxa de Fechamento 35% → rate-ok", () => {
    const rates: ConversionRate[] = [...fourRates.slice(0, 3), { label: "Taxa de Fechamento", pct: 35 }];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-ok");
  });

  it("Conv LP→Lead 25% → rate-low", () => {
    const rates: ConversionRate[] = [
      fourRates[0],
      fourRates[1],
      { label: "Conversão LP→Lead", pct: 25 },
      fourRates[3],
    ];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-low");
  });

  it("Conv LP→Lead 50% → rate-warn", () => {
    const rates: ConversionRate[] = [
      fourRates[0],
      fourRates[1],
      { label: "Conversão LP→Lead", pct: 50 },
      fourRates[3],
    ];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-warn");
  });

  it("Conv LP→Lead 80% → rate-ok", () => {
    const rates: ConversionRate[] = [
      fourRates[0],
      fourRates[1],
      { label: "Conversão LP→Lead", pct: 80 },
      fourRates[3],
    ];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("rate-ok");
  });

  it("does not throw when stages is empty", () => {
    expect(() => render(<HorizontalFunnelFlow stages={[]} rates={[]} />)).not.toThrow();
  });

  it("displays — when rate.pct is null", () => {
    const rates: ConversionRate[] = [{ label: "CTR", pct: null }, ...fourRates.slice(1)];
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={rates} />);
    expect(html).toContain("—");
  });

  it("does not render Funil de Conversão header text", () => {
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={fourRates} />);
    expect(html).not.toContain("Funil de Conversão");
  });

  it("highlights the last stage (Vendas) with the green accent", () => {
    const html = render(<HorizontalFunnelFlow stages={fiveStages} rates={fourRates} />);
    expect(html).toContain("var(--green)");
    expect(html).toContain("#2b3a34");
  });
});

// ── getPartialFilterWarning ───────────────────────────────────────────────────

describe("getPartialFilterWarning", () => {
  const product = { product_id: "1", product_name: "Curso" };

  it("warns about Hotmart and Leads when only Meta terms are provided", () => {
    const result = getPartialFilterWarning([], ["lançamento"], []);
    expect(result).not.toBeNull();
    expect(result).toContain("Hotmart");
    expect(result).toContain("Leads");
  });

  it("warns about Meta Ads and Leads when only Hotmart products are provided", () => {
    const result = getPartialFilterWarning([product], [], []);
    expect(result).not.toBeNull();
    expect(result).toContain("Meta Ads");
    expect(result).toContain("Leads");
  });

  it("warns about Leads when only Hotmart and Meta are configured", () => {
    const result = getPartialFilterWarning([product], ["lançamento"], []);
    expect(result).not.toBeNull();
    expect(result).toContain("Leads");
  });

  it("warns about Hotmart and Meta when only leads events are configured", () => {
    const result = getPartialFilterWarning([], [], ["Inscricao Webinar"]);
    expect(result).not.toBeNull();
    expect(result).toContain("Hotmart");
    expect(result).toContain("Meta Ads");
  });

  it("returns null when all three sources are configured", () => {
    const result = getPartialFilterWarning([product], ["lançamento"], ["Inscricao Webinar"]);
    expect(result).toBeNull();
  });

  it("returns null when all sources are empty (existing validation handles this)", () => {
    const result = getPartialFilterWarning([], [], []);
    expect(result).toBeNull();
  });
});

// ── LeadsSection ──────────────────────────────────────────────────────────────

describe("LeadsSection", () => {
  const leadsData = {
    total: 100,
    by_event: [{ evento: "evento-xyz", count: 50 }],
    by_source: [{ source: "organic_IG_Bio", count: 80 }],
  };
  const loaded = { data: leadsData, loading: false, error: false };
  const loadedDaily = { data: [], loading: false, error: false };

  it("renders total captacoes value", () => {
    const html = render(<LeadsSection leadsState={loaded} dailyState={loadedDaily} />);
    expect(html).toContain("100");
  });

  it("renders event name in cyan color", () => {
    const html = render(<LeadsSection leadsState={loaded} dailyState={loadedDaily} />);
    expect(html).toContain("var(--cyan)");
  });

  it("subtitle uses --text-3 color", () => {
    const html = render(<LeadsSection leadsState={loaded} dailyState={loadedDaily} />);
    expect(html).toContain("var(--text-3)");
  });

  it("renders loading skeleton", () => {
    const loading = { data: null, loading: true, error: false };
    const html = render(<LeadsSection leadsState={loading} dailyState={loadedDaily} />);
    expect(html).toContain("pulse");
  });

  it("shows all sources without toggle when 5 or fewer", () => {
    const html = render(<LeadsSection leadsState={loaded} dailyState={loadedDaily} />);
    expect(html).not.toContain("Outras fontes");
    expect(html).not.toContain("Ver todas");
  });

  it("aggregates sources beyond top 5 into 'Outras fontes (N)' with toggle", () => {
    const manySources = {
      ...leadsData,
      by_source: [
        { source: "meta", count: 7 },
        { source: "Email", count: 3 },
        { source: "WhatsApp", count: 3 },
        { source: "Youtube", count: 2 },
        { source: "Instagram_Bio_GT", count: 1 },
        { source: "organico", count: 1 },
        { source: "indicacao", count: 1 },
      ],
    };
    const state = { data: manySources, loading: false, error: false };
    const html = render(<LeadsSection leadsState={state} dailyState={loadedDaily} />);
    expect(html).toContain("Outras fontes (2)");
    expect(html).toContain("Ver todas as 7 fontes");
    expect(html).not.toContain("organico");
  });
});

// ── ConversionSourcesCard ─────────────────────────────────────────────────────

describe("ConversionSourcesCard", () => {
  const rows = [
    { source: "is-atendimentoXX", count: 16 },
    { source: "oportunidade-pc26", count: 6 },
    { source: "is-01", count: 4 },
  ];

  it("renders total and attribution subtitle", () => {
    const html = render(<ConversionSourcesCard state={{ data: rows, loading: false, error: false }} />);
    expect(html).toContain("26");
    expect(html).toContain("vendas atribuídas");
  });

  it("shows all sources without toggle when 5 or fewer", () => {
    const html = render(<ConversionSourcesCard state={{ data: rows, loading: false, error: false }} />);
    expect(html).not.toContain("Outras origens");
    expect(html).not.toContain("Ver todas");
  });

  it("aggregates sources beyond top 5 into 'Outras origens (N)' with toggle", () => {
    const many = [
      ...rows,
      { source: "is-atendimento01", count: 2 },
      { source: "Youtube", count: 1 },
      { source: "WhatsApp", count: 1 },
      { source: "Email", count: 1 },
    ];
    const html = render(<ConversionSourcesCard state={{ data: many, loading: false, error: false }} />);
    expect(html).toContain("Outras origens (2)");
    expect(html).toContain("Ver todas as 7 origens");
    expect(html).not.toContain("Email");
  });

  it("renders empty message when there are no sources", () => {
    const html = render(<ConversionSourcesCard state={{ data: [], loading: false, error: false }} />);
    expect(html).toContain("Nenhuma venda encontrada no período.");
  });

  it("renders loading skeleton", () => {
    const html = render(<ConversionSourcesCard state={{ data: null, loading: true, error: false }} />);
    expect(html).toContain("pulse");
  });
});

const noop = () => {};

// ── IndicadoresEmptyState ─────────────────────────────────────────────────────

describe("IndicadoresEmptyState", () => {
  it("renders orientative message guiding user to select a filter", () => {
    const html = render(<IndicadoresEmptyState onOpenFilter={noop} />);
    expect(html).toContain("Nenhum filtro selecionado");
    expect(html).toContain("Selecione ou crie um filtro");
  });

  it("renders a call-to-action button with actionable text", () => {
    const html = render(<IndicadoresEmptyState onOpenFilter={noop} />);
    expect(html).toContain("Criar ou selecionar filtro");
  });

  it("renders the filter icon SVG inside the button area", () => {
    const html = render(<IndicadoresEmptyState onOpenFilter={noop} />);
    // The component renders a plus-sign SVG inside the button
    expect(html).toContain("svg");
  });
});

// As flags de fonte configurada agora vivem em expandFilter().sources — única
// definição de "o que um filtro significa". Cobertura em
// src/lib/indicadores/__tests__/filter-expansion.test.ts.

// ── FilterDropdownList ────────────────────────────────────────────────────────

const sampleFilters: FilterRecord[] = [
  {
    id: "f1",
    account_id: "acc1",
    name: "Filtro Alpha",
    hotmart_products: [],
    meta_ads_terms: [],
    captacao_leads_eventos: [],
    status: "ativo",
    status_changed_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

// ── FilterModal status segmented control ─────────────────────────────────────

describe("FilterModal — segmented control de status", () => {
  it("edição exibe as 3 opções com o status atual selecionado", () => {
    const editTarget: FilterRecord = { ...sampleFilters[0], status: "finalizado" };
    const html = render(
      <FilterModal accountId="acc1" editTarget={editTarget} onSave={noop} onCancel={noop} />
    );
    expect(html).toContain('data-testid="status-option-ativo"');
    expect(html).toContain('data-testid="status-option-finalizado"');
    expect(html).toContain('data-testid="status-option-cancelado"');
    expect(html).toMatch(/data-testid="status-option-finalizado"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/data-testid="status-option-ativo"[^>]*aria-pressed="false"/);
  });

  it("criação não exibe o segmented control", () => {
    const html = render(
      <FilterModal accountId="acc1" editTarget={null} onSave={noop} onCancel={noop} />
    );
    expect(html).not.toContain('data-testid="status-option-ativo"');
  });
});

describe("FilterDropdownList", () => {
  it("does not render 'Sem filtro' option", () => {
    const html = render(
      <FilterDropdownList
        filters={sampleFilters}
        activeFilter={null}
        onSelect={noop}
        onNew={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(html).not.toContain("Sem filtro");
  });

  it("renders '+ Novo filtro' button", () => {
    const html = render(
      <FilterDropdownList
        filters={sampleFilters}
        activeFilter={null}
        onSelect={noop}
        onNew={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(html).toContain("+ Novo filtro");
  });

  it("renders filter names from the list", () => {
    const html = render(
      <FilterDropdownList
        filters={sampleFilters}
        activeFilter={null}
        onSelect={noop}
        onNew={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(html).toContain("Filtro Alpha");
  });

  it("renders 'Nenhum filtro salvo' when filters list is empty", () => {
    const html = render(
      <FilterDropdownList
        filters={[]}
        activeFilter={null}
        onSelect={noop}
        onNew={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(html).toContain("Nenhum filtro salvo");
  });
});

// ── MetaAdsPanel badge ────────────────────────────────────────────────────────

const zeroedMeta = {
  data: {
    meta_spend: 0, meta_cpm: 0, meta_ctr: 0, meta_leads: 0,
    meta_checkout: 0, meta_impressions: 0, meta_link_clicks: 0,
    meta_page_views: 0, meta_connect_rate: null, meta_lp_conversion: null,
    meta_cpl_traffic: null,
  },
  loading: false,
  error: false,
};
const emptyDaily = { data: [], loading: false, error: false };

describe("MetaAdsPanel — not-configured badge", () => {
  it("shows 'Meta Ads não configurado' when hasMetaFilter is false", () => {
    const html = render(
      <MetaAdsPanel metaState={zeroedMeta} dailyState={emptyDaily} hasMetaFilter={false} />
    );
    expect(html).toContain("Meta Ads não configurado");
  });

  it("does NOT show 'não configurado' when hasMetaFilter is true", () => {
    const html = render(
      <MetaAdsPanel metaState={zeroedMeta} dailyState={emptyDaily} hasMetaFilter={true} />
    );
    expect(html).not.toContain("não configurado");
  });
});

// ── NotConfiguredBadge (pure component from hotmart-card) ─────────────────────

describe("NotConfiguredBadge", () => {
  it("renders the provided text", () => {
    const html = render(<NotConfiguredBadge text="Hotmart não configurado neste filtro — dados zerados" />);
    expect(html).toContain("Hotmart não configurado");
  });

  it("uses var(--text-3) color", () => {
    const html = render(<NotConfiguredBadge text="Test badge" />);
    expect(html).toContain("var(--text-3)");
  });
});

// ── MetaAdsPanel — chart visibility (#46) ────────────────────────────────────

describe("MetaAdsPanel — chart visibility", () => {
  it("does NOT render MetaAdsInvestimentoLeadsChart when hasMetaFilter is false", () => {
    const html = render(
      <MetaAdsPanel metaState={zeroedMeta} dailyState={emptyDaily} hasMetaFilter={false} />
    );
    expect(html).not.toContain('data-chart="meta"');
  });

  it("DOES render MetaAdsInvestimentoLeadsChart when hasMetaFilter is true", () => {
    const html = render(
      <MetaAdsPanel metaState={zeroedMeta} dailyState={emptyDaily} hasMetaFilter={true} />
    );
    expect(html).toContain('data-chart="meta"');
  });
});

// ── HotmartPanel — chart visibility (#46) ────────────────────────────────────

const zeroedHotmart: { data: import("@/types/indicadores").GlobalHotmartMetrics; loading: boolean; error: boolean } = {
  data: {
    total_revenue: 0,
    total_sales: 0,
    total_sales_brl: 0,
    total_sales_foreign: 0,
    products: [],
  },
  loading: false,
  error: false,
};

describe("HotmartPanel — chart visibility", () => {
  it("does NOT render HotmartVendasChart when hasHotmartFilter is false", () => {
    const html = render(
      <HotmartPanel hotmartState={zeroedHotmart} dailyState={emptyDaily} hasHotmartFilter={false} />
    );
    expect(html).not.toContain('data-chart="hotmart"');
  });

  it("DOES render HotmartVendasChart when hasHotmartFilter is true", () => {
    const html = render(
      <HotmartPanel hotmartState={zeroedHotmart} dailyState={emptyDaily} hasHotmartFilter={true} />
    );
    expect(html).toContain('data-chart="hotmart"');
  });
});

// ── PlatformsCard — tabs ─────────────────────────────────────────────────────

describe("PlatformsCard", () => {
  it("renders both platform tabs", () => {
    const html = render(
      <PlatformsCard
        metaState={zeroedMeta}
        hotmartState={zeroedHotmart}
        dailyState={emptyDaily}
        hasMetaFilter={true}
        hasHotmartFilter={true}
      />
    );
    expect(html).toContain("Meta Ads");
    expect(html).toContain("Hotmart");
  });

  it("shows the Meta Ads panel by default (Hotmart panel hidden)", () => {
    const html = render(
      <PlatformsCard
        metaState={zeroedMeta}
        hotmartState={zeroedHotmart}
        dailyState={emptyDaily}
        hasMetaFilter={true}
        hasHotmartFilter={true}
      />
    );
    expect(html).toContain('data-chart="meta"');
    expect(html).not.toContain('data-chart="hotmart"');
  });
});
