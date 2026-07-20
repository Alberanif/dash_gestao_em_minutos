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

describe("GET /api/ultimates/cycles/[id]/daily", () => {
  it("returns 403 when role is not gestor/analista", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/daily"), makeParams("cycle-1"));

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
  });

  it("returns 404 when cycle does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116", message: "no rows" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/missing/daily"), makeParams("missing"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls the daily RPC with the cycle id and returns days", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { day: "2026-07-01", renewals: 3 },
        { day: "2026-07-02", renewals: 5 },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/daily"), makeParams("cycle-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_daily", { p_cycle_id: "cycle-1" });
    expect(body.days).toEqual([
      { day: "2026-07-01", renewals: 3 },
      { day: "2026-07-02", renewals: 5 },
    ]);
  });

  it("coerces renewals from a bigint string returned by PostgREST", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ day: "2026-07-01", renewals: "3" }],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/daily"), makeParams("cycle-1"));
    const body = await res.json();

    expect(body.days[0].renewals).toBe(3);
    expect(typeof body.days[0].renewals).toBe("number");
  });

  it("returns 500 when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/daily"), makeParams("cycle-1"));

    expect(res.status).toBe(500);
  });
});
