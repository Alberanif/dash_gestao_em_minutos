import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockRpc = jest.fn();
const cycleSingle = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ultimates/cycles/c1/offer-options");
}

const params = { params: Promise.resolve({ id: "c1" }) };

beforeEach(() => {
  jest.clearAllMocks();

  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });
  cycleSingle.mockResolvedValue({ data: { id: "c1" }, error: null });
  mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ single: cycleSingle }) }) });
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe("GET /api/ultimates/cycles/[id]/offer-options", () => {
  it("allows gestor and analista", async () => {
    const { GET } = await import("../route");
    await GET(makeRequest(), params);

    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
  });

  it("returns 403 when the role gate rejects", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when the cycle does not exist", async () => {
    cycleSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
  });

  it("returns the cycle's offers with sales_count as a number", async () => {
    // PostgREST serializa bigint como string — a UI ordena e compara esse
    // valor, então ele não pode chegar como texto.
    mockRpc.mockResolvedValueOnce({
      data: [
        { offer_code: "PRINCIPAL", offer_name: "Oferta principal", sales_count: "412", is_excluded: false },
        { offer_code: "TESTE", offer_name: "Oferta interna", sales_count: "3", is_excluded: true },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_offer_options", {
      p_cycle_id: "c1",
    });
    expect(body.offers).toEqual([
      { offer_code: "PRINCIPAL", offer_name: "Oferta principal", sales_count: 412, is_excluded: false },
      { offer_code: "TESTE", offer_name: "Oferta interna", sales_count: 3, is_excluded: true },
    ]);
  });

  it("returns 500 when the RPC fails", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest(), params);

    expect(res.status).toBe(500);
  });

  it("repassa produto da oferta e normaliza sales_count vindo como string", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          offer_code: "OF1",
          offer_name: "Oferta padrão",
          product_id: "p1",
          product_name: "Anual",
          sales_count: "12",
          is_excluded: false,
        },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const body = await (await GET(makeRequest(), params)).json();

    expect(body.offers[0]).toEqual({
      offer_code: "OF1",
      offer_name: "Oferta padrão",
      product_id: "p1",
      product_name: "Anual",
      sales_count: 12,
      is_excluded: false,
    });
  });
});
