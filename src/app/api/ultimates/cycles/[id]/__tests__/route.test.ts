import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: jest.fn(),
}));

const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdateSelect = jest.fn();
const mockSingle = jest.fn();

const mockDelete = jest.fn();
const mockDeleteEq = jest.fn();
const mockDeleteSelect = jest.fn();

// Releitura do ciclo quando o PATCH só troca produtos (nada a atualizar na
// linha de cycles — a RPC já cuidou dela).
const mockSelect = jest.fn();
const mockSelectEq = jest.fn();
const mockSelectSingle = jest.fn();

const mockRpc = jest.fn();

const mockFrom = jest.fn();

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

const params = { id: "cycle-uuid" };

beforeEach(() => {
  jest.clearAllMocks();

  requireRoleMock().mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });

  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  mockUpdateEq.mockReturnValue({ select: mockUpdateSelect });
  mockUpdateSelect.mockReturnValue({ single: mockSingle });
  mockSingle.mockResolvedValue({ data: null, error: null });

  mockDelete.mockReturnValue({ eq: mockDeleteEq });
  mockDeleteEq.mockReturnValue({ select: mockDeleteSelect });
  mockDeleteSelect.mockResolvedValue({ data: [{ id: "cycle-uuid" }], error: null });

  mockSelect.mockReturnValue({ eq: mockSelectEq });
  mockSelectEq.mockReturnValue({ single: mockSelectSingle });
  mockSelectSingle.mockResolvedValue({ data: { id: "cycle-uuid" }, error: null });

  // returns table (...) chega como array de uma linha pelo PostgREST.
  mockRpc.mockResolvedValue({
    data: [
      {
        products_added: 1,
        products_removed: 1,
        buyers_removed: 3,
        buyers_materialized: 5,
      },
    ],
    error: null,
  });

  mockFrom.mockReturnValue({ update: mockUpdate, delete: mockDelete, select: mockSelect });
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

  // purchases_only é imutável (definido só na criação). O PATCH nunca o aplica.
  it("ignora purchasesOnly: não grava purchases_only mesmo se vier no body", async () => {
    mockSingle.mockResolvedValue({ data: { id: "cycle-uuid", name: "Novo nome" }, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
      name: "Novo nome",
      purchasesOnly: true,
    });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ purchases_only: expect.anything() })
    );
  });

  it("retorna 400 quando purchasesOnly é o único campo (nada aplicável)", async () => {
    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
      purchasesOnly: true,
    });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// Troca do conjunto de produtos (migration 062). A rota não faz o diff — ela
// delega para a RPC atômica, que é quem apaga comprador. O que se testa aqui é
// o contrato: o que sobe, o que desce, e que erro de regra não vire 500.
describe("PATCH /api/ultimates/cycles/[id] — productIds", () => {
  it("delega para a RPC com o conjunto deduplicado e devolve as contagens", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
        productIds: ["  p1  ", "p2", "p1", ""],
      }),
      { params: Promise.resolve(params) }
    );

    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_set_cycle_products", {
      p_cycle_id: "cycle-uuid",
      p_product_ids: ["p1", "p2"],
    });
    expect(res.status).toBe(200);
    expect((await res.json()).products).toEqual({
      products_added: 1,
      products_removed: 1,
      buyers_removed: 3,
      buyers_materialized: 5,
    });
    // Sem outro campo no corpo, a linha de cycles não é tocada: a RPC já
    // atualizou o que precisava.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("troca de produtos roda ANTES do update dos demais campos", async () => {
    const order: string[] = [];
    mockRpc.mockImplementation(async () => {
      order.push("rpc");
      return { data: [{ products_added: 0, products_removed: 0, buyers_removed: 0, buyers_materialized: 0 }], error: null };
    });
    mockUpdate.mockImplementation(() => {
      order.push("update");
      return { eq: mockUpdateEq };
    });
    mockSingle.mockResolvedValue({ data: { id: "cycle-uuid" }, error: null });

    const { PATCH } = await import("../route");
    await PATCH(
      makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
        name: "Novo nome",
        productIds: ["p1"],
      }),
      { params: Promise.resolve(params) }
    );

    expect(order).toEqual(["rpc", "update"]);
  });

  it("conjunto vazio é recusado sem chamar a RPC", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
        productIds: ["", "   "],
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("productIds que não é array vira 400", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
        productIds: "p1",
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // Cada SQLSTATE da RPC tem um HTTP que o gestor consegue interpretar. Sem o
  // mapa, "ciclo encerrado" viraria 500 e a tela diria só "erro ao salvar".
  it.each([
    ["UL001", 400],
    ["UL002", 400],
    ["UL003", 400],
    ["UL004", 404],
    ["UL005", 409],
    ["XX000", 500],
  ])("erro %s da RPC vira HTTP %i", async (code, expected) => {
    mockRpc.mockResolvedValue({ data: null, error: { code, message: "boom" } });

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/ultimates/cycles/cycle-uuid", {
        productIds: ["p1"],
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(expected);
    // Falhou a troca, nada mais é escrito.
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/ultimates/cycles/[id]", () => {
  it("returns 403 for role analista e não apaga nada", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/ultimates/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 401 sem sessão e não apaga nada", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "gestor",
    });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/ultimates/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("apaga o ciclo escopado pelo id e devolve 200", async () => {
    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/ultimates/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe("cycle-uuid");
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_ultimates_cycles");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith("id", "cycle-uuid");
  });

  it("returns 404 quando nenhuma linha foi apagada (ciclo inexistente)", async () => {
    mockDeleteSelect.mockResolvedValueOnce({ data: [], error: null });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/ultimates/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(404);
  });

  it("returns 500 quando o banco falha", async () => {
    mockDeleteSelect.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/ultimates/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("boom");
  });

  // O lock de refresh (refresh_started_at, com TTL) não pode impedir a
  // exclusão: um lock órfão deixaria o ciclo inexcluível sem explicação.
  it("não consulta o estado do ciclo antes de apagar (lock de refresh não bloqueia)", async () => {
    const mockSelect = jest.fn();
    mockFrom.mockReturnValue({ update: mockUpdate, delete: mockDelete, select: mockSelect });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/ultimates/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(200);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
