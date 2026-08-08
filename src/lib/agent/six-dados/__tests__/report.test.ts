import { generateSixDadosReport, type SixDadosModel } from "../report";
import { LIFETIME_START } from "@/lib/indicadores/service/eventos-metrics";
import { makeFakeSupabase, type FakeSupabase } from "@/lib/indicadores/__tests__/fake-supabase";
import type { FilterRecord } from "@/types/indicadores";

const NOW = new Date("2026-07-16T15:00:00Z"); // 12:00 em São Paulo (UTC-3) — mesmo dia

function makeFilter(overrides: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Ingresso PC Ao Vivo",
    hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
    meta_ads_terms: ["PC Ao Vivo"],
    captacao_leads_eventos: ["PC_AO_VIVO_2026"],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function sale(price: number, product_id = "111") {
  return {
    product_id,
    product_name: "Ingresso",
    price,
    currency: "BRL",
    status: "APPROVED",
    purchase_date: "2026-07-15T12:00:00.000Z",
  };
}

function campaignDay(spend: number, leads_all: number) {
  return { spend, impressions: 1000, link_clicks: 50, leads_all, page_views: 30, checkout: 5 };
}

function fakeModel(reply = "Resumo gerado."): { model: SixDadosModel; invoke: jest.Mock } {
  const invoke = jest.fn().mockResolvedValue({ content: reply });
  return { model: { invoke }, invoke };
}

let supabase: FakeSupabase;

beforeEach(() => {
  supabase = makeFakeSupabase();
  supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [campaignDay(100, 20)]);
  supabase.setRows("dash_gestao_hotmart_sales", [sale(250)]);
  supabase.setRpc("dash_gestao_leads_unique_total", 40);
  supabase.setRpc("dash_gestao_leads_by_event_unique", [{ evento: "PC_AO_VIVO_2026", count: 40 }]);
  supabase.setRpc("dash_gestao_leads_by_source", [{ source: "instagram", count: 40 }]);
});

describe("generateSixDadosReport", () => {
  it("chama o modelo uma única vez e retorna { reportText, kpiSnapshot }", async () => {
    const { model, invoke } = fakeModel("A Ingresso PC Ao Vivo segue bem.");

    const result = await generateSixDadosReport(makeFilter(), { supabase: supabase.client, model, now: NOW });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.reportText).toBe("A Ingresso PC Ao Vivo segue bem.");
  });

  it("o snapshot tem o shape lifetime + last7d", async () => {
    const { model } = fakeModel();

    const { kpiSnapshot } = await generateSixDadosReport(makeFilter(), {
      supabase: supabase.client,
      model,
      now: NOW,
    });

    expect(kpiSnapshot).toHaveProperty("lifetime");
    expect(kpiSnapshot).toHaveProperty("last7d");
    for (const block of [kpiSnapshot.lifetime, kpiSnapshot.last7d]) {
      expect(block).toEqual(
        expect.objectContaining({
          roas: expect.anything(),
          revenueBrl: expect.anything(),
          leads: expect.anything(),
          cpl: expect.anything(),
          spend: expect.anything(),
          sales: expect.anything(),
          startDate: expect.any(String),
          endDate: expect.any(String),
        })
      );
    }
  });

  it("bloco vitalício vai de LIFETIME_START até hoje (São Paulo)", async () => {
    const { model } = fakeModel();

    const { kpiSnapshot } = await generateSixDadosReport(makeFilter(), {
      supabase: supabase.client,
      model,
      now: NOW,
    });

    expect(kpiSnapshot.lifetime.startDate).toBe(LIFETIME_START);
    expect(kpiSnapshot.lifetime.endDate).toBe("2026-07-16");
  });

  it("bloco 7d cobre os últimos 7 dias até hoje", async () => {
    const { model } = fakeModel();

    const { kpiSnapshot } = await generateSixDadosReport(makeFilter(), {
      supabase: supabase.client,
      model,
      now: NOW,
    });

    expect(kpiSnapshot.last7d.startDate).toBe("2026-07-09");
    expect(kpiSnapshot.last7d.endDate).toBe("2026-07-16");
  });

  it("mapeia os KPIs a partir do PeriodSummary: roas, revenueBrl, leads, cpl, spend, sales", async () => {
    const { model } = fakeModel();

    const { kpiSnapshot } = await generateSixDadosReport(makeFilter(), {
      supabase: supabase.client,
      model,
      now: NOW,
    });

    // Vitalício: mesmas linhas aparecem nos dois períodos (venda e leads em 15/07,
    // dentro da janela dos dois blocos).
    expect(kpiSnapshot.lifetime.revenueBrl).toBe(250);
    expect(kpiSnapshot.lifetime.sales).toBe(1);
    expect(kpiSnapshot.lifetime.leads).toBe(40);
    expect(kpiSnapshot.lifetime.spend).toBe(100);
    expect(kpiSnapshot.lifetime.cpl).toBeCloseTo(100 / 40);
    expect(kpiSnapshot.lifetime.roas).toBeCloseTo(250 / 100);
  });

  it("fonte não configurada vira null no snapshot — nunca 0", async () => {
    const { model } = fakeModel();
    const semMeta = makeFilter({ meta_ads_terms: [] });

    const { kpiSnapshot } = await generateSixDadosReport(semMeta, {
      supabase: supabase.client,
      model,
      now: NOW,
    });

    expect(kpiSnapshot.lifetime.spend).toBeNull();
    expect(kpiSnapshot.lifetime.cpl).toBeNull();
    expect(kpiSnapshot.lifetime.roas).toBeNull();
  });

  it("cpl é null quando leads = 0, mesmo com spend disponível", async () => {
    supabase.setRpc("dash_gestao_leads_unique_total", 0);
    const { model } = fakeModel();

    const { kpiSnapshot } = await generateSixDadosReport(makeFilter(), {
      supabase: supabase.client,
      model,
      now: NOW,
    });

    expect(kpiSnapshot.lifetime.leads).toBe(0);
    expect(kpiSnapshot.lifetime.cpl).toBeNull();
  });

  it("usa o filtro expandido do Evento — consulta escopada aos produtos/termos/eventos dele", async () => {
    const { model } = fakeModel();

    await generateSixDadosReport(makeFilter(), { supabase: supabase.client, model, now: NOW });

    const metaQuery = supabase.queriesFor("dash_gestao_meta_ads_campaigns_daily")[0];
    expect(metaQuery.or).toEqual(["campaign_name.ilike.%PC Ao Vivo%"]);
  });

  it("passa o prompt com o nome do Evento e os números ao modelo, numa chamada só", async () => {
    const { model, invoke } = fakeModel();

    await generateSixDadosReport(makeFilter(), { supabase: supabase.client, model, now: NOW });

    const [prompt] = invoke.mock.calls[0];
    expect(typeof prompt).toBe("string");
    expect(prompt).toContain("Ingresso PC Ao Vivo");
  });
});
