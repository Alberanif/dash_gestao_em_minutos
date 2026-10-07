import { NextRequest } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockRpc = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ rpc: mockRpc })),
}));

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/vendas/offer-options${query}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe("GET /api/vendas/offer-options", () => {
  it("permite gestor e analista", async () => {
    const { GET } = await import("../route");
    await GET(makeRequest("?product_id=p1"));
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
  });

  it("devolve a resposta do gate quando o papel é rejeitado", async () => {
    mockRequireRole.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });
    const { GET } = await import("../route");
    const res = await GET(makeRequest("?product_id=p1"));
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("400 sem product_id (ou só espaços)", async () => {
    const { GET } = await import("../route");
    for (const query of ["", "?product_id=", "?product_id=%20"]) {
      const res = await GET(makeRequest(query));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/product_id/);
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("devolve só { offers } de UM produto, com sales_count numérico", async () => {
    mockRpc.mockResolvedValue({
      data: [{ offer_code: "A", offer_name: "Oferta A", product_id: "p1", product_name: "P", sales_count: "7" }],
      error: null,
    });
    const { GET } = await import("../route");
    const res = await GET(makeRequest("?product_id=p1"));

    expect(await res.json()).toEqual({
      offers: [{ offer_code: "A", offer_name: "Oferta A", sales_count: 7 }],
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_vendas_offer_options", { p_product_ids: ["p1"] });
  });

  it("sales_count nulo vira 0, não NaN", async () => {
    mockRpc.mockResolvedValue({
      data: [{ offer_code: "A", offer_name: "A", sales_count: null }],
      error: null,
    });
    const { GET } = await import("../route");
    const body = await (await GET(makeRequest("?product_id=p1"))).json();
    expect(body.offers[0].sales_count).toBe(0);
  });

  it("erro da RPC => 500", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { GET } = await import("../route");
    expect((await GET(makeRequest("?product_id=p1"))).status).toBe(500);
  });
});
