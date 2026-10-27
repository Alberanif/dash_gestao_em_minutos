import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "admin" }),
}));

const mockSingle = jest.fn();
const mockDeleteEq = jest.fn();
const mockUpdateSelectSingle = jest.fn();
const mockUpdateSelectEq = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn();
const mockCurrentSingle = jest.fn();
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
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  mockCurrentSingle.mockResolvedValue({ data: { status: "ativo" }, error: null });

  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockCurrentSingle }) }),
    update: mockUpdate,
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
    mockFrom.mockReturnValue({
      update: mockUpdate,
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockCurrentSingle }) }),
    });
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

  it("mudança de status persiste o novo valor e seta status_changed_at", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "filter-uuid" }, error: null });
    mockCurrentSingle.mockResolvedValueOnce({ data: { status: "ativo" }, error: null });

    const { PUT } = await import("../route");
    const req = makeRequest("PUT", "http://localhost/api/indicadores/filters/filter-uuid", {
      name: "X",
      meta_ads_terms: ["y"],
      status: "finalizado",
    });
    await PUT(req, { params: Promise.resolve(params) });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "finalizado", status_changed_at: expect.any(String) })
    );
  });

  it("update com o mesmo status não altera status_changed_at", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "filter-uuid" }, error: null });
    mockCurrentSingle.mockResolvedValueOnce({ data: { status: "finalizado" }, error: null });

    const { PUT } = await import("../route");
    const req = makeRequest("PUT", "http://localhost/api/indicadores/filters/filter-uuid", {
      name: "X",
      meta_ads_terms: ["y"],
      status: "finalizado",
    });
    await PUT(req, { params: Promise.resolve(params) });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "finalizado" }));
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("status_changed_at");
  });

  it("update sem status no payload não toca status nem status_changed_at", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "filter-uuid" }, error: null });

    const { PUT } = await import("../route");
    const req = makeRequest("PUT", "http://localhost/api/indicadores/filters/filter-uuid", {
      name: "X",
      meta_ads_terms: ["y"],
    });
    await PUT(req, { params: Promise.resolve(params) });

    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("status");
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("status_changed_at");
  });

  describe("data de fim vencida manda no status", () => {
    const put = async (body: object) => {
      const { PUT } = await import("../route");
      return PUT(makeRequest("PUT", "http://localhost/api/indicadores/filters/filter-uuid", body), {
        params: Promise.resolve(params),
      });
    };

    beforeEach(() => {
      mockSingle.mockResolvedValueOnce({ data: { id: "filter-uuid" }, error: null });
    });

    it("com a data atual vencida, 'ativo' não é gravado", async () => {
      mockCurrentSingle.mockResolvedValueOnce({ data: { status: "ativo", end_date: "2020-01-10" }, error: null });
      await put({ name: "X", meta_ads_terms: ["y"], status: "ativo" });
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("status");
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("status_changed_at");
    });

    it("com a data atual vencida, 'finalizado' também não é regravado (não carimba a data)", async () => {
      mockCurrentSingle.mockResolvedValueOnce({ data: { status: "ativo", end_date: "2020-01-10" }, error: null });
      await put({ name: "X", meta_ads_terms: ["y"], status: "finalizado" });
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("status");
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("status_changed_at");
    });

    it("cancelar continua valendo com a data vencida", async () => {
      mockCurrentSingle.mockResolvedValueOnce({ data: { status: "ativo", end_date: "2020-01-10" }, error: null });
      await put({ name: "X", meta_ads_terms: ["y"], status: "cancelado" });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelado", status_changed_at: expect.any(String) })
      );
    });

    it("estender a data de fim reabre: 'ativo' é gravado", async () => {
      mockCurrentSingle.mockResolvedValueOnce({ data: { status: "ativo", end_date: "2020-01-10" }, error: null });
      await put({ name: "X", meta_ads_terms: ["y"], status: "ativo", start_date: "2020-01-01", end_date: "2999-12-31" });
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "ativo", end_date: "2999-12-31" }));
    });

    it("sem data de fim, o status manual é gravado normalmente", async () => {
      mockCurrentSingle.mockResolvedValueOnce({ data: { status: "ativo", end_date: null }, error: null });
      await put({ name: "X", meta_ads_terms: ["y"], status: "finalizado" });
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "finalizado" }));
    });

    it("a resposta devolve o evento vencido como finalizado, marcado como automático", async () => {
      mockSingle.mockReset();
      mockSingle.mockResolvedValueOnce({
        data: { id: "filter-uuid", status: "ativo", end_date: "2020-01-10", status_changed_at: null },
        error: null,
      });
      mockCurrentSingle.mockResolvedValueOnce({ data: { status: "ativo", end_date: "2020-01-10" }, error: null });
      const res = await put({ name: "X", meta_ads_terms: ["y"] });
      expect(await res.json()).toMatchObject({ status: "finalizado", status_automatico: true });
    });
  });

  it("returns 400 para status inválido", async () => {
    const { PUT } = await import("../route");
    const req = makeRequest("PUT", "http://localhost/api/indicadores/filters/filter-uuid", {
      name: "X",
      meta_ads_terms: ["y"],
      status: "arquivado",
    });
    const res = await PUT(req, { params: Promise.resolve(params) });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
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

  describe("debriefing_products", () => {
    const url = "http://localhost/api/indicadores/filters/filter-uuid";

    it.each([
      ["não-array", "x"],
      ["product_id vazio", [{ product_id: "", product_name: "A" }]],
      ["product_name vazio", [{ product_id: "1", product_name: "" }]],
      ["offer_codes inválido", [{ product_id: "1", product_name: "A", offer_codes: "a" }]],
      [
        "product_id repetido",
        [
          { product_id: "1", product_name: "A" },
          { product_id: "1", product_name: "B" },
        ],
      ],
    ])("retorna 400 para %s", async (_n, debriefing_products) => {
      const { PUT } = await import("../route");
      const res = await PUT(makeRequest("PUT", url, { debriefing_products }), {
        params: Promise.resolve(params),
      });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toMatch(/debriefing_products/);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("grava normalizado e aceita null para limpar", async () => {
      mockSingle.mockResolvedValue({ data: { id: "filter-uuid" }, error: null });
      const { PUT } = await import("../route");

      await PUT(
        makeRequest("PUT", url, { debriefing_products: [{ product_id: "1", product_name: "A" }] }),
        { params: Promise.resolve(params) }
      );
      expect(mockUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          debriefing_products: [{ product_id: "1", product_name: "A", offer_codes: [] }],
        })
      );

      await PUT(makeRequest("PUT", url, { debriefing_products: null }), {
        params: Promise.resolve(params),
      });
      expect(mockUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ debriefing_products: null })
      );
    });

    it("sem o campo, não toca em debriefing_products", async () => {
      mockSingle.mockResolvedValue({ data: { id: "filter-uuid" }, error: null });
      const { PUT } = await import("../route");
      await PUT(makeRequest("PUT", url, { name: "X" }), { params: Promise.resolve(params) });
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("debriefing_products");
    });
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


// ─── PUT: captação orgânica ──────────────────────────────────────────────────

describe("PUT /api/indicadores/filters/[id] (is_organic)", () => {
  const url = "http://localhost/api/indicadores/filters/filter-uuid";
  const call = async (body: object) => {
    const { PUT } = await import("../route");
    return PUT(makeRequest("PUT", url, body), { params: Promise.resolve(params) });
  };

  beforeEach(() => {
    mockSingle.mockResolvedValue({ data: { id: "filter-uuid" }, error: null });
  });

  it("persiste is_organic=true quando o payload traz termos", async () => {
    const res = await call({ is_organic: true, meta_ads_terms: ["t"] });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_organic: true }));
  });

  it("omitir is_organic não toca a coluna (mantém o valor atual)", async () => {
    mockCurrentSingle.mockResolvedValue({ data: { is_organic: false }, error: null });
    await call({ name: "Novo nome" });
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("is_organic");
  });

  it("não altera hotmart_products ao ligar o switch", async () => {
    await call({ is_organic: true, meta_ads_terms: ["t"] });
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("hotmart_products");
  });

  it("retorna 400 ao ligar orgânico num evento sem leads nem termo (estado atual)", async () => {
    mockCurrentSingle.mockResolvedValue({
      data: { is_organic: false, meta_ads_terms: [], captacao_leads_eventos: [] },
      error: null,
    });
    const res = await call({ is_organic: true });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("aceita ligar orgânico usando as fontes já salvas", async () => {
    mockCurrentSingle.mockResolvedValue({
      data: { is_organic: false, meta_ads_terms: ["t"], captacao_leads_eventos: [] },
      error: null,
    });
    const res = await call({ is_organic: true });
    expect(res.status).toBe(200);
  });

  it("retorna 400 ao esvaziar as fontes de um evento já orgânico", async () => {
    mockCurrentSingle.mockResolvedValue({
      data: { is_organic: true, meta_ads_terms: ["t"], captacao_leads_eventos: [] },
      error: null,
    });
    const res = await call({ meta_ads_terms: [] });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("evento pago pode esvaziar as fontes (regra atual inalterada)", async () => {
    mockCurrentSingle.mockResolvedValue({
      data: { is_organic: false, meta_ads_terms: ["t"], captacao_leads_eventos: [] },
      error: null,
    });
    const res = await call({ meta_ads_terms: [] });
    expect(res.status).toBe(200);
  });

  it("desligar orgânico (is_organic=false) não exige leads nem termo", async () => {
    const res = await call({ is_organic: false, meta_ads_terms: [], captacao_leads_eventos: [] });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_organic: false }));
  });

  it("retorna 400 quando is_organic não é booleano", async () => {
    const res = await call({ is_organic: "sim" });
    expect(res.status).toBe(400);
  });
});
