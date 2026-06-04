import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "admin" }),
}));

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockSingle = jest.fn();

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({ from: mockFrom }),
  createSupabaseServiceClient: jest.fn().mockReturnValue({ from: mockFrom }),
}));

function makeRequest(method: string, url: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  mockOrder.mockResolvedValue({ data: [], error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockEq.mockReturnValue({ order: mockOrder, single: mockSingle, select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
  mockInsert.mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) });
  mockUpdate.mockReturnValue({ eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) }) });
  mockDelete.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  });
});

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/indicadores/filters", () => {
  it("returns 400 when account_id missing", async () => {
    const { GET } = await import("../route");
    const req = makeRequest("GET", "http://localhost/api/indicadores/filters");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns filters array ordered by name", async () => {
    const filters = [
      { id: "1", account_id: "acc", name: "A", hotmart_products: [], meta_ads_terms: ["x"], created_at: "", updated_at: "" },
    ];
    mockOrder.mockResolvedValueOnce({ data: filters, error: null });

    const { GET } = await import("../route");
    const req = makeRequest("GET", "http://localhost/api/indicadores/filters?account_id=acc");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(filters);
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_filters");
    expect(mockOrder).toHaveBeenCalledWith("name", { ascending: true });
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe("POST /api/indicadores/filters", () => {
  it("returns 400 when name missing", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/indicadores/filters", {
      account_id: "acc",
      hotmart_products: [{ product_id: "p1", product_name: "Prod 1" }],
      meta_ads_terms: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when all three sources are empty", async () => {
    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/indicadores/filters", {
      account_id: "acc",
      name: "Test",
      hotmart_products: [],
      meta_ads_terms: [],
      captacao_leads_eventos: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates filter when only captacao_leads_eventos is provided", async () => {
    const created = {
      id: "new-id",
      account_id: "acc",
      name: "Leads Test",
      hotmart_products: [],
      meta_ads_terms: [],
      captacao_leads_eventos: ["Inscricao Webinar"],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/indicadores/filters", {
      account_id: "acc",
      name: "Leads Test",
      hotmart_products: [],
      meta_ads_terms: [],
      captacao_leads_eventos: ["Inscricao Webinar"],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created);
  });

  it("persists captacao_leads_eventos in the insert call", async () => {
    const created = {
      id: "x",
      account_id: "acc",
      name: "Leads Only",
      hotmart_products: [],
      meta_ads_terms: [],
      captacao_leads_eventos: ["Evento A"],
      created_at: "",
      updated_at: "",
    };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/indicadores/filters", {
      account_id: "acc",
      name: "Leads Only",
      hotmart_products: [],
      meta_ads_terms: [],
      captacao_leads_eventos: ["Evento A"],
    });
    await POST(req);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ captacao_leads_eventos: ["Evento A"] })
    );
  });

  it("creates filter and returns 201 with created record", async () => {
    const created = {
      id: "new-id",
      account_id: "acc",
      name: "Produto X",
      hotmart_products: [{ product_id: "p1", product_name: "Prod 1" }],
      meta_ads_terms: [],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    mockSingle.mockResolvedValueOnce({ data: created, error: null });

    const { POST } = await import("../route");
    const req = makeRequest("POST", "http://localhost/api/indicadores/filters", {
      account_id: "acc",
      name: "Produto X",
      hotmart_products: [{ product_id: "p1", product_name: "Prod 1" }],
      meta_ads_terms: [],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual(created);
  });
});
