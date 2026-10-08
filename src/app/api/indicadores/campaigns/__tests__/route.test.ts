import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "u", role: "admin" }),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn().mockReturnValue({}),
}));

const mockFetch = jest.fn();
jest.mock("@/lib/indicadores/service/meta-campaigns", () => ({
  ...jest.requireActual("@/lib/indicadores/service/meta-campaigns"),
  fetchMetaCampaigns: (...args: unknown[]) => mockFetch(...args),
}));

const BASE = "http://localhost/api/indicadores/campaigns?start_date=2026-05-01&end_date=2026-05-31";

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ campaigns: [], hidden_zero_spend: 0, total: {} });
});

describe("GET /api/indicadores/campaigns — q", () => {
  it("repassa o termo normalizado (trim) ao serviço", async () => {
    const { GET } = await import("../route");
    const res = await GET(new NextRequest(`${BASE}&q=%20black%20lp%20`));
    expect(res.status).toBe(200);
    expect(mockFetch.mock.calls[0][2]).toBe("black lp");
  });

  it("sem q repassa string vazia", async () => {
    const { GET } = await import("../route");
    await GET(new NextRequest(BASE));
    expect(mockFetch.mock.calls[0][2]).toBe("");
  });

  it("trunca q acima de 100 caracteres", async () => {
    const { GET } = await import("../route");
    await GET(new NextRequest(`${BASE}&q=${"a".repeat(150)}`));
    expect(mockFetch.mock.calls[0][2]).toBe("a".repeat(100));
  });

  it("400 sem start_date/end_date", async () => {
    const { GET } = await import("../route");
    const res = await GET(new NextRequest("http://localhost/api/indicadores/campaigns"));
    expect(res.status).toBe(400);
  });
});
