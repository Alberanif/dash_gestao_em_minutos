import { z } from "zod";
import { buildAgentTools } from "../tools";
import { expandFilter } from "@/lib/indicadores/filter-expansion";
import { makeFakeSupabase, type FakeSupabase } from "@/lib/indicadores/__tests__/fake-supabase";
import type { FilterRecord } from "@/types/indicadores";

const FILTER: FilterRecord = {
  id: "f-1",
  account_id: "acc-1",
  name: "Ingresso PC Ao Vivo",
  hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
  meta_ads_terms: ["PC Ao Vivo"],
  captacao_leads_eventos: ["evento-a"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function sale(price: number, product_id = "111") {
  return {
    product_id,
    product_name: "Ingresso",
    price,
    currency: "BRL",
    status: "APPROVED",
    purchase_date: "2026-06-15T12:00:00.000Z",
  };
}

let supabase: FakeSupabase;

function buildTools(filter = expandFilter(FILTER)) {
  return buildAgentTools({ filter, supabase: supabase.client });
}

function schemaKeys(tool: { schema: unknown }): string[] {
  return Object.keys((tool.schema as z.ZodObject<z.ZodRawShape>).shape ?? {});
}

function toolNamed(name: string) {
  const tool = buildTools().find((t) => t.name === name);
  if (!tool) throw new Error(`tool ${name} não existe`);
  return tool;
}

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("schema exposto ao modelo", () => {
  it("aceita somente startDate e endDate — o modelo não tem como pedir outro escopo", () => {
    for (const tool of buildTools()) {
      const shape = schemaKeys(tool);
      expect(shape.sort()).toEqual(["endDate", "startDate"]);
    }
  });

  it("não expõe filterId, product_ids nem qualquer parâmetro de filtro", () => {
    for (const tool of buildTools()) {
      const shape = schemaKeys(tool);
      expect(shape).not.toContain("filterId");
      expect(shape).not.toContain("filter_id");
      expect(shape).not.toContain("productIds");
    }
  });
});

describe("getPeriodSummary", () => {
  it("aplica o filtro fechado por closure na consulta, no período que o modelo pediu", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [sale(250)]);

    const raw = await toolNamed("getPeriodSummary").invoke({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    const summary = JSON.parse(raw as string);

    expect(summary.hotmart.total_revenue).toBe(250);
    const query = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(query.in).toContainEqual(["product_id", ["111"]]);
    expect(query.gte).toContainEqual(["purchase_date", "2026-06-01T03:00:00.000Z"]);
  });

  it("mantém o filtro em um período diferente do da tela", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [sale(80)]);

    await toolNamed("getPeriodSummary").invoke({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });

    const query = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(query.in).toContainEqual(["product_id", ["111"]]);
    expect(query.gte).toContainEqual(["purchase_date", "2026-05-01T03:00:00.000Z"]);
  });

  it("ignora qualquer parâmetro de escopo que o modelo tente injetar", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [sale(100)]);

    await toolNamed("getPeriodSummary").invoke({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      product_ids: ["999"],
      filterId: "outro-filtro",
    } as never);

    const query = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(query.in).toContainEqual(["product_id", ["111"]]);
    expect(query.in).not.toContainEqual(["product_id", ["999"]]);
  });

  it("declara quais fontes estão configuradas, para o modelo não confundir ausência com zero", async () => {
    const semMeta = expandFilter({ ...FILTER, meta_ads_terms: [] });
    const tool = buildTools(semMeta).find((t) => t.name === "getPeriodSummary")!;

    const summary = JSON.parse(
      (await tool.invoke({ startDate: "2026-06-01", endDate: "2026-06-30" })) as string
    );

    expect(summary.sources).toEqual({ meta: false, hotmart: true, leads: true });
  });

  it("informa o período consultado no retorno, para o modelo citar as datas certas", async () => {
    const summary = JSON.parse(
      (await toolNamed("getPeriodSummary").invoke({
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      })) as string
    );

    expect(summary.period).toEqual({ startDate: "2026-06-01", endDate: "2026-06-30" });
  });

  it("propaga a falha da consulta em vez de devolver zero", async () => {
    supabase.setError("dash_gestao_hotmart_sales", "timeout no banco");

    await expect(
      toolNamed("getPeriodSummary").invoke({ startDate: "2026-06-01", endDate: "2026-06-30" })
    ).rejects.toThrow("timeout no banco");
  });
});

describe("getDailySeries", () => {
  it("aplica o filtro fechado por closure na série, no período que o modelo pediu", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [sale(250)]);

    const raw = await toolNamed("getDailySeries").invoke({
      startDate: "2026-06-14",
      endDate: "2026-06-16",
    });
    const { series } = JSON.parse(raw as string);

    expect(series.map((p: { date: string; hotmart_sales: number }) => p.hotmart_sales)).toEqual([
      0, 1, 0,
    ]);

    const query = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(query.in).toContainEqual(["product_id", ["111"]]);
    expect(supabase.rpcCalls("dash_gestao_leads_daily_counts")[0].args.p_eventos).toEqual([
      "evento-a",
    ]);
  });

  it("ignora qualquer parâmetro de escopo que o modelo tente injetar", async () => {
    await toolNamed("getDailySeries").invoke({
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      product_ids: ["999"],
      filterId: "outro-filtro",
    } as never);

    const query = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(query.in).toContainEqual(["product_id", ["111"]]);
    expect(query.in).not.toContainEqual(["product_id", ["999"]]);
  });

  it("informa o período consultado, para o modelo citar as datas certas da virada", async () => {
    const payload = JSON.parse(
      (await toolNamed("getDailySeries").invoke({
        startDate: "2026-06-01",
        endDate: "2026-06-02",
      })) as string
    );

    expect(payload.period).toEqual({ startDate: "2026-06-01", endDate: "2026-06-02" });
    expect(payload.sources).toEqual({ meta: true, hotmart: true, leads: true });
  });

  it("diz ao modelo quando usá-la e que o filtro já vai aplicado", () => {
    const description = toolNamed("getDailySeries").description.toLowerCase();

    expect(description).toContain("tendência");
    expect(description).toContain("filtro ativo já é aplicado");
  });

  it("propaga a falha da consulta em vez de devolver série zerada", async () => {
    supabase.setError("dash_gestao_hotmart_sales", "timeout no banco");

    await expect(
      toolNamed("getDailySeries").invoke({ startDate: "2026-06-01", endDate: "2026-06-02" })
    ).rejects.toThrow("timeout no banco");
  });
});
