import { NextRequest } from "next/server";

// ── Mock do client Supabase de serviço (usado pelo webhook para escrever) ──────
// Um único mockFrom despacha por nome de tabela, para distinguir:
//   - dash_gestao_hotmart_sales  → .update().eq() (fluxo atual) e .upsert() (passo aditivo)
//   - dash_gestao_ultimates_cycles → .select().eq().eq().limit() (lookup do passo aditivo)
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
const mockUpsert = jest.fn();

const mockCyclesLimit = jest.fn();
const mockCyclesEq = jest.fn();
const mockCyclesSelect = jest.fn(() => ({ eq: mockCyclesEq }));

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({ from: mockFrom }),
  createSupabaseServiceClient: jest.fn().mockReturnValue({ from: mockFrom }),
}));

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/hotmart/webhook", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

const VALID_HEADERS = { "x-hotmart-hottok": "test-token" };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.HOTMART_WEBHOOK_TOKEN = "test-token";

  // Fluxo atual: update de status por transaction_code resolve sem erro.
  mockUpdateEq.mockResolvedValue({ error: null });
  // Passo aditivo: upsert resolve sem erro.
  mockUpsert.mockResolvedValue({ error: null });

  // Lookup de ciclos: encadeamento .eq().eq().limit() → array de ciclos ativos.
  mockCyclesEq.mockReturnValue({ eq: mockCyclesEq, limit: mockCyclesLimit });
  mockCyclesLimit.mockResolvedValue({ data: [], error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === "dash_gestao_hotmart_sales") {
      return { update: mockUpdate, upsert: mockUpsert };
    }
    if (table === "dash_gestao_ultimates_cycles") {
      return { select: mockCyclesSelect };
    }
    return {};
  });
});

// ─── Rede de segurança: comportamento ATUAL do webhook (não pode mudar) ────────

describe("POST /api/hotmart/webhook — comportamento existente (rede de segurança)", () => {
  it("retorna 401 quando o hottok é inválido", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(
      { event: "PURCHASE_APPROVED", data: { purchase: { transaction: "HP1", status: "APPROVED" } } },
      { "x-hotmart-hottok": "wrong" }
    );
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("retorna 401 quando o header hottok está ausente", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({
      event: "PURCHASE_APPROVED",
      data: { purchase: { transaction: "HP1", status: "APPROVED" } },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("ignora evento fora de RELEVANT_EVENTS com { ok: true, skipped: true }", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({ event: "SUBSCRIPTION_CANCELLATION", data: {} }, VALID_HEADERS);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, skipped: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("retorna 400 quando transaction ou status estão ausentes", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({ event: "PURCHASE_APPROVED", data: { purchase: {} } }, VALID_HEADERS);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Missing transaction or status" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("payload válido: atualiza status por transaction_code e retorna { ok: true }", async () => {
    const { POST } = await import("../route");
    const req = makeRequest(
      { event: "PURCHASE_APPROVED", data: { purchase: { transaction: "HP-123", status: "APPROVED" } } },
      VALID_HEADERS
    );
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_hotmart_sales");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "APPROVED", collected_at: expect.any(String) })
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("transaction_code", "HP-123");
  });

  it("retorna 500 quando o update de status falha", async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: "db down" } });

    const { POST } = await import("../route");
    const req = makeRequest(
      { event: "PURCHASE_APPROVED", data: { purchase: { transaction: "HP-123", status: "APPROVED" } } },
      VALID_HEADERS
    );
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "db down" });
  });
});

// ─── Passo aditivo Dash Ultimates (RF-6, critério 7) — à prova de falha ────────

