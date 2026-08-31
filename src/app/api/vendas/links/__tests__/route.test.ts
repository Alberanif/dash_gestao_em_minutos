import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockInsertSingle = jest.fn();
const mockInsertSelect = jest.fn();
const mockInsert = jest.fn();
const mockDeleteEq = jest.fn();
const mockDelete = jest.fn();
const mockFrom = jest.fn();
const mockCycleProductsEq = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost/api/vendas/links", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });

  // Oferta ESCOLHIDA por padrão (a allowlist da 065 achou a linha) — os casos
  // abaixo que se importam com isso sobrescrevem com data null.
  mockMaybeSingle.mockResolvedValue({ data: { offer_code: "OFERTA_OK" }, error: null });
  // Default de higiene: sem isso, um teste que não enfileira todos os
  // .single() da rota (com mockResolvedValueOnce) deixa a chamada extra
  // retornar undefined, e a rota quebra ao desestruturar `{ data }` de
  // undefined — o teste morre por TypeError, não pela asserção que importa.
  // Com o default, uma guarda afrouxada deixa a rota seguir até o fim (e
  // devolver 201), e é a asserção de status que passa a matar o mutante.
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockInsertSingle.mockResolvedValue({ data: { id: "link-default" }, error: null });
  mockEq.mockReturnValue({ single: mockSingle, eq: mockEq, maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockInsertSelect.mockReturnValue({ single: mockInsertSingle });
  mockInsert.mockReturnValue({ select: mockInsertSelect });
  mockDeleteEq.mockResolvedValue({ error: null });
  mockDelete.mockReturnValue({ eq: mockDeleteEq });

  // Por padrão o ciclo acompanha só PROD1, e com include_offerless true — os
  // testes que precisam de mais (ou do contrário) sobrescrevem com
  // mockResolvedValueOnce.
  mockCycleProductsEq.mockResolvedValue({
    data: [{ product_id: "PROD1", include_offerless: true }],
    error: null,
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "dash_gestao_vendas_cycle_products") {
      return { select: () => ({ eq: mockCycleProductsEq }) };
    }
    return { select: mockSelect, insert: mockInsert, delete: mockDelete };
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe("POST /api/vendas/links", () => {
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
      data: { id: "c1", status: "encerrado" },
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
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "missing", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Comprador não encontrado");
  });

  it("returns 404 when buyer belongs to a different cycle", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "other-cycle" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Comprador não encontrado");
  });

  it("returns 400 when the transaction does not exist", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Transação não encontrada para os produtos deste ciclo");
  });

  it("returns 400 when the transaction belongs to a different product", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({ data: { transaction_code: "T1", product_id: "OTHER_PRODUCT" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Transação não encontrada para os produtos deste ciclo");
  });

  it("aceita venda de qualquer produto do ciclo", async () => {
    mockCycleProductsEq.mockResolvedValueOnce({
      data: [
        { product_id: "PROD1", include_offerless: true },
        { product_id: "PROD2", include_offerless: true },
      ],
      error: null,
    });
    // A rota faz quatro .single() em sequência: ciclo, comprador, venda e a
    // checagem de vínculo já existente (que aqui não existe, por isso "not found").
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({
        data: { transaction_code: "T1", product_id: "PROD2", offer_code: null },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    mockInsertSingle.mockResolvedValueOnce({ data: { id: "l1" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" })
    );

    expect(res.status).toBe(201);
  });

  it("recusa venda de produto fora do conjunto do ciclo", async () => {
    mockCycleProductsEq.mockResolvedValueOnce({
      data: [{ product_id: "PROD1", include_offerless: true }],
      error: null,
    });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({
        data: { transaction_code: "T1", product_id: "FORA", offer_code: null },
        error: null,
      });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/produtos deste ciclo/i);
  });

  // A allowlist da 065 INVERTEU o guard: agora não basta a oferta não estar
  // excluída, ela precisa estar escolhida. Oferta nova nasce fora da
  // contabilidade, e antes desta inversão ela era aceita em silêncio.
  it("returns 400 when the transaction belongs to an offer the cycle does not track", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({
        data: { transaction_code: "T1", product_id: "PROD1", offer_code: "OFERTA_NOVA" },
        error: null,
      });
    // Nenhuma linha em cycle_offers com included=true para essa oferta.
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Transação pertence a uma oferta que este ciclo não acompanha");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("aceita venda de oferta escolhida, filtrando por included=true", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({
        data: { transaction_code: "T1", product_id: "PROD1", offer_code: "OFERTA_OK" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { offer_code: "OFERTA_OK" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));

    expect(res.status).toBe(201);
    // Oferta RECUSADA (included=false) não pode passar por aqui: sem este
    // filtro a consulta acharia a linha da recusa e liberaria o vínculo.
    expect(mockEq).toHaveBeenCalledWith("included", true);
  });

  // Venda com offer_code null existe (mapHotmartSaleItem grava
  // `item.purchase.offer?.code ?? null`) e passou a depender de uma decisão
  // explícita do produto: sem include_offerless ela não entra em cycle_sales, e
  // o vínculo nasceria inerte.
  it("recusa venda sem oferta quando o produto não inclui vendas sem oferta", async () => {
    mockCycleProductsEq.mockResolvedValueOnce({
      data: [{ product_id: "PROD1", include_offerless: false }],
      error: null,
    });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({
        data: { transaction_code: "T1", product_id: "PROD1", offer_code: null },
        error: null,
      });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(
      "Transação não tem oferta e este ciclo não acompanha vendas sem oferta"
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // include_offerless ausente = banco sem a 065 aplicada. Vale como "não
  // decidido", que é o mesmo lugar de "não incluir": nada conta.
  it("recusa venda sem oferta quando include_offerless nem existe", async () => {
    mockCycleProductsEq.mockResolvedValueOnce({
      data: [{ product_id: "PROD1" }],
      error: null,
    });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({
        data: { transaction_code: "T1", product_id: "PROD1", offer_code: null },
        error: null,
      });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));

    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("aceita venda sem oferta quando o produto tem include_offerless", async () => {
    mockCycleProductsEq.mockResolvedValueOnce({
      data: [{ product_id: "PROD1", include_offerless: true }],
      error: null,
    });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
      .mockResolvedValueOnce({ data: { id: "b1", cycle_id: "c1" }, error: null })
      .mockResolvedValueOnce({
        data: { transaction_code: "T1", product_id: "PROD1", offer_code: null },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../route");
    const res = await POST(makeRequest("POST", { cycleId: "c1", buyerId: "b1", transactionCode: "T1" }));

    expect(res.status).toBe(201);
  });

  it("returns 409 when the transaction is already linked", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
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
      .mockResolvedValueOnce({ data: { id: "c1", status: "ativo" }, error: null })
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

describe("DELETE /api/vendas/links", () => {
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
