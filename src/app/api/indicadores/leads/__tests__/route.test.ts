import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "admin" }),
}));

const mockEq = jest.fn();
const mockLte = jest.fn();
const mockGte = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn().mockReturnValue({ from: mockFrom }),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  jest.clearAllMocks();

  mockEq.mockResolvedValue({ count: 0, error: null });
  mockLte.mockResolvedValue({ count: 0, error: null });
  mockGte.mockReturnValue({ lte: mockLte });
  mockSelect.mockReturnValue({ gte: mockGte });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("GET /api/indicadores/leads", () => {
  it("returns 400 when end_date is missing", async () => {
    const { GET } = await import("../route");
    const req = makeRequest("http://localhost/api/indicadores/leads?start_date=2025-01-01");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns total count without by_event when no eventos[] param", async () => {
    mockLte.mockResolvedValue({ count: 3, error: null });

    const { GET } = await import("../route");
    const req = makeRequest("http://localhost/api/indicadores/leads?start_date=2025-01-01&end_date=2025-01-31");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(3);
    expect(body.by_event).toEqual([]);
    expect(mockEq).not.toHaveBeenCalled();
  });

  it("uses count per event when a single eventos[] param is provided", async () => {
    mockLte.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ count: 5, error: null });

    const { GET } = await import("../route");
    const req = makeRequest(
      "http://localhost/api/indicadores/leads?start_date=2025-01-01&end_date=2025-01-31&eventos[]=Inscricao+Webinar"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(5);
    expect(body.by_event).toEqual([{ evento: "Inscricao Webinar", count: 5 }]);
    expect(mockEq).toHaveBeenCalledWith("evento", "Inscricao Webinar");
  });

  it("returns zeroed metrics when no leads match the eventos filter", async () => {
    mockLte.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ count: 0, error: null });

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

  it("sums counts from multiple eventos[] values and sorts by count desc", async () => {
    mockLte.mockReturnValue({ eq: mockEq });
    mockEq
      .mockResolvedValueOnce({ count: 3, error: null })
      .mockResolvedValueOnce({ count: 7, error: null });

    const { GET } = await import("../route");
    const req = makeRequest(
      "http://localhost/api/indicadores/leads?start_date=2025-01-01&end_date=2025-01-31&eventos[]=Evento+A&eventos[]=Evento+B"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(10);
    expect(body.by_event).toHaveLength(2);
    expect(body.by_event[0]).toEqual({ evento: "Evento B", count: 7 });
    expect(body.by_event[1]).toEqual({ evento: "Evento A", count: 3 });
  });
});
