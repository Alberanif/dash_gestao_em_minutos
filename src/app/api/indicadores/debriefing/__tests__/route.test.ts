import { NextRequest } from "next/server";
import { makeFakeSupabase, type FakeSupabase } from "@/lib/indicadores/__tests__/fake-supabase";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "admin" }),
}));

let supabase: FakeSupabase;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => supabase.client),
}));

const DATES = "start_date=2026-05-01&end_date=2026-05-02";

function get(query: string) {
  return new NextRequest(`http://localhost/api/indicadores/debriefing?${query}`, { method: "GET" });
}

function withProducts(value: string) {
  return get(`${DATES}&products=${encodeURIComponent(value)}`);
}

beforeEach(() => {
  supabase = makeFakeSupabase();
});

describe("GET /api/indicadores/debriefing", () => {
  it("400 sem datas", async () => {
    const { GET } = await import("../route");
    const res = await GET(get(`products=${encodeURIComponent('[{"product_id":"1"}]')}`));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "start_date and end_date are required" });
  });

  it.each([
    ["products ausente", null],
    ["JSON inválido", "{nao-json"],
    ["não array", '{"product_id":"1"}'],
    ["array vazio", "[]"],
    ["item sem product_id", '[{"offer_codes":["a"]}]'],
    ["item null", "[null]"],
    ["product_id vazio", '[{"product_id":"  "}]'],
    ["segundo item sem product_id", '[{"product_id":"1"},{}]'],
  ])("400 quando %s", async (_name, value) => {
    const { GET } = await import("../route");
    const res = await GET(value === null ? get(DATES) : withProducts(value));
    expect(res.status).toBe(400);
  });

  it("200 com totals, daily_series e products; ignora os parâmetros antigos", async () => {
    supabase.setRows("dash_gestao_hotmart_sales", [
      {
        product_id: "1",
        status: "APPROVED",
        product_name: "P1",
        price: 10,
        currency: "BRL",
        purchase_date: "2026-05-01T15:00:00.000Z",
        offer_code: "A",
        offer_name: "Oferta A",
      },
    ]);
    const { GET } = await import("../route");

    const res = await GET(get(`${DATES}&product_id=zzz&products=${encodeURIComponent('[{"product_id":"1"}]')}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totals.total_sales).toBe(1);
    expect(body.products).toHaveLength(1);
    expect(body.daily_series).toHaveLength(2);
    expect(body).not.toHaveProperty("available_offers");
  });
});
