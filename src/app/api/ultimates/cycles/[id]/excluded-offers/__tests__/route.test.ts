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
const cycleProductsEq = jest.fn();
const excludedOrder = jest.fn();
const offerNamesIn = jest.fn();
const offerSingle = jest.fn();
const insertSingle = jest.fn();
const mockInsert = jest.fn();
const deleteSelect = jest.fn();
const deleteEqOffer = jest.fn();
const deleteEqCycle = jest.fn();
const mockDelete = jest.fn();

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/ultimates/cycles/c1/excluded-offers", {
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
  cycleProductsEq.mockResolvedValue({ data: [{ product_id: "PROD1" }], error: null });
  excludedOrder.mockResolvedValue({ data: [], error: null });
  offerNamesIn.mockResolvedValue({ data: [], error: null });
  offerSingle.mockResolvedValue({
    data: { offer_code: "OFERTA_TESTE", offer_name: "Oferta interna", product_id: "PROD1" },
    error: null,
  });
  insertSingle.mockResolvedValue({ data: null, error: null });
  mockInsert.mockReturnValue({ select: () => ({ single: insertSingle }) });
  deleteSelect.mockResolvedValue({ data: [{ id: "eo-1" }], error: null });
  deleteEqOffer.mockReturnValue({ select: deleteSelect });
  deleteEqCycle.mockReturnValue({ eq: deleteEqOffer });
  mockDelete.mockReturnValue({ eq: deleteEqCycle });

  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case "dash_gestao_ultimates_cycles":
        return { select: () => ({ eq: () => ({ single: cycleSingle }) }) };
      case "dash_gestao_ultimates_excluded_offers":
        return {
          select: () => ({ eq: () => ({ order: excludedOrder }) }),
          insert: mockInsert,
          delete: mockDelete,
        };
      case "dash_gestao_hotmart_offers":
        return { select: () => ({ in: offerNamesIn, eq: () => ({ single: offerSingle }) }) };
      case "dash_gestao_ultimates_cycle_products":
        return { select: () => ({ eq: cycleProductsEq }) };
      default:
        throw new Error(`tabela inesperada: ${table}`);
    }
  });
});

describe("GET /api/ultimates/cycles/[id]/excluded-offers", () => {
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

  it("returns each excluded offer with its offer name and the email of who excluded it", async () => {
    excludedOrder.mockResolvedValueOnce({
      data: [
        {
          id: "eo-1",
          cycle_id: "c1",
          offer_code: "OFERTA_TESTE",
          note: "compras da equipe",
          excluded_by: "user-1",
          created_at: "2026-07-30T12:00:00Z",
        },
      ],
      error: null,
    });
    offerNamesIn.mockResolvedValueOnce({
      data: [{ offer_code: "OFERTA_TESTE", offer_name: "Oferta interna" }],
      error: null,
    });
    mockListAllUsers.mockResolvedValueOnce({
      users: [{ id: "user-1", email: "gestor@ex.com" }],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.offers).toEqual([
      {
        id: "eo-1",
        offer_code: "OFERTA_TESTE",
        offer_name: "Oferta interna",
        note: "compras da equipe",
        excluded_by: "user-1",
        excluded_by_email: "gestor@ex.com",
        created_at: "2026-07-30T12:00:00Z",
      },
    ]);
  });

  it("still returns the list when the author lookup fails", async () => {
    excludedOrder.mockResolvedValueOnce({
      data: [
        {
          id: "eo-1",
          cycle_id: "c1",
          offer_code: "OFERTA_TESTE",
          note: null,
          excluded_by: "user-1",
          created_at: "2026-07-30T12:00:00Z",
        },
      ],
      error: null,
    });
    offerNamesIn.mockResolvedValueOnce({ data: [], error: null });
    mockListAllUsers.mockResolvedValueOnce({ users: [], error: "auth indisponível" });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.offers[0].excluded_by_email).toBeNull();
    // Sem nome sincronizado, o código continua identificando a oferta.
    expect(body.offers[0].offer_name).toBeNull();
  });

  it("returns 500 when the list query fails", async () => {
    excludedOrder.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"), params);

    expect(res.status).toBe(500);
  });
});

