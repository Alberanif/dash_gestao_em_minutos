import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockListAllUsers = jest.fn();
jest.mock("@/lib/supabase/list-all-users", () => ({
  listAllUsers: (...args: unknown[]) => mockListAllUsers(...args),
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

// Terminais de cada tabela — cada teste decide o que o banco devolve sem
// precisar montar a cadeia de builders do client Supabase.
const cycleSingle = jest.fn();
const excludedOrder = jest.fn();
const buyerNamesIn = jest.fn();
const buyerSingle = jest.fn();
const insertSingle = jest.fn();
const mockInsert = jest.fn();
const deleteSelect = jest.fn();
const deleteEqEmail = jest.fn();
const deleteEqCycle = jest.fn();
const mockDelete = jest.fn();
// Guarda os argumentos dos .eq() da consulta de validação da base, para provar
// que o email chega normalizado ao banco.
const buyerLookupEq = jest.fn();

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/vendas/cycles/c1/excluded-buyers", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

const params = { params: Promise.resolve({ id: "c1" }) };

beforeEach(() => {
  jest.clearAllMocks();

  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });
  mockListAllUsers.mockResolvedValue({ users: [], error: null });

  cycleSingle.mockResolvedValue({
    data: { id: "c1", status: "ativo" },
    error: null,
  });
  excludedOrder.mockResolvedValue({ data: [], error: null });
  buyerNamesIn.mockResolvedValue({ data: [], error: null });
  buyerSingle.mockResolvedValue({
    data: { id: "b-1", email: "teste@empresa.com", name: "Teste Interno" },
    error: null,
  });
  insertSingle.mockResolvedValue({ data: { id: "eb-1" }, error: null });
  mockInsert.mockReturnValue({ select: () => ({ single: insertSingle }) });
  deleteSelect.mockResolvedValue({ data: [{ id: "eb-1" }], error: null });
  deleteEqEmail.mockReturnValue({ select: deleteSelect });
  deleteEqCycle.mockReturnValue({ eq: deleteEqEmail });
  mockDelete.mockReturnValue({ eq: deleteEqCycle });
  buyerLookupEq.mockImplementation(() => ({ eq: buyerLookupEq, single: buyerSingle }));

  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case "dash_gestao_vendas_cycles":
        return { select: () => ({ eq: () => ({ single: cycleSingle }) }) };
      case "dash_gestao_vendas_excluded_buyers":
        return {
          select: () => ({ eq: () => ({ order: excludedOrder }) }),
          insert: mockInsert,
          delete: mockDelete,
        };
      case "dash_gestao_vendas_buyers":
        return {
          select: () => ({ eq: (...args: unknown[]) => ({ in: buyerNamesIn, ...buyerLookupEq(...args) }) }),
        };
      default:
        throw new Error(`tabela inesperada: ${table}`);
    }
  });
});

