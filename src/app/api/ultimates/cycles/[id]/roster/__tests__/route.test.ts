import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });

  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });

  mockSingle.mockResolvedValue({ data: { id: "cycle-1", purchases_only: false }, error: null });
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe("GET /api/ultimates/cycles/[id]/roster", () => {
  it("returns 403 when role is not gestor/analista", async () => {
    mockRequireRole.mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
  });

  it("returns 404 when cycle does not exist", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116", message: "no rows" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/missing/roster"), makeParams("missing"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Ciclo não encontrado");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls the roster RPC with the cycle id and returns rows", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          buyer_id: "b1",
          name: "Ana",
          email: "ana@x.com",
          phone: null,
          extra: {},
          category: "renovado",
          renewed_at: "2026-01-01T00:00:00Z",
          total_value: 199.9,
          transaction_code: "T1",
        },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_roster", { p_cycle_id: "cycle-1" });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].email).toBe("ana@x.com");
  });

  it("coerces total_value from a numeric string returned by PostgREST", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          buyer_id: "b1",
          name: "Ana",
          email: "ana@x.com",
          phone: null,
          extra: {},
          category: "renovado",
          renewed_at: "2026-01-01T00:00:00Z",
          total_value: "199.90",
          transaction_code: "T1",
        },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));
    const body = await res.json();

    expect(body.rows[0].total_value).toBe(199.9);
    expect(typeof body.rows[0].total_value).toBe("number");
  });

  it("keeps total_value null when the RPC returns null", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          buyer_id: null,
          name: null,
          email: "novo@x.com",
          phone: null,
          extra: {},
          category: "novo_reembolsado",
          renewed_at: null,
          total_value: null,
          transaction_code: null,
        },
      ],
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));
    const body = await res.json();

    expect(body.rows[0].total_value).toBeNull();
  });

  it("returns 500 when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"), makeParams("cycle-1"));

    expect(res.status).toBe(500);
  });
});

describe("GET /api/ultimates/cycles/[id]/roster — recorte por intervalo", () => {
  it("sem query string, chama a RPC só com o ciclo", async () => {
    const { GET } = await import("../route");
    await GET(
      makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"),
      makeParams("cycle-1")
    );

    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_roster", {
      p_cycle_id: "cycle-1",
    });
  });

  it("repassa o intervalo à RPC quando start e end são válidos", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/ultimates/cycles/cycle-1/roster?start=2026-07-10&end=2026-07-20"
      ),
      makeParams("cycle-1")
    );

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_roster", {
      p_cycle_id: "cycle-1",
      p_start: "2026-07-10",
      p_end: "2026-07-20",
    });
  });

  it("devolve 400 quando só uma ponta vem, ou quando o fim é anterior ao início", async () => {
    const { GET } = await import("../route");

    const soUma = await GET(
      makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster?start=2026-07-10"),
      makeParams("cycle-1")
    );
    expect(soUma.status).toBe(400);
    expect(await soUma.json()).toEqual({ error: "Intervalo inválido" });

    const invertido = await GET(
      makeRequest(
        "http://localhost/api/ultimates/cycles/cycle-1/roster?start=2026-07-20&end=2026-07-10"
      ),
      makeParams("cycle-1")
    );
    expect(invertido.status).toBe(400);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("devolve 501 quando a RPC não conhece os parâmetros (migration 058 pendente)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.dash_gestao_ultimates_roster(p_cycle_id, p_end, p_start) in the schema cache",
      },
    });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/ultimates/cycles/cycle-1/roster?start=2026-07-10&end=2026-07-20"
      ),
      makeParams("cycle-1")
    );

    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: "Recorte por data indisponível" });
  });

  it("mantém 500 para falha real da RPC mesmo com intervalo", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest(
        "http://localhost/api/ultimates/cycles/cycle-1/roster?start=2026-07-10&end=2026-07-20"
      ),
      makeParams("cycle-1")
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "statement timeout" });
  });

  it("PGRST202 sem intervalo continua sendo 500 — ali não há recorte a degradar", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "function not found" },
    });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"),
      makeParams("cycle-1")
    );

    expect(res.status).toBe(500);
  });
});

describe("GET /api/ultimates/cycles/[id]/roster — granularidade por modo", () => {
  it("ciclo de renovação usa a RPC de roster e se declara por comprador", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "cycle-1", purchases_only: false },
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"),
      makeParams("cycle-1")
    );
    const body = await res.json();

    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_roster", {
      p_cycle_id: "cycle-1",
    });
    expect(body.granularity).toBe("comprador");
  });

  it("ciclo Apenas Compras usa a RPC de vendas e se declara por venda", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "cycle-1", purchases_only: true },
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"),
      makeParams("cycle-1")
    );
    const body = await res.json();

    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_purchases", {
      p_cycle_id: "cycle-1",
    });
    expect(body.granularity).toBe("venda");
  });

  it("repassa o intervalo à RPC de vendas no modo Apenas Compras", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "cycle-1", purchases_only: true },
      error: null,
    });

    const { GET } = await import("../route");
    await GET(
      makeRequest(
        "http://localhost/api/ultimates/cycles/cycle-1/roster?start=2026-08-01&end=2026-08-02"
      ),
      makeParams("cycle-1")
    );

    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_ultimates_purchases", {
      p_cycle_id: "cycle-1",
      p_start: "2026-08-01",
      p_end: "2026-08-02",
    });
  });

  it("devolve 501 nomeando a migration 064 quando a RPC de vendas não existe", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "cycle-1", purchases_only: true },
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.dash_gestao_ultimates_purchases(p_cycle_id) in the schema cache",
      },
    });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/ultimates/cycles/cycle-1/roster"),
      makeParams("cycle-1")
    );
    const body = await res.json();

    expect(res.status).toBe(501);
    expect(body.error).toContain("064");
  });
});
