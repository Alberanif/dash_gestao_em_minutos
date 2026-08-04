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

const mockCycleOffersSelect = jest.fn();
const mockCycleOffersIn = jest.fn();

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

// Produto CONFIGURADO no formato do corpo desde a 065: com ao menos uma oferta
// escolhida. Produto sem escolha nenhuma é recusado antes de qualquer I/O, por
// isso os testes que não falam de oferta precisam deste default.
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

  mockCycleOffersSelect.mockReturnValue({ in: mockCycleOffersIn });
  mockCycleOffersIn.mockResolvedValue({ data: [], error: null });

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
    if (table === "dash_gestao_ultimates_cycle_offers") {
      return { select: mockCycleOffersSelect };
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
        { cycle_id: "c1", product_id: "p1", include_offerless: false },
        { cycle_id: "c1", product_id: "p2", include_offerless: false },
        { cycle_id: "c2", product_id: "p2", include_offerless: false },
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
    expect(body.cycles[0].products.map((p: { product_id: string }) => p.product_id)).toEqual([
      "p2",
      "p1",
    ]);
    expect(body.cycles[0].products[0].product_name).toBe("Produto Dois");
    expect(body.cycles[1].products.map((p: { product_id: string }) => p.product_id)).toEqual([
      "p2",
    ]);
  });

  // A allowlist da 065: cada produto do ciclo carrega o que foi escolhido, o
  // que foi recusado e a decisão sobre venda sem oferta. Sem isso o dashboard
  // não tem como saber se o ciclo está configurado.
  it("anexa as ofertas escolhidas, as recusadas e include_offerless por produto", async () => {
    mockCyclesOrder.mockResolvedValueOnce({
      data: [
        { id: "c1", name: "Ciclo 1", account_id: "acc-1", status: "ativo", created_at: "2026-08-04T00:00:00Z" },
        { id: "c2", name: "Ciclo 2", account_id: "acc-1", status: "ativo", created_at: "2026-08-03T00:00:00Z" },
      ],
      error: null,
    });
    mockCycleProductsIn.mockResolvedValueOnce({
      data: [
        { cycle_id: "c1", product_id: "p1", include_offerless: true },
        { cycle_id: "c1", product_id: "p2", include_offerless: false },
        { cycle_id: "c2", product_id: "p1", include_offerless: null },
      ],
      error: null,
    });
    mockProductsIn.mockResolvedValueOnce({
      data: [
        { product_id: "p1", product_name: "Anual" },
        { product_id: "p2", product_name: "Mensal" },
      ],
      error: null,
    });
    mockCycleOffersIn.mockResolvedValueOnce({
      // Ordem de chegada embaralhada de propósito, e com linhas de OUTRO ciclo
      // e de OUTRO produto no meio: a chave é o par (cycle_id, product_id).
      data: [
        { cycle_id: "c1", product_id: "p1", offer_code: "OF_B", included: true },
        { cycle_id: "c2", product_id: "p1", offer_code: "OF_DE_OUTRO_CICLO", included: true },
        { cycle_id: "c1", product_id: "p1", offer_code: "OF_A", included: true },
        { cycle_id: "c1", product_id: "p1", offer_code: "OF_RECUSADA", included: false },
        { cycle_id: "c1", product_id: "p2", offer_code: "OF_DO_P2", included: true },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const body = await (await GET()).json();

    const c1 = body.cycles[0].products.find(
      (p: { product_id: string }) => p.product_id === "p1"
    );
    expect(c1).toEqual({
      product_id: "p1",
      product_name: "Anual",
      offer_codes: ["OF_A", "OF_B"],
      rejected_offer_codes: ["OF_RECUSADA"],
      include_offerless: true,
    });
    expect(
      body.cycles[0].products.find((p: { product_id: string }) => p.product_id === "p2")
    ).toEqual({
      product_id: "p2",
      product_name: "Mensal",
      offer_codes: ["OF_DO_P2"],
      rejected_offer_codes: [],
      include_offerless: false,
    });
    // Ciclo anterior à 065: nada decidido, e include_offerless null é o que
    // distingue "não configurado" de "decidiu não incluir".
    expect(body.cycles[1].products[0]).toEqual({
      product_id: "p1",
      product_name: "Anual",
      offer_codes: ["OF_DE_OUTRO_CICLO"],
      rejected_offer_codes: [],
      include_offerless: null,
    });
  });

  it("produto não sincronizado entra com product_name null", async () => {
    mockCyclesOrder.mockResolvedValueOnce({
      data: [{ id: "c1", name: "Ciclo 1", account_id: "acc-1", status: "ativo", created_at: "2026-07-19T00:00:00Z" }],
      error: null,
    });
    mockCycleProductsIn.mockResolvedValueOnce({
      data: [{ cycle_id: "c1", product_id: "desconhecido", include_offerless: false }],
      error: null,
    });
    mockProductsIn.mockResolvedValueOnce({ data: [], error: null });

    const { GET } = await import("../route");
    const body = await (await GET()).json();

    expect(body.cycles[0].products).toEqual([
      {
        product_id: "desconhecido",
        product_name: null,
        offer_codes: [],
        rejected_offer_codes: [],
        include_offerless: false,
      },
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
      products: [produto("p1")],
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
      products: [produto("p1")],
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
      products: [produto("p1")],
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is empty", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "   ",
      products: [produto("p1")],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when goalPercent is not numeric", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      products: [produto("p1")],
      goalPercent: "abc",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when goalPercent is out of 0-100 range", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/ultimates/cycles", {
      name: "Ciclo X",
      products: [produto("p1")],
      goalPercent: 150,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when products is missing or empty", async () => {
    const { POST } = await import("../route");

    for (const body of [
      { name: "Ciclo X" },
      { name: "Ciclo X", products: [] },
      { name: "Ciclo X", products: "p1" },
      // Entrada sem product_id não é produto nenhum: se ela fosse aceita, o
      // ciclo nasceria com uma linha vazia em cycle_products.
      { name: "Ciclo X", products: [{ offer_codes: ["OF1"] }] },
      { name: "Ciclo X", products: [produto("   ")] },
    ]) {
      const res = await POST(makeRequest("POST", "http://localhost/api/ultimates/cycles", body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/ao menos um produto/i);
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // A invariante da 065. Estas checagens existem SÓ pela mensagem — a RPC
  // repete todas —, e por isso o que se afirma aqui é o texto, não só o 400.
  it("recusa produto sem oferta escolhida, nomeando quem falta", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "Ciclo X",
        products: [
          produto("p1"),
          { product_id: "p2", offer_codes: [], rejected_offer_codes: ["OF_X"], include_offerless: null },
          { product_id: "p3", offer_codes: [], rejected_offer_codes: [], include_offerless: false },
        ],
      })
    );

    expect(res.status).toBe(400);
    // Recusar TODAS as ofertas (p2) não configura o produto, e include_offerless
    // false (p3) é "decidi não incluir", não uma escolha do que incluir.
    expect((await res.json()).error).toBe("Selecione ao menos uma oferta para: p2, p3");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("aceita produto configurado só por include_offerless", async () => {
    // Marcar apenas "(sem oferta)" é uma escolha humana explícita, e satisfaz a
    // regra (PRD seção 3.2): produto cujas vendas não têm offer_code seria
    // impossível de acompanhar na leitura oposta.
    mockProductsIn.mockResolvedValueOnce({
      data: [{ product_id: "p1", account_id: "acc-1" }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: { id: "new-cycle" }, error: null });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "Ciclo X",
        products: [
          { product_id: "p1", offer_codes: [], rejected_offer_codes: [], include_offerless: true },
        ],
      })
    );

    expect(res.status).toBe(201);
  });

  it("recusa oferta escolhida e recusada ao mesmo tempo", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "Ciclo X",
        products: [
          { product_id: "p1", offer_codes: ["OF1"], rejected_offer_codes: ["OF1"], include_offerless: null },
        ],
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/OF1/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("UL006 da RPC vira 400, não 500", async () => {
    mockProductsIn.mockResolvedValueOnce({
      data: [{ product_id: "p1", account_id: "acc-1" }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: "UL006", message: "produto sem oferta" },
    });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "Ciclo X",
        products: [produto("p1")],
      })
    );

    expect(res.status).toBe(400);
  });

  it("erro desconhecido da RPC continua 500", async () => {
    mockProductsIn.mockResolvedValueOnce({
      data: [{ product_id: "p1", account_id: "acc-1" }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ultimates/cycles", {
        name: "Ciclo X",
        products: [produto("p1")],
      })
    );

    expect(res.status).toBe(500);
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
        products: [produto("p1"), produto("fantasma")],
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
        products: [produto("p1"), produto("p2")],
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/mesma conta Hotmart/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("creates the cycle through the atomic RPC with deduplicated products", async () => {
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
        // p1 repetido (a primeira entrada vence) e OF_A repetida dentro do p2:
        // as duas duplicatas bateriam numa PK do banco com um 23505 ilegível.
        products: [
          produto("p1"),
          {
            product_id: "p2",
            offer_codes: ["OF_A", " OF_A ", "OF_B", ""],
            rejected_offer_codes: ["OF_C"],
            include_offerless: true,
          },
          produto("p1", { offer_codes: ["OF_OUTRA"] }),
        ],
        goalPercent: 30,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.cycle).toEqual(created);
    // p_selection é jsonb com o conjunto INTEIRO: produto, ofertas escolhidas,
    // ofertas recusadas e a decisão sobre venda sem oferta.
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_create_cycle", {
      p_name: "Ciclo X",
      p_selection: [
        {
          product_id: "p1",
          offer_codes: ["OF_p1"],
          rejected_offer_codes: [],
          include_offerless: null,
        },
        {
          product_id: "p2",
          offer_codes: ["OF_A", "OF_B"],
          rejected_offer_codes: ["OF_C"],
          include_offerless: true,
        },
      ],
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
        products: [produto("p1")],
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
      products: [produto("p1")],
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
      products: [produto("p1")],
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
      products: [produto("p1")],
      purchasesOnly: "sim",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
