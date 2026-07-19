import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "gestor" }),
}));

const mockCycleSingle = jest.fn();
const mockBuyersEq = jest.fn();
const mockRpc = jest.fn();

const mockFrom = jest.fn((table: string) => {
  if (table === "dash_gestao_ultimates_cycles") {
    return { select: () => ({ eq: () => ({ single: mockCycleSingle }) }) };
  }
  if (table === "dash_gestao_ultimates_buyers") {
    return { select: () => ({ eq: mockBuyersEq }) };
  }
  throw new Error(`unexpected table ${table}`);
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn().mockReturnValue({ from: mockFrom, rpc: mockRpc }),
}));

import { requireRole } from "@/lib/utils/api-auth";

function makeRequest(url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { "content-type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const CYCLE_ID = "cycle-1";
const URL = `http://localhost/api/ultimates/cycles/${CYCLE_ID}/buyers`;

beforeEach(() => {
  jest.clearAllMocks();
  (requireRole as jest.Mock).mockResolvedValue({ error: null, userId: "test-user", role: "gestor" });
  mockCycleSingle.mockResolvedValue({ data: { id: CYCLE_ID, status: "ativo" }, error: null });
  mockBuyersEq.mockResolvedValue({ data: [], error: null });
  mockRpc.mockResolvedValue({ data: [{ removed: 0, updated: 0, inserted: 0 }], error: null });
});

describe("POST /api/ultimates/cycles/[id]/buyers — gates", () => {
  it("returns 401 when there is no session", async () => {
    const { NextResponse } = await import("next/server");
    (requireRole as jest.Mock).mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "gestor",
    });

    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "preview", rows: [] });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(401);
  });

  it("returns 403 for analista/comum", async () => {
    const { NextResponse } = await import("next/server");
    (requireRole as jest.Mock).mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "preview", rows: [] });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(403);
  });

  it("requests gestor/analista role gate via requireRole", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "preview", rows: [] });
    await POST(req, makeParams(CYCLE_ID));
    expect(requireRole).toHaveBeenCalledWith(["gestor"]);
  });

  it("returns 404 when the cycle does not exist", async () => {
    mockCycleSingle.mockResolvedValue({ data: null, error: { code: "PGRST116", message: "not found" } });

    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "preview", rows: [] });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the cycle is encerrado", async () => {
    mockCycleSingle.mockResolvedValue({ data: { id: CYCLE_ID, status: "encerrado" }, error: null });

    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "commit", rows: [] });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(409);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid mode", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "delete-everything", rows: [] });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 when rows is missing", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "preview" });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 when rows is not an array", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "preview", rows: "not-an-array" });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the body is malformed JSON", async () => {
    const { POST } = await import("../route");
    const req = new NextRequest(URL, {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 when rows exceeds 20000 entries", async () => {
    const rows = Array.from({ length: 20001 }, (_, i) => ({ email: `user${i}@example.com` }));
    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "preview", rows });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/ultimates/cycles/[id]/buyers — mode: preview", () => {
  it("computes leaving/entering against the current base and writes nothing", async () => {
    mockBuyersEq.mockResolvedValue({
      data: [{ email: "a@x.com" }, { email: "b@x.com" }, { email: "c@x.com" }],
      error: null,
    });

    const { POST } = await import("../route");
    const req = makeRequest(URL, {
      mode: "preview",
      rows: [{ email: "b@x.com" }, { email: "c@x.com" }, { email: "d@x.com" }],
    });
    const res = await POST(req, makeParams(CYCLE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.currentCount).toBe(3);
    expect(body.newCount).toBe(3);
    expect(body.leaving).toEqual(["a@x.com"]);
    expect(body.entering).toEqual(["d@x.com"]);
    expect(body.invalidRows).toEqual([]);
    expect(body.duplicates).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("normalizes emails (trim + lowercase) before comparing", async () => {
    mockBuyersEq.mockResolvedValue({ data: [{ email: "a@x.com" }], error: null });

    const { POST } = await import("../route");
    const req = makeRequest(URL, {
      mode: "preview",
      rows: [{ email: "  A@X.com  " }],
    });
    const res = await POST(req, makeParams(CYCLE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.leaving).toEqual([]);
    expect(body.entering).toEqual([]);
  });

  it("reports invalid rows without aborting the request", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(URL, {
      mode: "preview",
      rows: [
        { email: "valid@x.com" },
        { email: "not-an-email" },
        { email: "" },
        { email: "ok@x.com", extra: ["not", "an", "object"] },
        { email: "ok2@x.com", name: 123 },
      ],
    });
    const res = await POST(req, makeParams(CYCLE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invalidRows).toHaveLength(4);
    expect(body.invalidRows.map((r: { index: number }) => r.index)).toEqual([1, 2, 3, 4]);
    expect(body.newCount).toBe(1);
  });

  it("dedupes rows by normalized email keeping the last occurrence and reports duplicates", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(URL, {
      mode: "preview",
      rows: [
        { email: "dup@x.com", name: "First" },
        { email: "unique@x.com", name: "Solo" },
        { email: "DUP@x.com", name: "Last" },
      ],
    });
    const res = await POST(req, makeParams(CYCLE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.newCount).toBe(2);
    expect(body.duplicates).toEqual(["dup@x.com"]);
  });
});

describe("POST /api/ultimates/cycles/[id]/buyers — mode: commit", () => {
  it("calls the atomic replace RPC exactly once with normalized rows", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(URL, {
      mode: "commit",
      rows: [
        { email: "  A@x.com  ", name: "Ana", phone: "123", extra: { plan: "pro" } },
        { email: "b@x.com" },
      ],
    });
    const res = await POST(req, makeParams(CYCLE_ID));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_replace_buyers", {
      p_cycle_id: CYCLE_ID,
      p_rows: [
        { email: "a@x.com", name: "Ana", phone: "123", extra: { plan: "pro" } },
        { email: "b@x.com", name: null, phone: null, extra: {} },
      ],
    });
  });

  it("returns removed/updated/inserted counters from the RPC plus invalidRows/duplicates", async () => {
    mockRpc.mockResolvedValue({ data: [{ removed: 2, updated: 1, inserted: 3 }], error: null });

    const { POST } = await import("../route");
    const req = makeRequest(URL, {
      mode: "commit",
      rows: [{ email: "ok@x.com" }, { email: "bad-email" }, { email: "ok@x.com" }],
    });
    const res = await POST(req, makeParams(CYCLE_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      removed: 2,
      updated: 1,
      inserted: 3,
      invalidRows: [{ index: 1, email: "bad-email", reason: "email inválido" }],
      duplicates: ["ok@x.com"],
    });
  });

  it("returns 500 when the RPC errors", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "db exploded" } });

    const { POST } = await import("../route");
    const req = makeRequest(URL, { mode: "commit", rows: [{ email: "ok@x.com" }] });
    const res = await POST(req, makeParams(CYCLE_ID));
    expect(res.status).toBe(500);
  });
});
