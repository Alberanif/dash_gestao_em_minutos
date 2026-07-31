import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: jest.fn(),
}));

const mockCyclesSelect = jest.fn();
const mockCyclesOrder = jest.fn();
const mockCyclesInsert = jest.fn();
const mockCyclesInsertSelect = jest.fn();
const mockCyclesInsertSingle = jest.fn();

const mockProductsSelect = jest.fn();
const mockProductsIn = jest.fn();
const mockProductsEq = jest.fn();
const mockProductsSingle = jest.fn();

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

function makeRequest(method: string, url: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

function requireRoleMock() {
  return jest.requireMock("@/lib/utils/api-auth").requireRole as jest.Mock;
}

beforeEach(() => {
  jest.clearAllMocks();

  requireRoleMock().mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });

  mockCyclesSelect.mockReturnValue({ order: mockCyclesOrder });
  mockCyclesOrder.mockResolvedValue({ data: [], error: null });

  mockCyclesInsert.mockReturnValue({ select: mockCyclesInsertSelect });
  mockCyclesInsertSelect.mockReturnValue({ single: mockCyclesInsertSingle });
  mockCyclesInsertSingle.mockResolvedValue({ data: null, error: null });

  mockProductsSelect.mockReturnValue({ in: mockProductsIn, eq: mockProductsEq });
  mockProductsIn.mockResolvedValue({ data: [], error: null });
  mockProductsEq.mockReturnValue({ single: mockProductsSingle });
  mockProductsSingle.mockResolvedValue({ data: null, error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === "dash_gestao_ultimates_cycles") {
      return { select: mockCyclesSelect, insert: mockCyclesInsert };
    }
    if (table === "dash_gestao_hotmart_products") {
      return { select: mockProductsSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
});

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/ultimates/cycles", () => {
  it("returns 401 when there is no session", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "gestor",
    });

    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for role comum", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("lists cycles ordered by created_at desc with product_name attached", async () => {
    const cycles = [
      {
        id: "c1",
        name: "Ciclo 1",
        account_id: "acc-1",
        product_id: "p1",
        goal_percent: 50,
        status: "ativo",
        refresh_started_at: null,
        last_refresh_at: null,
        created_by: "user-1",
        created_at: "2026-07-19T00:00:00Z",
        updated_at: "2026-07-19T00:00:00Z",
      },
      {
        id: "c2",
        name: "Ciclo 2 encerrado",
        account_id: "acc-1",
        product_id: "p2",
        goal_percent: null,
        status: "encerrado",
        refresh_started_at: null,
        last_refresh_at: null,
        created_by: "user-1",
        created_at: "2026-07-18T00:00:00Z",
        updated_at: "2026-07-18T00:00:00Z",
      },
    ];
    mockCyclesOrder.mockResolvedValueOnce({ data: cycles, error: null });
    mockProductsIn.mockResolvedValueOnce({
      data: [
        { product_id: "p1", product_name: "Produto Um" },
        { product_id: "p2", product_name: "Produto Dois" },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCyclesOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(body.cycles).toHaveLength(2);
    expect(body.cycles[0]).toMatchObject({ id: "c1", product_name: "Produto Um" });
    expect(body.cycles[1]).toMatchObject({ id: "c2", status: "encerrado", product_name: "Produto Dois" });
  });

  it("keeps encerrado cycles in the listing", async () => {
    const cycles = [
      {
        id: "c2",
        name: "Encerrado",
        account_id: "acc-1",
        product_id: "p2",
        goal_percent: null,
        status: "encerrado",
        refresh_started_at: null,
        last_refresh_at: null,
        created_by: "user-1",
        created_at: "2026-07-18T00:00:00Z",
        updated_at: "2026-07-18T00:00:00Z",
      },
    ];
    mockCyclesOrder.mockResolvedValueOnce({ data: cycles, error: null });
    mockProductsIn.mockResolvedValueOnce({ data: [{ product_id: "p2", product_name: "Produto Dois" }], error: null });

    const { GET } = await import("../route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cycles).toHaveLength(1);
    expect(body.cycles[0].status).toBe("encerrado");
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe("POST /api/ultimates/cycles", () => {
  it("returns 403 for role analista", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productId: "p1",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 for role comum", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productId: "p1",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 401 without session", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "gestor",
    });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productId: "p1",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is empty", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "   ",
      productId: "p1",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when goalPercent is not numeric", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productId: "p1",
      goalPercent: "abc",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when goalPercent is out of 0-100 range", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productId: "p1",
      goalPercent: 150,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 with sync guidance when product does not exist", async () => {
    mockProductsSingle.mockResolvedValueOnce({ data: null, error: { message: "No rows found" } });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productId: "unknown-product",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/sync-products/);
  });

  it("creates cycle with status ativo, account_id from product, and created_by from session", async () => {
    mockProductsSingle.mockResolvedValueOnce({ data: { account_id: "acc-1" }, error: null });
    const created = {
      id: "new-cycle",
      name: "Ciclo X",
      account_id: "acc-1",
      product_id: "p1",
      goal_percent: 30,
      status: "ativo",
      refresh_started_at: null,
      last_refresh_at: null,
      created_by: "user-1",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    };
    mockCyclesInsertSingle.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productId: "p1",
      goalPercent: 30,
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.cycle).toEqual(created);
    expect(mockCyclesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ciclo X",
        product_id: "p1",
        account_id: "acc-1",
        goal_percent: 30,
        status: "ativo",
        created_by: "user-1",
      })
    );
  });

  it("creates cycle without goalPercent when omitted", async () => {
    mockProductsSingle.mockResolvedValueOnce({ data: { account_id: "acc-1" }, error: null });
    mockCyclesInsertSingle.mockResolvedValueOnce({ data: { id: "new-cycle" }, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo Sem Meta",
      productId: "p1",
    });
    await POST(req);

    expect(mockCyclesInsert).toHaveBeenCalledWith(
      expect.objectContaining({ goal_percent: null })
    );
  });

  it("creates cycle with purchases_only true when purchasesOnly is true", async () => {
    mockProductsSingle.mockResolvedValueOnce({ data: { account_id: "acc-1" }, error: null });
    mockCyclesInsertSingle.mockResolvedValueOnce({ data: { id: "new-cycle" }, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo Compras",
      productId: "p1",
      purchasesOnly: true,
    });
    await POST(req);

    expect(mockCyclesInsert).toHaveBeenCalledWith(
      expect.objectContaining({ purchases_only: true })
    );
  });

  it("defaults purchases_only to false when purchasesOnly is omitted", async () => {
    mockProductsSingle.mockResolvedValueOnce({ data: { account_id: "acc-1" }, error: null });
    mockCyclesInsertSingle.mockResolvedValueOnce({ data: { id: "new-cycle" }, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo Renovação",
      productId: "p1",
    });
    await POST(req);

    expect(mockCyclesInsert).toHaveBeenCalledWith(
      expect.objectContaining({ purchases_only: false })
    );
  });

  it("returns 400 when purchasesOnly is not boolean", async () => {
    mockProductsSingle.mockResolvedValueOnce({ data: { account_id: "acc-1" }, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productId: "p1",
      purchasesOnly: "sim",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockCyclesInsert).not.toHaveBeenCalled();
  });
});
