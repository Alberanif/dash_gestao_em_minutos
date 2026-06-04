import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "admin" }),
}));

const mockSingle = jest.fn();
const mockDeleteEq = jest.fn();
const mockUpdateSelectSingle = jest.fn();
const mockUpdateSelectEq = jest.fn();
const mockUpdateEq = jest.fn();
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

  mockSingle.mockResolvedValue({ data: null, error: null });
  mockUpdateSelectSingle.mockReturnValue({ single: mockSingle });
  mockUpdateSelectEq.mockReturnValue({ select: mockUpdateSelectSingle });
  mockUpdateEq.mockReturnValue({ select: mockUpdateSelectSingle });
  mockDeleteEq.mockResolvedValue({ error: null });

  mockFrom.mockReturnValue({
    update: jest.fn().mockReturnValue({ eq: mockUpdateEq }),
    delete: jest.fn().mockReturnValue({ eq: mockDeleteEq }),
  });
});

const params = { id: "filter-uuid" };

// ─── PUT ─────────────────────────────────────────────────────────────────────

describe("PUT /api/indicadores/filters/[id]", () => {
  it("updates filter and returns 200 with updated record", async () => {
    const updated = {
      id: "filter-uuid",
      account_id: "acc",
      name: "Updated",
      hotmart_products: [],
      meta_ads_terms: ["campanha"],
      captacao_leads_eventos: [],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    };
    mockSingle.mockResolvedValueOnce({ data: updated, error: null });

    const { PUT } = await import("../route");
    const req = makeRequest("PUT", "http://localhost/api/indicadores/filters/filter-uuid", {
      name: "Updated",
      hotmart_products: [],
      meta_ads_terms: ["campanha"],
      captacao_leads_eventos: [],
    });
    const res = await PUT(req, { params: Promise.resolve(params) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(updated);
  });

  it("persists captacao_leads_eventos in the update call", async () => {
    const mockUpdate = jest.fn();
    mockFrom.mockReturnValue({ update: mockUpdate });
    const mockEq = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: "filter-uuid" }, error: null }) }) });
    mockUpdate.mockReturnValue({ eq: mockEq });

    const { PUT } = await import("../route");
    const req = makeRequest("PUT", "http://localhost/api/indicadores/filters/filter-uuid", {
      name: "Leads Only",
      hotmart_products: [],
      meta_ads_terms: [],
      captacao_leads_eventos: ["Evento A", "Evento B"],
    });
    await PUT(req, { params: Promise.resolve(params) });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ captacao_leads_eventos: ["Evento A", "Evento B"] })
    );
  });

  it("returns 404 when filter not found", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "No rows found", code: "PGRST116" } });

    const { PUT } = await import("../route");
    const req = makeRequest("PUT", "http://localhost/api/indicadores/filters/filter-uuid", {
      name: "X",
      meta_ads_terms: ["y"],
    });
    const res = await PUT(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe("DELETE /api/indicadores/filters/[id]", () => {
  it("deletes filter and returns 204", async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: null });

    const { DELETE } = await import("../route");
    const req = makeRequest("DELETE", "http://localhost/api/indicadores/filters/filter-uuid");
    const res = await DELETE(req, { params: Promise.resolve(params) });

    expect(res.status).toBe(204);
  });
});
