import { NextRequest } from "next/server";
import { makeFakeSupabase, type FakeSupabase } from "@/lib/indicadores/__tests__/fake-supabase";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "admin" }),
}));

let supabase: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => supabase.client),
}));

function get(query: string) {
  return new NextRequest(`http://localhost/api/indicadores/daily${query}`, { method: "GET" });
}

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("GET /api/indicadores/daily", () => {
  it("devolve 400 sem as datas", async () => {
    const { GET } = await import("../route");

    const res = await GET(get("?start_date=2026-06-01"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "start_date and end_date are required" });
  });

  it("responde a série de pontos do período, com as lacunas preenchidas", async () => {
    supabase.setRows("dash_gestao_meta_ads_campaigns_daily", [
      { date: "2026-06-02", spend: 90, leads_all: 3, checkout: 1 },
    ]);
    const { GET } = await import("../route");

    const res = await GET(get("?start_date=2026-06-01&end_date=2026-06-03&meta_terms[]=PC"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([
      {
        date: "2026-06-01",
        meta_spend: 0,
        meta_leads: 0,
        meta_cpl_traffic: null,
        meta_checkout: 0,
        hotmart_sales: 0,
        lead_captacoes: 0,
      },
      {
        date: "2026-06-02",
        meta_spend: 90,
        meta_leads: 3,
        meta_cpl_traffic: 30,
        meta_checkout: 1,
        hotmart_sales: 0,
        lead_captacoes: 0,
      },
      {
        date: "2026-06-03",
        meta_spend: 0,
        meta_leads: 0,
        meta_cpl_traffic: null,
        meta_checkout: 0,
        hotmart_sales: 0,
        lead_captacoes: 0,
      },
    ]);
  });

  it("devolve 500 com a mensagem quando o banco falha, sem série zerada", async () => {
    supabase.setError("dash_gestao_meta_ads_campaigns_daily", "conexão perdida");
    const { GET } = await import("../route");

    const res = await GET(get("?start_date=2026-06-01&end_date=2026-06-03&meta_terms[]=PC"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "conexão perdida" });
  });

  it("aplica a oferta selecionada, que a tela já enviava e o route descartava", async () => {
    const { GET } = await import("../route");

    const res = await GET(
      get("?start_date=2026-06-01&end_date=2026-06-03&product_ids[]=111&offer_code=OFERTA-X")
    );

    expect(res.status).toBe(200);
    const q = supabase.queriesFor("dash_gestao_hotmart_sales")[0];
    expect(q.eq).toContainEqual(["offer_code", "OFERTA-X"]);
  });
});
