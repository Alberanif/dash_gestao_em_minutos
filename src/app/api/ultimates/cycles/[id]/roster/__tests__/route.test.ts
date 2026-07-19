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

describe("GET /api/ultimates/cycles/[id]/roster", () => {
  it("returns 403 when role is not gestor/analista", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
  });

  it("returns 404 when cycle does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116", message: "no rows" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/missing/roster"), makeParams("missing"));

    expect(res.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls the roster RPC with the cycle id and returns rows", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          buyer_id: "b1",
          name: "Ana",
          email: "ana@x.com",
          phone: null,
          extra: {},
          category: "renovado",
          renewed_at: "2026-01-01T00:00:00Z",
          total_value: 199.9,
          transaction_code: "T1",
        },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_roster", { p_cycle_id: "cycle-1" });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].email).toBe("ana@x.com");
  });

  it("coerces total_value from a numeric string returned by PostgREST", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          buyer_id: "b1",
          name: "Ana",
          email: "ana@x.com",
          phone: null,
          extra: {},
          category: "renovado",
          renewed_at: "2026-01-01T00:00:00Z",
          total_value: "199.90",
          transaction_code: "T1",
        },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));
    const body = await res.json();

    expect(body.rows[0].total_value).toBe(199.9);
    expect(typeof body.rows[0].total_value).toBe("number");
  });

  it("keeps total_value null when the RPC returns null", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          buyer_id: null,
          name: null,
          email: "novo@x.com",
          phone: null,
          extra: {},
          category: "novo_reembolsado",
          renewed_at: null,
          total_value: null,
          transaction_code: null,
        },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));
    const body = await res.json();

    expect(body.rows[0].total_value).toBeNull();
  });

  it("returns 500 when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));

    expect(res.status).toBe(500);
  });
});
