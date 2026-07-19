import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockInsertSingle = jest.fn();
const mockInsertSelect = jest.fn();
const mockInsert = jest.fn();
const mockDeleteEq = jest.fn();
const mockDelete = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/ultimates/links", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });

  mockEq.mockReturnValue({ single: mockSingle, eq: mockEq });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockInsertSelect.mockReturnValue({ single: mockInsertSingle });
  mockInsert.mockReturnValue({ select: mockInsertSelect });
  mockDeleteEq.mockResolvedValue({ error: null });
  mockDelete.mockReturnValue({ eq: mockDeleteEq });

  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe("POST /api/ultimates/links", () => {
  it("returns 403 when role is not gestor", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor"]);
  });

  it("returns 400 when a required field is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1" }));

    expect(res.status).toBe(400);
  });

  it("returns 404 when cycle does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "missing", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
  });

  it("returns 409 when cycle is encerrado", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "c1", product_id: "PROD1", status: "encerrado" },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Ciclo encerrado");
  });

  it("returns 404 when buyer does not exist", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", product_id: "PROD1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "missing", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Comprador não encontrado");
  });

  it("returns 404 when buyer belongs to a different cycle", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", product_id: "PROD1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "other-cycle" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Comprador não encontrado");
  });

  it("returns 400 when the transaction does not exist", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", product_id: "PROD1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Transação não encontrada para o produto deste ciclo");
  });

  it("returns 400 when the transaction belongs to a different product", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", product_id: "PROD1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({ data: { transaction_code: "T1", product_id: "OTHER_PRODUCT" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Transação não encontrada para o produto deste ciclo");
  });

  it("returns 409 when the transaction is already linked", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", product_id: "PROD1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({ data: { transaction_code: "T1", product_id: "PROD1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "existing-link" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Transação já vinculada");
  });

  it("creates the link with linked_by set to the authenticated user and returns 201", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", product_id: "PROD1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({ data: { transaction_code: "T1", product_id: "PROD1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const created = {
      id: "link-1",
      cycle_id: "c1",
      buyer_id: "b1",
      transaction_code: "T1",
      linked_by: "user-1",
      created_at: "2026-07-19T00:00:00Z",
    };
    mockInsertSingle.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.link).toEqual(created);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cycle_id: "c1",
        buyer_id: "b1",
        transaction_code: "T1",
        linked_by: "user-1",
      })
    );
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe("DELETE /api/ultimates/links", () => {
  it("returns 403 when role is not gestor", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { cycleId: "c1", transactionCode: "T1" }));

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor"]);
  });

  it("returns 400 when a required field is missing", async () => {
    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { cycleId: "c1" }));

    expect(res.status).toBe(400);
  });

  it("returns 404 when cycle does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { cycleId: "missing", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
  });

  it("returns 409 when cycle is encerrado", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "c1", status: "encerrado" }, error: null });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { cycleId: "c1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Ciclo encerrado");
  });

  it("returns 404 when the link does not exist", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { cycleId: "c1", transactionCode: "missing" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Vínculo não encontrado");
  });

  it("removes the link, logs the unlink audit trail, and returns 204", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "link-1" }, error: null });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { DELETE } = await import("../route");
    const res = await DELETE(makeRequest("DELETE", { cycleId: "c1", transactionCode: "T1" }));

    expect(res.status).toBe(204);
    expect(mockDeleteEq).toHaveBeenCalledWith("id", "link-1");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("user-1"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("T1"));

    consoleSpy.mockRestore();
  });
});
