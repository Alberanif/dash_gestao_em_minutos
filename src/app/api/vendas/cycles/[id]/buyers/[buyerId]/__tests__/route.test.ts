import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

const cycleSingle = jest.fn();
const updateSingle = jest.fn();
const updateEqCycle = jest.fn();
const updateEqId = jest.fn();
const mockUpdate = jest.fn();

function makeRequest(body?: object): NextRequest {
  return new NextRequest("http://localhost/api/vendas/cycles/c1/buyers/b1", {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

const params = { params: Promise.resolve({ id: "c1", buyerId: "b1" }) };

beforeEach(() => {
  jest.clearAllMocks();

  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });

  cycleSingle.mockResolvedValue({ data: { id: "c1", status: "ativo" }, error: null });
  updateSingle.mockResolvedValue({
    data: { id: "b1", email: "fulano@empresa.com", name: "Fulano", phone: "11999999999" },
    error: null,
  });
  updateEqCycle.mockReturnValue({ select: () => ({ single: updateSingle }) });
  updateEqId.mockReturnValue({ eq: updateEqCycle });
  mockUpdate.mockReturnValue({ eq: updateEqId });

  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case "dash_gestao_vendas_cycles":
        return { select: () => ({ eq: () => ({ single: cycleSingle }) }) };
      case "dash_gestao_vendas_buyers":
        return { update: mockUpdate };
      default:
        throw new Error(`tabela inesperada: ${table}`);
    }
  });
});

describe("PATCH /api/vendas/cycles/[id]/buyers/[buyerId]", () => {
  it("restricts the write to gestor", async () => {
    const { PATCH } = await import("../route");
    await PATCH(makeRequest({ name: "Fulano" }), params);

    expect(mockRequireRole).toHaveBeenCalledWith(["gestor"]);
  });

  it("returns 403 when the role gate rejects", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "Fulano" }), params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when the cycle does not exist", async () => {
    cycleSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "Fulano" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
  });

  it("returns 409 when the cycle is encerrado", async () => {
    cycleSingle.mockResolvedValueOnce({
      data: { id: "c1", status: "encerrado" },
      error: null,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "Fulano" }), params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Ciclo encerrado");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates name and phone, trimmed", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "  Fulano  ", phone: " 11999999999 " }), params);

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ name: "Fulano", phone: "11999999999" });
  });

  it("scopes the update by buyer id and cycle", async () => {
    const { PATCH } = await import("../route");
    await PATCH(makeRequest({ name: "Fulano" }), params);

    expect(updateEqId).toHaveBeenCalledWith("id", "b1");
    expect(updateEqCycle).toHaveBeenCalledWith("cycle_id", "c1");
  });

  it("stores an empty field as null", async () => {
    const { PATCH } = await import("../route");
    await PATCH(makeRequest({ name: "", phone: "   " }), params);

    expect(mockUpdate).toHaveBeenCalledWith({ name: null, phone: null });
  });

  it("updates only the fields present in the body", async () => {
    const { PATCH } = await import("../route");
    await PATCH(makeRequest({ phone: "11988887777" }), params);

    expect(mockUpdate).toHaveBeenCalledWith({ phone: "11988887777" });
  });

  it("never touches email or extra", async () => {
    const { PATCH } = await import("../route");
    await PATCH(
      makeRequest({ name: "Fulano", email: "outro@empresa.com", extra: { a: 1 } }),
      params
    );

    expect(mockUpdate).toHaveBeenCalledWith({ name: "Fulano" });
  });

  it("returns 400 when neither name nor phone is present", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({}), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Informe name ou phone");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the buyer does not belong to the cycle", async () => {
    updateSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "Fulano" }), params);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Comprador não encontrado neste ciclo");
  });
});