describe("POST /api/ultimates/cycles/[id]/excluded-offers", () => {
  const created = {
    id: "eo-1",
    cycle_id: "c1",
    offer_code: "OFERTA_TESTE",
    note: "compras da equipe",
    excluded_by: "user-1",
    created_at: "2026-07-30T12:00:00Z",
  };

  it("returns 403 when the role is not gestor", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { offerCode: "OFERTA_TESTE" }), params);

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor"]);
  });

  it("returns 400 when offerCode is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { note: "sem código" }), params);

    expect(res.status).toBe(400);
  });

  it("returns 404 when the cycle does not exist", async () => {
    cycleSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { offerCode: "OFERTA_TESTE" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
  });

  it("returns 400 when the offer does not exist", async () => {
    offerSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { offerCode: "INEXISTENTE" }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Oferta não encontrada para os produtos deste ciclo");
  });

  it("returns 400 when the offer belongs to another product", async () => {
    offerSingle.mockResolvedValueOnce({
      data: { offer_code: "OUTRA", offer_name: "De outro produto", product_id: "PROD2" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { offerCode: "OUTRA" }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Oferta não encontrada para os produtos deste ciclo");
  });

  it("aceita oferta do segundo produto do ciclo", async () => {
    cycleProductsEq.mockResolvedValueOnce({
      data: [{ product_id: "PROD1" }, { product_id: "PROD2" }],
      error: null,
    });
    offerSingle.mockResolvedValueOnce({
      data: { offer_code: "OF2", offer_name: "Do segundo produto", product_id: "PROD2" },
      error: null,
    });
    insertSingle.mockResolvedValueOnce({ data: { id: "e1" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { offerCode: "OF2" }), params);

    expect(res.status).toBe(201);
  });

  it("recusa oferta de produto fora do ciclo", async () => {
    cycleProductsEq.mockResolvedValueOnce({ data: [{ product_id: "PROD1" }], error: null });
    offerSingle.mockResolvedValueOnce({
      data: { offer_code: "OUTRA", offer_name: "De outro produto", product_id: "PROD9" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { offerCode: "OUTRA" }), params);

    expect(res.status).toBe(400);
  });

  it("returns 409 when the offer is already excluded in this cycle", async () => {
    insertSingle.mockResolvedValueOnce({ data: null, error: { code: "23505" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { offerCode: "OFERTA_TESTE" }), params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Oferta já excluída neste ciclo");
  });

  it("records the offer with the note and the authenticated user, returning 201", async () => {
    insertSingle.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", { offerCode: "OFERTA_TESTE", note: "  compras da equipe  " }),
      params
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.offer).toEqual(created);
    expect(mockInsert).toHaveBeenCalledWith({
      cycle_id: "c1",
      offer_code: "OFERTA_TESTE",
      note: "compras da equipe",
      excluded_by: "user-1",
    });
  });

  it("stores an empty note as null", async () => {
    insertSingle.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    await POST(makeRequest("POST", { offerCode: "OFERTA_TESTE", note: "   " }), params);

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it("accepts the write on an encerrado cycle", async () => {
    cycleSingle.mockResolvedValueOnce({
      data: { id: "c1", status: "encerrado" },
      error: null,
    });
    insertSingle.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { offerCode: "OFERTA_TESTE" }), params);

    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/ultimates/cycles/[id]/excluded-offers", () => {
  it("returns 403 when the role is not gestor", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { offerCode: "OFERTA_TESTE" }), params);

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor"]);
  });

  it("returns 400 when offerCode is missing", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", {}), params);

    expect(res.status).toBe(400);
  });

  it("returns 404 when the cycle does not exist", async () => {
    cycleSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { offerCode: "OFERTA_TESTE" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
  });

  it("returns 404 when the offer is not on this cycle's list", async () => {
    deleteSelect.mockResolvedValueOnce({ data: [], error: null });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { offerCode: "NAO_EXCLUIDA" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Oferta não está excluída neste ciclo");
  });

  it("removes only the row of this cycle and returns 204", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { offerCode: "OFERTA_TESTE" }), params);

    expect(res.status).toBe(204);
    // Sem o escopo do ciclo, remover uma oferta apagaria a exclusão de outros
    // ciclos do mesmo produto.
    expect(deleteEqCycle).toHaveBeenCalledWith("cycle_id", "c1");
    expect(deleteEqOffer).toHaveBeenCalledWith("offer_code", "OFERTA_TESTE");
  });

  it("accepts the removal on an encerrado cycle", async () => {
    cycleSingle.mockResolvedValueOnce({
      data: { id: "c1", status: "encerrado" },
      error: null,
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { offerCode: "OFERTA_TESTE" }), params);

    expect(res.status).toBe(204);
  });
});
