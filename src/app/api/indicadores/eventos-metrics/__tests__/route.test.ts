import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "admin" }),
}));

const mockOrder = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({ from: mockFrom }),
  createSupabaseServiceClient: jest.fn().mockReturnValue({ from: jest.fn(), rpc: jest.fn() }),
}));

const mockFetchEventosMetrics = jest.fn();
jest.mock("@/lib/indicadores/service/eventos-metrics", () => ({
  fetchEventosMetrics: (...args: unknown[]) => mockFetchEventosMetrics(...args),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ order: mockOrder }),
    }),
  });
  mockFetchEventosMetrics.mockResolvedValue({});
});

describe("GET /api/indicadores/eventos-metrics", () => {
  it("returns 400 when account_id missing", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest("http://localhost/api/indicadores/eventos-metrics"));
    expect(res.status).toBe(400);
  });

  it("carrega os filtros da conta e devolve o mapa do service", async () => {
    const filters = [{ id: "f-1" }, { id: "f-2" }];
    mockOrder.mockResolvedValueOnce({ data: filters, error: null });
    mockFetchEventosMetrics.mockResolvedValueOnce({
      "f-1": { leads: 10, spend: 500, cpl: 50 },
      "f-2": null,
    });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/indicadores/eventos-metrics?account_id=acc")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ "f-1": { leads: 10, spend: 500, cpl: 50 }, "f-2": null });
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_filters");
    expect(mockFetchEventosMetrics.mock.calls[0][0]).toEqual(filters);
  });

  it("returns 500 when loading filters fails", async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("http://localhost/api/indicadores/eventos-metrics?account_id=acc")
    );
    expect(res.status).toBe(500);
  });
});
