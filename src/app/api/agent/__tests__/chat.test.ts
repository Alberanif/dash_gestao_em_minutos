import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn(),
}));

jest.mock("@/lib/agent/graph", () => ({
  streamAgentResponse: jest.fn(),
}));

const mockFilterLookup = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockFilterLookup,
        }),
      }),
    }),
  })),
}));

import { validateApiAuth } from "@/lib/utils/api-auth";
import { streamAgentResponse } from "@/lib/agent/graph";

const mockValidateApiAuth = validateApiAuth as jest.MockedFunction<typeof validateApiAuth>;
const mockStreamAgentResponse = streamAgentResponse as jest.MockedFunction<typeof streamAgentResponse>;

const FILTER_ROW = {
  id: "f-1",
  account_id: "acc-1",
  name: "Ingresso PC Ao Vivo",
  hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
  meta_ads_terms: ["PC Ao Vivo"],
  captacao_leads_eventos: ["evento-a"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    message: "Qual foi minha receita?",
    history: [],
    filterId: "f-1",
    offerCode: null,
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    ...overrides,
  };
}

function makeRequest(body: unknown, signal?: AbortSignal): NextRequest {
  return new NextRequest("http://localhost/api/agent/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    signal,
  });
}

function emptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateApiAuth.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });
  mockStreamAgentResponse.mockResolvedValue(emptyStream());
  mockFilterLookup.mockResolvedValue({ data: FILTER_ROW, error: null });
});

describe("POST /api/agent/chat", () => {
  it("retorna 401 sem sessão", async () => {
    mockValidateApiAuth.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "gestor",
    });

    const { POST } = await import("../chat/route");
    expect((await POST(makeRequest(validBody()))).status).toBe(401);
  });

  it("retorna 400 sem message", async () => {
    const { POST } = await import("../chat/route");
    const res = await POST(makeRequest(validBody({ message: undefined })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("message is required");
  });

  it("retorna 400 sem filterId — o agente não responde fora de um escopo", async () => {
    const { POST } = await import("../chat/route");
    const res = await POST(makeRequest(validBody({ filterId: undefined })));

    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o filterId não existe", async () => {
    mockFilterLookup.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const { POST } = await import("../chat/route");
    const res = await POST(makeRequest(validBody({ filterId: "inexistente" })));

    expect(res.status).toBe(400);
    expect(mockStreamAgentResponse).not.toHaveBeenCalled();
  });

  it("carrega o filtro no servidor e passa o escopo expandido ao agente", async () => {
    const { POST } = await import("../chat/route");
    await POST(makeRequest(validBody()));

    const arg = mockStreamAgentResponse.mock.calls[0][0];
    expect(arg.scope.filter.productIds).toEqual(["111"]);
    expect(arg.scope.filter.metaTerms).toEqual(["PC Ao Vivo"]);
    expect(arg.state.filterName).toBe("Ingresso PC Ao Vivo");
    expect(arg.state.period).toEqual({ startDate: "2026-06-01", endDate: "2026-06-30" });
  });

  it("ignora um objeto de filtro forjado pelo cliente — só o filterId conta", async () => {
    const { POST } = await import("../chat/route");
    await POST(
      makeRequest(
        validBody({
          filter: {
            hotmart_products: [{ product_id: "999", product_name: "Produto de outra pessoa" }],
          },
          context: { hotmartData: { total_revenue: 999999 } },
        })
      )
    );

    const arg = mockStreamAgentResponse.mock.calls[0][0];
    expect(arg.scope.filter.productIds).toEqual(["111"]);
  });

  it("aplica o offerCode ao escopo", async () => {
    const { POST } = await import("../chat/route");
    await POST(makeRequest(validBody({ offerCode: "OFERTA-X" })));

    const arg = mockStreamAgentResponse.mock.calls[0][0];
    expect(arg.scope.filter.offerCode).toBe("OFERTA-X");
    expect(arg.state.offerCode).toBe("OFERTA-X");
  });

  it("entrega o erro do agente no corpo da resposta — o cliente nunca recebe stream vazio", async () => {
    const notice = "⚠️ Não consegui consultar os dados: conexão recusada. Tente novamente em instantes.";
    mockStreamAgentResponse.mockResolvedValue(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(notice));
          controller.close();
        },
      })
    );

    const { POST } = await import("../chat/route");
    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(notice);
  });

  it("entrega ao agente o cancelamento da request — desistir no cliente para o trabalho no servidor", async () => {
    // Quando o usuário aperta parar, o fetch é abortado e a conexão cai. Se esse
    // cancelamento não chegar ao agente, o modelo continua gerando — e cobrando —
    // sem ninguém do outro lado para ler.
    const client = new AbortController();

    const { POST } = await import("../chat/route");
    await POST(makeRequest(validBody(), client.signal));

    const { signal } = mockStreamAgentResponse.mock.calls[0][0];
    expect(signal).toBeDefined();
    expect(signal?.aborted).toBe(false);

    client.abort();

    expect(signal?.aborted).toBe(true);
  });

  it("responde 200 como stream em request válida", async () => {
    const { POST } = await import("../chat/route");
    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