describe("GET /api/vendas/cycles/[id]/excluded-buyers", () => {
  it("allows gestor and analista to read the list", async () => {
    const { GET } = await import("../route");
    await GET(makeRequest("GET"), params);

    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
  });

  it("returns 403 when the role gate rejects", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"), params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when the cycle does not exist", async () => {
    cycleSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
  });

  it("returns each excluded buyer with the name from the base and the email of who excluded it", async () => {
    excludedOrder.mockResolvedValueOnce({
      data: [
        {
          id: "eb-1",
          cycle_id: "c1",
          email: "teste@empresa.com",
          note: "email interno",
          excluded_by: "user-9",
          created_at: "2026-07-30T12:00:00Z",
        },
      ],
      error: null,
    });
    buyerNamesIn.mockResolvedValueOnce({
      data: [{ email: "teste@empresa.com", name: "Teste Interno" }],
      error: null,
    });
    mockListAllUsers.mockResolvedValueOnce({
      users: [{ id: "user-9", email: "gestor@empresa.com" }],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.buyers).toEqual([
      {
        id: "eb-1",
        email: "teste@empresa.com",
        name: "Teste Interno",
        note: "email interno",
        excluded_by: "user-9",
        excluded_by_email: "gestor@empresa.com",
        created_at: "2026-07-30T12:00:00Z",
      },
    ]);
  });

  it("returns name null when the excluded email is no longer in the base", async () => {
    excludedOrder.mockResolvedValueOnce({
      data: [
        {
          id: "eb-1",
          cycle_id: "c1",
          email: "sumiu@empresa.com",
          note: null,
          excluded_by: "user-9",
          created_at: "2026-07-30T12:00:00Z",
        },
      ],
      error: null,
    });
    buyerNamesIn.mockResolvedValueOnce({ data: [], error: null });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"), params);
    const body = await res.json();

    expect(body.buyers[0].name).toBeNull();
    expect(body.buyers[0].excluded_by_email).toBeNull();
  });
});

describe("POST /api/vendas/cycles/[id]/excluded-buyers", () => {
  it("restricts the write to gestor", async () => {
    const { POST } = await import("../route");
    await POST(makeRequest("POST", { email: "teste@empresa.com" }), params);

    expect(mockRequireRole).toHaveBeenCalledWith(["gestor"]);
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", {}), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("email é obrigatório");
  });

  it("normalizes the email before touching the database", async () => {
    const { POST } = await import("../route");
    await POST(makeRequest("POST", { email: "  Teste@Empresa.COM  " }), params);

    expect(buyerLookupEq).toHaveBeenCalledWith("email", "teste@empresa.com");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "teste@empresa.com" })
    );
  });

  it("stores the author and the optional note", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", { email: "teste@empresa.com", note: "  email interno  " }),
      params
    );

    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith({
      cycle_id: "c1",
      email: "teste@empresa.com",
      note: "email interno",
      excluded_by: "user-1",
    });
  });

  it("stores note as null when it is absent", async () => {
    const { POST } = await import("../route");
    await POST(makeRequest("POST", { email: "teste@empresa.com" }), params);

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it("returns 404 when the cycle does not exist", async () => {
    cycleSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { email: "teste@empresa.com" }), params);

    expect(res.status).toBe(404);
  });

  it("returns 400 when the email does not belong to this cycle's base", async () => {
    buyerSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { email: "fora@empresa.com" }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Email não pertence à base deste ciclo");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 409 when the buyer is already excluded", async () => {
    insertSingle.mockResolvedValueOnce({ data: null, error: { code: "23505" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { email: "teste@empresa.com" }), params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Lead já excluído neste ciclo");
  });

  it("accepts the write on an encerrado cycle", async () => {
    cycleSingle.mockResolvedValueOnce({
      data: { id: "c1", status: "encerrado" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { email: "teste@empresa.com" }), params);

    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/vendas/cycles/[id]/excluded-buyers", () => {
  it("restricts the removal to gestor", async () => {
    const { DELETE } = await import("../route");
    await DELETE(makeRequest("DELETE", { email: "teste@empresa.com" }), params);

    expect(mockRequireRole).toHaveBeenCalledWith(["gestor"]);
  });

  it("returns 400 when email is missing", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", {}), params);

    expect(res.status).toBe(400);
  });

  it("scopes the removal by cycle and normalized email", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { email: " Teste@Empresa.com " }), params);

    expect(res.status).toBe(204);
    expect(deleteEqCycle).toHaveBeenCalledWith("cycle_id", "c1");
    expect(deleteEqEmail).toHaveBeenCalledWith("email", "teste@empresa.com");
  });

  it("returns 404 when the buyer is not excluded in this cycle", async () => {
    deleteSelect.mockResolvedValueOnce({ data: [], error: null });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { email: "teste@empresa.com" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Lead não está excluído neste ciclo");
  });

  it("accepts the removal on an encerrado cycle", async () => {
    cycleSingle.mockResolvedValueOnce({
      data: { id: "c1", status: "encerrado" },
      error: null,
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { email: "teste@empresa.com" }), params);

    expect(res.status).toBe(204);
  });
});
