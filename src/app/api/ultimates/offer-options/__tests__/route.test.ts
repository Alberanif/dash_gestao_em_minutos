import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ rpc: mockRpc })),
}));

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/ultimates/offer-options${query}`);
}

// As duas RPCs saem da MESMA chamada (Promise.all), então o mock roteia por
// nome — enfileirar por ordem esconderia uma troca de argumentos entre elas.
function mockRpcByName(
  offers: unknown[] | null,
  offerless: unknown[] | null,
  errors: { offers?: unknown; offerless?: unknown } = {}
) {
  mockRpc.mockImplementation(async (fn: string) => {
    if (fn === "dash_gestao_ultimates_offer_options") {
      return { data: offers, error: errors.offers ?? null };
    }
    if (fn === "dash_gestao_ultimates_offerless_counts") {
      return { data: offerless, error: errors.offerless ?? null };
    }
    throw new Error(`RPC inesperada: ${fn}`);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });
  mockRpcByName([], []);
});

describe("GET /api/ultimates/offer-options", () => {
  it("allows gestor and analista", async () => {
    const { GET } = await import("../route");
    await GET(makeRequest("?productIds=p1"));

    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
  });

  it("returns 403 when the role gate rejects", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("?productIds=p1"));

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 when productIds is missing or empty", async () => {
    const { GET } = await import("../route");

    for (const query of ["", "?productIds=", "?productIds=%20,%20"]) {
      const res = await GET(makeRequest(query));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/productIds/);
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("escopa as duas RPCs pelos productIds, aparados e sem duplicata", async () => {
    const { GET } = await import("../route");
    await GET(makeRequest("?productIds=p1,%20p2%20,p1,"));

    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_offer_options", {
      p_product_ids: ["p1", "p2"],
    });
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_offerless_counts", {
      p_product_ids: ["p1", "p2"],
    });
  });

  it("normaliza sales_count vindo como string nas duas listas", async () => {
    // PostgREST serializa bigint como string — a UI ordena e compara esse
    // valor, então ele não pode chegar como texto.
    mockRpcByName(
      [
        {
          offer_code: "OF1",
          offer_name: "Oferta principal",
          product_id: "p1",
          product_name: "Anual",
          sales_count: "412",
        },
      ],
      [{ product_id: "p1", sales_count: "3" }]
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest("?productIds=p1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.offers).toEqual([
      {
        offer_code: "OF1",
        offer_name: "Oferta principal",
        product_id: "p1",
        product_name: "Anual",
        sales_count: 412,
      },
    ]);
    expect(body.offerless).toEqual([{ product_id: "p1", sales_count: 3 }]);
  });

  it("sales_count nulo vira 0, não NaN", async () => {
    mockRpcByName(
      [
        {
          offer_code: "OF1",
          offer_name: "Sem venda",
          product_id: "p1",
          product_name: "Anual",
          sales_count: null,
        },
      ],
      []
    );

    const { GET } = await import("../route");
    const body = await (await GET(makeRequest("?productIds=p1"))).json();

    expect(body.offers[0].sales_count).toBe(0);
  });

  it("devolve listas vazias quando nenhum produto tem oferta", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest("?productIds=p1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ offers: [], offerless: [] });
  });

  it("returns 500 when either RPC fails", async () => {
    const { GET } = await import("../route");

    mockRpcByName(null, [], { offers: { message: "boom" } });
    expect((await GET(makeRequest("?productIds=p1"))).status).toBe(500);

    mockRpcByName([], null, { offerless: { message: "boom" } });
    expect((await GET(makeRequest("?productIds=p1"))).status).toBe(500);
  });
});