describe("POST /api/hotmart/webhook — passo aditivo Dash Ultimates (isolação)", () => {
  const monitoredPayload = {
    event: "PURCHASE_APPROVED",
    data: {
      product: { id: 555, name: "Curso Ultimate" },
      buyer: { email: "comprador@example.com" },
      purchase: {
        transaction: "HP-999",
        status: "APPROVED",
        price: { value: 497.9 },
        order_date: 1_700_000_000_000,
        approved_date: 1_700_000_100_000,
      },
    },
  };

  it("(a) payload malformado no passo novo (sem data.product): resposta e update de status idênticos", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("../route");
    const req = makeRequest(
      { event: "PURCHASE_APPROVED", data: { purchase: { transaction: "HP-777", status: "APPROVED" } } },
      VALID_HEADERS
    );
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    // Fluxo atual intacto:
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "APPROVED" })
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("transaction_code", "HP-777");
    // Sem produto → nenhum upsert:
    expect(mockUpsert).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("(b) erro de banco no passo novo (upsert rejeita): resposta e update de status inalterados", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCyclesLimit.mockResolvedValueOnce({ data: [{ account_id: "acc-1" }], error: null });
    mockUpsert.mockRejectedValueOnce(new Error("upsert boom"));

    const { POST } = await import("../route");
    const req = makeRequest(monitoredPayload, VALID_HEADERS);
    const res = await POST(req);
    const body = await res.json();

    // Resposta EXATAMENTE a atual, apesar do erro no passo aditivo:
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    // Update de status atual aconteceu:
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "APPROVED" }));
    expect(mockUpdateEq).toHaveBeenCalledWith("transaction_code", "HP-999");
    // Erro engolido e logado:
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("(c) produto NÃO monitorado (nenhum ciclo ativo): nenhum upsert; resposta e update idênticos", async () => {
    mockCyclesLimit.mockResolvedValueOnce({ data: [], error: null });

    const { POST } = await import("../route");
    const req = makeRequest(monitoredPayload, VALID_HEADERS);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "APPROVED" }));
    expect(mockUpdateEq).toHaveBeenCalledWith("transaction_code", "HP-999");
    // Lookup ocorreu, mas nenhum ciclo ativo → sem upsert:
    expect(mockFrom).toHaveBeenCalledWith("dash_gestao_ultimates_cycles");
    expect(mockCyclesEq).toHaveBeenCalledWith("product_id", "555");
    expect(mockCyclesEq).toHaveBeenCalledWith("status", "ativo");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("(d) produto monitorado: upsert com transaction_code, product_id, email, price, datas, collected_at e account_id do ciclo", async () => {
    mockCyclesLimit.mockResolvedValueOnce({ data: [{ account_id: "acc-42" }], error: null });

    const { POST } = await import("../route");
    const req = makeRequest(monitoredPayload, VALID_HEADERS);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [row, options] = mockUpsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "transaction_code" });
    expect(row).toEqual(
      expect.objectContaining({
        account_id: "acc-42",
        transaction_code: "HP-999",
        product_id: "555",
        buyer_email: "comprador@example.com",
        status: "APPROVED",
        price: 497.9,
        purchase_date: new Date(1_700_000_000_000).toISOString(),
        approved_date: new Date(1_700_000_100_000).toISOString(),
        collected_at: expect.any(String),
      })
    );
  });

  // ── Identidade do comprador (PRD #146) ──────────────────────────────────────

  it("(e) payload com nome e telefone: upsert inclui buyer_name e buyer_phone", async () => {
    mockCyclesLimit.mockResolvedValueOnce({ data: [{ account_id: "acc-42" }], error: null });

    const { POST } = await import("../route");
    const req = makeRequest(
      {
        ...monitoredPayload,
        data: {
          ...monitoredPayload.data,
          buyer: {
            email: "comprador@example.com",
            name: "  Maria Souza  ",
            checkout_phone: " 11988887777 ",
          },
        },
      },
      VALID_HEADERS
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    const [row] = mockUpsert.mock.calls[0];
    expect(row).toEqual(
      expect.objectContaining({
        buyer_name: "Maria Souza",
        buyer_phone: "11988887777",
      })
    );
  });

  // Regra 4.3 do PRD #146: campo ausente ⇒ chave OMITIDA, jamais enviada como
  // null. O upsert do PostgREST só atualiza as colunas presentes no payload —
  // enviar null aqui faria um evento de estorno (que não repete os dados do
  // comprador) apagar o nome que o cron já havia gravado para a mesma
  // transação.
  it("(f) payload sem nome/telefone: as chaves são OMITIDAS do upsert, não enviadas como null", async () => {
    mockCyclesLimit.mockResolvedValueOnce({ data: [{ account_id: "acc-42" }], error: null });

    const { POST } = await import("../route");
    const req = makeRequest(monitoredPayload, VALID_HEADERS);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const [row] = mockUpsert.mock.calls[0];
    expect(Object.keys(row)).not.toContain("buyer_name");
    expect(Object.keys(row)).not.toContain("buyer_phone");
  });

  it("(g) payload com nome em branco: chave omitida (string vazia não sobrescreve)", async () => {
    mockCyclesLimit.mockResolvedValueOnce({ data: [{ account_id: "acc-42" }], error: null });

    const { POST } = await import("../route");
    const req = makeRequest(
      {
        ...monitoredPayload,
        data: {
          ...monitoredPayload.data,
          buyer: { email: "comprador@example.com", name: "   ", checkout_phone: "" },
        },
      },
      VALID_HEADERS
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    const [row] = mockUpsert.mock.calls[0];
    expect(Object.keys(row)).not.toContain("buyer_name");
    expect(Object.keys(row)).not.toContain("buyer_phone");
  });
});
