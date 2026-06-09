import { serializeDashboardContext } from "../context-serializer";
import type { DashboardContext } from "../types";
import type { FilterRecord, GlobalMetrics, GlobalHotmartMetrics, GlobalLeadsMetrics } from "@/types/indicadores";

const makeFilter = (): FilterRecord => ({
  id: "filter-1",
  account_id: "acc-1",
  name: "Filtro Alpha",
  hotmart_products: [],
  meta_ads_terms: [],
  captacao_leads_eventos: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const makeMetaData = (): GlobalMetrics => ({
  meta_spend: 1500.5,
  meta_cpm: 10,
  meta_ctr: 0.02,
  meta_leads: 300,
  meta_checkout: 50,
  meta_impressions: 100000,
  meta_link_clicks: 2000,
  meta_page_views: 1800,
  meta_connect_rate: null,
  meta_lp_conversion: null,
  meta_cpl_traffic: 5.0,
});

const makeHotmartData = (): GlobalHotmartMetrics => ({
  products: [],
  total_sales: 120,
  total_sales_brl: 100,
  total_sales_foreign: 20,
  total_revenue: 48000,
});

const makeLeadsData = (): GlobalLeadsMetrics => ({
  total: 450,
  by_event: [],
  by_source: [],
});

const baseCtx = (): DashboardContext => ({
  activeFilter: makeFilter(),
  startDate: "2026-05-01",
  endDate: "2026-05-31",
  activePreset: "mes_atual",
  metaData: makeMetaData(),
  hotmartData: makeHotmartData(),
  leadsData: makeLeadsData(),
});

describe("serializeDashboardContext", () => {
  it("Teste 1: com todos os dados presentes, retorna string com nome do filtro, período e métricas principais", () => {
    const result = serializeDashboardContext(baseCtx());

    expect(result).toContain("Filtro Alpha");
    expect(result).toContain("2026-05-01");
    expect(result).toContain("2026-05-31");
    expect(result).toContain("1500.5");   // meta_spend
    expect(result).toContain("300");      // meta_leads
    expect(result).toContain("48000");    // total_revenue
  });

  it("Teste 2: com activeFilter null, indica nenhum filtro ativo", () => {
    const ctx = { ...baseCtx(), activeFilter: null };
    const result = serializeDashboardContext(ctx);

    expect(result).toMatch(/nenhum filtro ativo/i);
  });

  it("Teste 3: com metaData null, indica dados Meta Ads indisponíveis e não lança exceção", () => {
    const ctx = { ...baseCtx(), metaData: null };
    expect(() => serializeDashboardContext(ctx)).not.toThrow();
    const result = serializeDashboardContext(ctx);
    expect(result).toMatch(/meta ads indispon[íi]vel/i);
  });

  it("Teste 4: com hotmartData null, indica dados Hotmart indisponíveis e não lança exceção", () => {
    const ctx = { ...baseCtx(), hotmartData: null };
    expect(() => serializeDashboardContext(ctx)).not.toThrow();
    const result = serializeDashboardContext(ctx);
    expect(result).toMatch(/hotmart indispon[íi]vel/i);
  });

  it("Teste 5: com leadsData null, indica dados Leads indisponíveis e não lança exceção", () => {
    const ctx = { ...baseCtx(), leadsData: null };
    expect(() => serializeDashboardContext(ctx)).not.toThrow();
    const result = serializeDashboardContext(ctx);
    expect(result).toMatch(/leads indispon[íi]vel/i);
  });
});
