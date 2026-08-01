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

const mockCycleProductsSelect = jest.fn();
const mockCycleProductsIn = jest.fn();

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
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

  mockCycleProductsSelect.mockReturnValue({ in: mockCycleProductsIn });
  mockCycleProductsIn.mockResolvedValue({ data: [], error: null });

  mockRpc.mockResolvedValue({ data: null, error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === "dash_gestao_ultimates_cycles") {
      return { select: mockCyclesSelect, insert: mockCyclesInsert };
    }
    if (table === "dash_gestao_hotmart_products") {
      return { select: mockProductsSelect };
    }
    if (table === "dash_gestao_ultimates_cycle_products") {
      return { select: mockCycleProductsSelect };
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

  it("lista ciclos com o conjunto de produtos de cada um", async () => {
    const cycles = [
      {
        id: "c1",
        name: "Ciclo 1",
        account_id: "acc-1",
        goal_percent: 50,
        status: "ativo",
        counts_new_buyers: true,
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
        goal_percent: null,
        status: "encerrado",
        counts_new_buyers: true,
        refresh_started_at: null,
        last_refresh_at: null,
        created_by: "user-1",
        created_at: "2026-07-18T00:00:00Z",
        updated_at: "2026-07-18T00:00:00Z",
      },
    ];
    mockCyclesOrder.mockResolvedValueOnce({ data: cycles, error: null });
    mockCycleProductsIn.mockResolvedValueOnce({
      // Ordem de chegada DELIBERADAMENTE oposta à alfabética: p1 ("Produto Um")
      // antes de p2 ("Produto Dois"). Se o sort do GET sumir, a asserção abaixo
      // falha. Com os dois na ordem alfabética o teste passaria verde sem sort.
      data: [
        { cycle_id: "c1", product_id: "p1" },
        { cycle_id: "c1", product_id: "p2" },
        { cycle_id: "c2", product_id: "p2" },
      ],
      error: null,
    });
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
    // Ordenados por nome dentro do ciclo, para o header ser determinístico.
    expect(body.cycles[0].products).toEqual([
      { product_id: "p2", product_name: "Produto Dois" },
      { product_id: "p1", product_name: "Produto Um" },
    ]);
    expect(body.cycles[1].products).toEqual([
      { product_id: "p2", product_name: "Produto Dois" },
    ]);
  });

  it("produto não sincronizado entra com product_name null", async () => {
    mockCyclesOrder.mockResolvedValueOnce({
      data: [{ id: "c1", name: "Ciclo 1", account_id: "acc-1", status: "ativo", created_at: "2026-07-19T00:00:00Z" }],
      error: null,
    });
    mockCycleProductsIn.mockResolvedValueOnce({
      data: [{ cycle_id: "c1", product_id: "desconhecido" }],
      error: null,
    });
    mockProductsIn.mockResolvedValueOnce({ data: [], error: null });

    const { GET } = await import("../route");
    const body = await (await GET()).json();

    expect(body.cycles[0].products).toEqual([
      { product_id: "desconhecido", product_name: null },
    ]);
  });

  it("keeps encerrado cycles in the listing", async () => {
    const cycles = [
      {
        id: "c2",
        name: "Encerrado",
        account_id: "acc-1",
        goal_percent: null,
        status: "encerrado",
        counts_new_buyers: true,
        refresh_started_at: null,
        last_refresh_at: null,
        created_by: "user-1",
        created_at: "2026-07-18T00:00:00Z",
        updated_at: "2026-07-18T00:00:00Z",
      },
    ];
    mockCyclesOrder.mockResolvedValueOnce({ data: cycles, error: null });
    // Sem par nenhum na junção, allProductIds fica vazio e o GET pula a
    // consulta de nomes — não empilhar mockProductsIn aqui: um once não
    // consumido vaza para o describe de POST (jest.clearAllMocks() não drena
    // a fila de mockResolvedValueOnce, só mockReset faria isso).
    mockCycleProductsIn.mockResolvedValueOnce({ data: [], error: null });

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
      productIds: ["p1"],
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
      productIds: ["p1"],
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
      productIds: ["p1"],
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is empty", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "   ",
      productIds: ["p1"],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when goalPercent is not numeric", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productIds: ["p1"],
      goalPercent: "abc",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when goalPercent is out of 0-100 range", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productIds: ["p1"],
      goalPercent: 150,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when productIds is missing or empty", async () => {
    const { POST } = await import("../route");

    for (const body of [
      { name: "Ciclo X" },
      { name: "Ciclo X", productIds: [] },
      { name: "Ciclo X", productIds: "p1" },
    ]) {
      const res = await POST(makeRequest("POST", "http://localhost/api/ultimates/cycles", body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/ao menos um produto/i);
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 with sync guidance when some product does not exist", async () => {
    // Pediu 2, o banco só conhece 1.
    mockProductsIn.mockResolvedValueOnce({
      data: [{ product_id: "p1", account_id: "acc-1" }],
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "Ciclo X",
        productIds: ["p1", "fantasma"],
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/sync-products/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 when products span more than one Hotmart account", async () => {
    mockProductsIn.mockResolvedValueOnce({
      data: [
        { product_id: "p1", account_id: "acc-1" },
        { product_id: "p2", account_id: "acc-2" },
      ],
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "Ciclo X",
        productIds: ["p1", "p2"],
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/mesma conta Hotmart/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("creates the cycle through the atomic RPC with deduplicated productIds", async () => {
    mockProductsIn.mockResolvedValueOnce({
      data: [
        { product_id: "p1", account_id: "acc-1" },
        { product_id: "p2", account_id: "acc-1" },
      ],
      error: null,
    });
    const created = {
      id: "new-cycle",
      name: "Ciclo X",
      account_id: "acc-1",
      goal_percent: 30,
      status: "ativo",
      counts_new_buyers: true,
      refresh_started_at: null,
      last_refresh_at: null,
      created_by: "user-1",
      created_at: "2026-07-30T00:00:00Z",
      updated_at: "2026-07-30T00:00:00Z",
    };
    mockRpc.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "  Ciclo X  ",
        productIds: ["p1", "p2", "p1"],
        goalPercent: 30,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.cycle).toEqual(created);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_create_cycle", {
      p_name: "Ciclo X",
      p_product_ids: ["p1", "p2"],
      p_goal_percent: 30,
      p_purchases_only: false,
      p_created_by: "user-1",
    });
  });

  it("sends goalPercent null when omitted", async () => {
    mockProductsIn.mockResolvedValueOnce({
      data: [{ product_id: "p1", account_id: "acc-1" }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: { id: "new-cycle" }, error: null });

    const { POST } = await import("../route");
    await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "Ciclo Sem Meta",
        productIds: ["p1"],
      })
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "dash_gestao_ultimates_create_cycle",
      expect.objectContaining({ p_goal_percent: null })
    );
  });

  // purchases_only viaja pela RPC atômica, não por um insert direto: o modo do
  // ciclo nasce junto com o ciclo e seus produtos, numa transação só.
  it("creates cycle with purchases_only true when purchasesOnly is true", async () => {
    mockProductsIn.mockResolvedValueOnce({
      data: [{ product_id: "p1", account_id: "acc-1" }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: { id: "new-cycle" }, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo Compras",
      productIds: ["p1"],
      purchasesOnly: true,
    });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      "dash_gestao_ultimates_create_cycle",
      expect.objectContaining({ p_purchases_only: true })
    );
  });

  it("defaults purchases_only to false when purchasesOnly is omitted", async () => {
    mockProductsIn.mockResolvedValueOnce({
      data: [{ product_id: "p1", account_id: "acc-1" }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: { id: "new-cycle" }, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo Renovação",
      productIds: ["p1"],
    });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith(
      "dash_gestao_ultimates_create_cycle",
      expect.objectContaining({ p_purchases_only: false })
    );
  });

  it("returns 400 when purchasesOnly is not boolean", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      productIds: ["p1"],
      purchasesOnly: "sim",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
