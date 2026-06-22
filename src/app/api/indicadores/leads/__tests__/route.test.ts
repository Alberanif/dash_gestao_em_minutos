import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "admin" }),
}));

const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn().mockReturnValue({ rpc: mockRpc }),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

function rpcResponse(data: unknown) {
  return { data, error: null };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue(rpcResponse(null));
});

describe("GET /api/indicadores/leads", () => {
  it("returns 400 when end_date is missing", async () => {
    const { GET } = await import("../route");
    const req = makeRequest("http://localhost/api/indicadores/leads?start_date=2025-01-01");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("calls dash_gestao_leads_unique_total RPC when no eventos[] param", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "dash_gestao_leads_unique_total") return Promise.resolve(rpcResponse(42));
      return Promise.resolve(rpcResponse([]));
    });

    const { GET } = await import("../route");
    const req = makeRequest("http://localhost/api/indicadores/leads?start_date=2025-01-01&end_date=2025-01-31");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(42);
    expect(body.by_event).toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_leads_unique_total", {
      p_start_date: "2025-01-01",
      p_end_date: "2025-01-31",
      p_eventos: null,
    });
  });

  it("calls dash_gestao_leads_by_event_unique RPC when eventos[] provided", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "dash_gestao_leads_unique_total") return Promise.resolve(rpcResponse(5));
      if (fn === "dash_gestao_leads_by_event_unique")
        return Promise.resolve(rpcResponse([{ evento: "Inscricao Webinar", count: 5 }]));
      return Promise.resolve(rpcResponse([]));
    });

    const { GET } = await import("../route");
    const req = makeRequest(
      "http://localhost/api/indicadores/leads?start_date=2025-01-01&end_date=2025-01-31&eventos[]=Inscricao+Webinar"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(5);
    expect(body.by_event).toEqual([{ evento: "Inscricao Webinar", count: 5 }]);
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_leads_by_event_unique", {
      p_start_date: "2025-01-01",
      p_end_date: "2025-01-31",
      p_eventos: ["Inscricao Webinar"],
    });
  });

  it("passes eventos[] as p_eventos to unique_total RPC and returns unique total not sum", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "dash_gestao_leads_unique_total") return Promise.resolve(rpcResponse(8));
      if (fn === "dash_gestao_leads_by_event_unique")
        return Promise.resolve(
          rpcResponse([
            { evento: "Evento B", count: 7 },
            { evento: "Evento A", count: 3 },
          ])
        );
      return Promise.resolve(rpcResponse([]));
    });

    const { GET } = await import("../route");
    const req = makeRequest(
      "http://localhost/api/indicadores/leads?start_date=2025-01-01&end_date=2025-01-31&eventos[]=Evento+A&eventos[]=Evento+B"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(8);
    expect(body.by_event).toHaveLength(2);
    expect(body.by_event[0]).toEqual({ evento: "Evento B", count: 7 });
    expect(body.by_event[1]).toEqual({ evento: "Evento A", count: 3 });
    expect(mockRpc).toHaveBeenCalledWith("dash_gestao_leads_unique_total", {
      p_start_date: "2025-01-01",
      p_end_date: "2025-01-31",
      p_eventos: ["Evento A", "Evento B"],
    });
  });

  it("returns zeroed metrics when no leads match the eventos filter", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "dash_gestao_leads_unique_total") return Promise.resolve(rpcResponse(0));
      if (fn === "dash_gestao_leads_by_event_unique") return Promise.resolve(rpcResponse([]));
      return Promise.resolve(rpcResponse([]));
    });

    const { GET } = await import("../route");
    const req = makeRequest(
      "http://localhost/api/indicadores/leads?start_date=2025-01-01&end_date=2025-01-31&eventos[]=Evento+Inexistente"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.by_event).toEqual([]);
  });

  it("filters out by_event entries with zero count", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "dash_gestao_leads_unique_total") return Promise.resolve(rpcResponse(3));
      if (fn === "dash_gestao_leads_by_event_unique")
        return Promise.resolve(
          rpcResponse([
            { evento: "Evento A", count: 3 },
            { evento: "Evento B", count: 0 },
          ])
        );
      return Promise.resolve(rpcResponse([]));
    });

    const { GET } = await import("../route");
    const req = makeRequest(
      "http://localhost/api/indicadores/leads?start_date=2025-01-01&end_date=2025-01-31&eventos[]=Evento+A&eventos[]=Evento+B"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(body.by_event).toHaveLength(1);
    expect(body.by_event[0].evento).toBe("Evento A");
  });
});
