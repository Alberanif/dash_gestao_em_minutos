import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });

  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });

  mockSingle.mockResolvedValue({ data: { id: "cycle-1" }, error: null });
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe("GET /api/vendas/cycles/[id]/hourly", () => {
  it("returns 403 when role is not gestor/analista", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/vendas/cycles/cycle-1/hourly"), makeParams("cycle-1"));

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
  });

  it("returns 404 when cycle does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116", message: "no rows" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/vendas/cycles/missing/hourly"), makeParams("missing"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls the hourly RPC with the cycle id and returns hours", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { hour: "2026-07-01T20", renewals: 3, new_buyers: 1 },
        { hour: "2026-07-01T21", renewals: 5, new_buyers: 0 },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/vendas/cycles/cycle-1/hourly"), makeParams("cycle-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_vendas_hourly", { p_cycle_id: "cycle-1" });
    expect(body.hours).toEqual([
      { hour: "2026-07-01T20", renewals: 3, new_buyers: 1 },
      { hour: "2026-07-01T21", renewals: 5, new_buyers: 0 },
    ]);
  });

  it("coerces renewals and new_buyers from bigint strings returned by PostgREST", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ hour: "2026-07-01T20", renewals: "3", new_buyers: "2" }],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/vendas/cycles/cycle-1/hourly"), makeParams("cycle-1"));
    const body = await res.json();

    expect(body.hours[0].renewals).toBe(3);
    expect(typeof body.hours[0].renewals).toBe("number");
    expect(body.hours[0].new_buyers).toBe(2);
    expect(typeof body.hours[0].new_buyers).toBe("number");
  });

  // A hora tem que atravessar a rota INTACTA: qualquer normalização aqui
  // (Date, toISOString) a reinterpretaria fora de America/Sao_Paulo.
  it("passes the hour bucket through untouched", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ hour: "2026-07-01T00", renewals: 1, new_buyers: 0 }],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/vendas/cycles/cycle-1/hourly"), makeParams("cycle-1"));
    const body = await res.json();

    expect(body.hours[0].hour).toBe("2026-07-01T00");
  });

  it("returns 500 when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/vendas/cycles/cycle-1/hourly"), makeParams("cycle-1"));

    expect(res.status).toBe(500);
  });
});
