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
        offers_added: 2,
        offers_removed: 1,
      },
    ],
    error: null,
  });

  mockFrom.mockReturnValue({ update: mockUpdate, delete: mockDelete, select: mockSelect });
});

describe("PATCH /api/vendas/cycles/[id]", () => {
  it("returns 403 for role analista", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { name: "Novo nome" });
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
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { name: "Novo nome" });
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
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { name: "Novo nome" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty body", async () => {
    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {});
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid status", async () => {
    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { status: "pausado" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid goalPercent", async () => {
    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { goalPercent: 200 });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when cycle does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "No rows found", code: "PGRST116" } });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { name: "Novo nome" });
    const res = await PATCH(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(404);
  });

  it("updates name and sets updated_at", async () => {
    const updated = { id: "cycle-uuid", name: "Novo nome", status: "ativo" };
    mockSingle.mockResolvedValueOnce({ data: updated, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { name: "Novo nome" });
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
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { goalPercent: null });
    await PATCH(req, { params: Promise.resolve(params) });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ goal_percent: null }));
  });

  it("encerra o ciclo (status encerrado) mesmo estando ativo", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "cycle-uuid", status: "encerrado" }, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { status: "encerrado" });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "encerrado" }));
  });

  it("reativa um ciclo encerrado (status ativo)", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "cycle-uuid", status: "ativo" }, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", { status: "ativo" });
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
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
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
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
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
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
      countsNewBuyers: "sim",
    });
    const res = await PATCH(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("não grava counts_new_buyers quando o campo não vem no body", async () => {
    mockSingle.mockResolvedValue({ data: { id: "cycle-uuid" }, error: null });

    const { PATCH } = await import("../route");
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
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
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
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
    const req = makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
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
describe("PATCH /api/vendas/cycles/[id] — janela de visualização", () => {
  function patchJanela(body: object) {
    return makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", body);
  }

  it("grava as duas datas quando o par é válido", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "cycle-uuid", view_start_date: "2026-07-01", view_end_date: "2026-07-15" },
      error: null,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchJanela({ viewStartDate: "2026-07-01", viewEndDate: "2026-07-15" }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ view_start_date: "2026-07-01", view_end_date: "2026-07-15" })
    );
  });

  it("aceita janela de um único dia", async () => {
    mockSingle.mockResolvedValue({ data: { id: "cycle-uuid" }, error: null });

    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchJanela({ viewStartDate: "2026-07-01", viewEndDate: "2026-07-01" }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(200);
  });

  it("null nos dois limpa a janela", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "cycle-uuid", view_start_date: null, view_end_date: null },
      error: null,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(patchJanela({ viewStartDate: null, viewEndDate: null }), {
      params: Promise.resolve(params),
    });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ view_start_date: null, view_end_date: null })
    );
  });

  // A CHAVE AUSENTE e a chave presente com meio par são erros DIFERENTES, e a
  // mensagem é a única coisa que os separa (o status é 400 nos dois). Sem
  // afirmar o texto, este teste passaria mesmo se o guarda de "devem vir
  // juntos" sumisse: a validação genérica logo abaixo também recusa, mas
  // dizendo "Janela inválida" para quem simplesmente esqueceu um campo.
  it("chave sozinha é 400 dizendo que o par é obrigatório", async () => {
    const { PATCH } = await import("../route");

    for (const body of [{ viewStartDate: "2026-07-01" }, { viewEndDate: "2026-07-15" }]) {
      const res = await PATCH(patchJanela(body), { params: Promise.resolve(params) });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("devem vir juntos");
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("uma data com a outra null é 400, não recorte aberto de um lado", async () => {
    const { PATCH } = await import("../route");

    for (const body of [
      { viewStartDate: "2026-07-01", viewEndDate: null },
      { viewStartDate: null, viewEndDate: "2026-07-15" },
    ]) {
      const res = await PATCH(patchJanela(body), { params: Promise.resolve(params) });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("Janela inválida");
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("fim anterior ao início é 400", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchJanela({ viewStartDate: "2026-07-15", viewEndDate: "2026-07-01" }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("formato fora de YYYY-MM-DD é 400", async () => {
    const { PATCH } = await import("../route");

    for (const body of [
      { viewStartDate: "01/07/2026", viewEndDate: "15/07/2026" },
      { viewStartDate: "2026-7-1", viewEndDate: "2026-07-15" },
      { viewStartDate: "2026-07-01T00:00:00Z", viewEndDate: "2026-07-15T00:00:00Z" },
      { viewStartDate: 20260701, viewEndDate: 20260715 },
    ]) {
      const res = await PATCH(patchJanela(body), { params: Promise.resolve(params) });
      expect(res.status).toBe(400);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("não toca nas colunas quando o par não vem no body", async () => {
    mockSingle.mockResolvedValue({ data: { id: "cycle-uuid" }, error: null });

    const { PATCH } = await import("../route");
    await PATCH(patchJanela({ name: "Só o nome" }), { params: Promise.resolve(params) });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ view_start_date: expect.anything() })
    );
  });

  it("ciclo encerrado NÃO bloqueia: o período é lente de leitura", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "cycle-uuid", status: "encerrado", view_start_date: "2026-07-01" },
      error: null,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(
      patchJanela({ viewStartDate: "2026-07-01", viewEndDate: "2026-07-15" }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/vendas/cycles/[id] — products", () => {
  // Produto CONFIGURADO no formato do corpo (065): sem oferta escolhida o
  // conjunto é recusado antes de chegar à RPC.
  function produto(
    productId: string,
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      product_id: productId,
      offer_codes: [`OF_${productId}`],
      rejected_offer_codes: [],
      include_offerless: null,
      ...extra,
    };
  }

  it("delega para a RPC com o conjunto deduplicado e devolve as contagens", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
        products: [
          produto("  p1  ", { offer_codes: [" OF_1 "] }),
          {
            product_id: "p2",
            offer_codes: ["OF_A", "OF_A"],
            rejected_offer_codes: ["OF_B"],
            include_offerless: true,
          },
          produto("p1", { offer_codes: ["OF_OUTRA"] }),
          produto(""),
        ],
      }),
      { params: Promise.resolve(params) }
    );

    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_vendas_set_cycle_products", {
      p_cycle_id: "cycle-uuid",
      p_selection: [
        {
          product_id: "p1",
          offer_codes: ["OF_1"],
          rejected_offer_codes: [],
          include_offerless: null,
        },
        {
          product_id: "p2",
          offer_codes: ["OF_A"],
          rejected_offer_codes: ["OF_B"],
          include_offerless: true,
        },
      ],
    });
    expect(res.status).toBe(200);
    // offers_added/offers_removed contam o que a recontagem de oferta mexeu —
    // é o número que a tela usa para dizer o que saiu do roster.
    expect((await res.json()).products).toEqual({
      products_added: 1,
      products_removed: 1,
      buyers_removed: 3,
      buyers_materialized: 5,
      offers_added: 2,
      offers_removed: 1,
    });
    // Sem outro campo no corpo, a linha de cycles não é tocada: a RPC já
    // atualizou o que precisava.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("troca de produtos roda ANTES do update dos demais campos", async () => {
    const order: string[] = [];
    mockRpc.mockImplementation(async () => {
      order.push("rpc");
      return { data: [{ products_added: 0, products_removed: 0, buyers_removed: 0, buyers_materialized: 0, offers_added: 0, offers_removed: 0 }], error: null };
    });
    mockUpdate.mockImplementation(() => {
      order.push("update");
      return { eq: mockUpdateEq };
    });
    mockSingle.mockResolvedValue({ data: { id: "cycle-uuid" }, error: null });

    const { PATCH } = await import("../route");
    await PATCH(
      makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
        name: "Novo nome",
        products: [produto("p1")],
      }),
      { params: Promise.resolve(params) }
    );

    expect(order).toEqual(["rpc", "update"]);
  });

  it("conjunto vazio é recusado sem chamar a RPC", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
        products: [produto(""), produto("   ")],
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("products que não é array vira 400", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
        products: "p1",
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // A mesma invariante da criação, com a mesma mensagem: o gestor precisa saber
  // QUAL produto ficou sem escolha, e a RPC devolveria só UL006.
  it("recusa produto sem oferta escolhida, nomeando quem falta", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
        products: [
          produto("p1"),
          { product_id: "p2", offer_codes: [], rejected_offer_codes: ["OF_X"], include_offerless: false },
        ],
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Selecione ao menos uma oferta para: p2");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("recusa oferta escolhida e recusada ao mesmo tempo", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
        products: [
          { product_id: "p1", offer_codes: ["OF1"], rejected_offer_codes: ["OF1"], include_offerless: null },
        ],
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/OF1/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("PATCH sem products não chama a RPC (o corpo é parcial)", async () => {
    mockSingle.mockResolvedValue({ data: { id: "cycle-uuid", name: "Novo nome" }, error: null });

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
        name: "Novo nome",
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(200);
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
    ["UL006", 400],
    ["XX000", 500],
  ])("erro %s da RPC vira HTTP %i", async (code, expected) => {
    mockRpc.mockResolvedValue({ data: null, error: { code, message: "boom" } });

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/vendas/cycles/cycle-uuid", {
        products: [produto("p1")],
      }),
      { params: Promise.resolve(params) }
    );

    expect(res.status).toBe(expected);
    // Falhou a troca, nada mais é escrito.
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/vendas/cycles/[id]", () => {
  it("returns 403 for role analista e não apaga nada", async () => {
    const { NextResponse } = await import("next/server");
    requireRoleMock().mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "analista",
    });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/vendas/cycles/cycle-uuid");
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
    const req = makeRequest("DELETE", "http://localhost/api/vendas/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("apaga o ciclo escopado pelo id e devolve 200", async () => {
    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/vendas/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe("cycle-uuid");
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_vendas_cycles");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith("id", "cycle-uuid");
  });

  it("returns 404 quando nenhuma linha foi apagada (ciclo inexistente)", async () => {
    mockDeleteSelect.mockResolvedValueOnce({ data: [], error: null });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/vendas/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(404);
  });

  it("returns 500 quando o banco falha", async () => {
    mockDeleteSelect.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/vendas/cycles/cycle-uuid");
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
    const req = makeRequest("DELETE", "http://localhost/api/vendas/cycles/cycle-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(200);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
