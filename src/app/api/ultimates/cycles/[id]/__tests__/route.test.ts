import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: jest.fn(),
}));

const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdateSelect = jest.fn();
const mockSingle = jest.fn();

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

const params = { id: "cycle-uuid" };

beforeEach(() => {
  jest.clearAllMocks();

  requireRoleMock().mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });

  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  mockUpdateEq.mockReturnValue({ select: mockUpdateSelect });
  mockUpdateSelect.mockReturnValue({ single: mockSingle });
  mockSingle.mockResolvedValue({ data: null, error: null });

  mockFrom.mockReturnValue({ update: mockUpdate });
});

describe("PATCH /api/ultimates/cycles/[id]", () => {
  it("returns 403 for role analista", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { name: "Novo nome" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(403);
  });

  it("returns 403 for role comum", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { name: "Novo nome" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(403);
  });

  it("returns 401 without session", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "gestor",
    });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { name: "Novo nome" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty body", async () => {
    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {});
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid status", async () => {
    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { status: "pausado" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid goalPercent", async () => {
    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { goalPercent: 200 });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when cycle does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "No rows found", code: "PGRST116" } });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { name: "Novo nome" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(404);
  });

  it("updates name and sets updated_at", async () => {
    const updated = { id: "cycle-uuid", name: "Novo nome", status: "ativo" };
    mockSingle.mockResolvedValueOnce({ data: updated, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { name: "Novo nome" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cycle).toEqual(updated);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Novo nome", updated_at: expect.any(String) })
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "cycle-uuid");
  });

  it("allows clearing goalPercent with null", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "cycle-uuid", goal_percent: null }, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { goalPercent: null });
    await PATCH(req, { params: Promise.resolve(params) });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ goal_percent: null }));
  });

  it("encerra o ciclo (status encerrado) mesmo estando ativo", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "cycle-uuid", status: "encerrado" }, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { status: "encerrado" });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "encerrado" }));
  });

  it("reativa um ciclo encerrado (status ativo)", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "cycle-uuid", status: "ativo" }, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", { status: "ativo" });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "ativo" }));
  });

  it("grava counts_new_buyers quando countsNewBuyers é booleano", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "cycle-uuid", counts_new_buyers: false },
      error: null,
    });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
      countsNewBuyers: false,
    });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ counts_new_buyers: false })
    );
  });

  it("aceita countsNewBuyers true", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "cycle-uuid", counts_new_buyers: true },
      error: null,
    });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
      countsNewBuyers: true,
    });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ counts_new_buyers: true })
    );
  });

  it("rejeita countsNewBuyers não booleano com 400", async () => {
    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
      countsNewBuyers: "sim",
    });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("não grava counts_new_buyers quando o campo não vem no body", async () => {
    mockSingle.mockResolvedValue({ data: { id: "cycle-uuid" }, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
      name: "Só o nome",
    });
    await PATCH(req, { params: Promise.resolve(params) });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ counts_new_buyers: expect.anything() })
    );
  });
});
