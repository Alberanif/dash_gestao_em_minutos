jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation((config) => ({ config })),
}));

const mockStreamEvents = jest.fn();

jest.mock("@langchain/langgraph/prebuilt", () => ({
  createReactAgent: jest.fn(() => ({ streamEvents: mockStreamEvents })),
}));

import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { streamAgentResponse, type ChatTurn, type StreamAgentInput } from "../graph";
import { expandFilter } from "@/lib/indicadores/filter-expansion";
import { makeFakeSupabase } from "@/lib/indicadores/__tests__/fake-supabase";

const MockChatOpenAI = ChatOpenAI as unknown as jest.Mock;
const mockCreateReactAgent = createReactAgent as unknown as jest.Mock;

function tokenEvents(...tokens: string[]) {
  return (async function* () {
    for (const token of tokens) {
      yield { event: "on_chat_model_stream", data: { chunk: { content: token } } };
    }
  })();
}

/** Tokens do modelo e, no meio do caminho, uma tool que estoura. */
function failingEvents(error: Error, ...tokensBefore: string[]) {
  return (async function* () {
    for (const token of tokensBefore) {
      yield { event: "on_chat_model_stream", data: { chunk: { content: token } } };
    }
    throw error;
  })();
}

function input(overrides: Partial<StreamAgentInput> = {}): StreamAgentInput {
  const filter = expandFilter({
    id: "f-1",
    account_id: "acc-1",
    name: "Ingresso",
    hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
    meta_ads_terms: [],
    captacao_leads_eventos: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  });

  return {
    message: "Qual foi minha receita?",
    history: [],
    scope: { filter, supabase: makeFakeSupabase().client },
    state: {
      today: "2026-07-14",
      period: { startDate: "2026-06-01", endDate: "2026-06-30" },
      filterName: "Ingresso",
      offerCode: null,
      sources: filter.sources,
    },
    ...overrides,
  };
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStreamEvents.mockReturnValue(tokenEvents());
});

describe("streamAgentResponse", () => {
  it("emite os tokens do modelo no stream", async () => {
    mockStreamEvents.mockReturnValue(tokenEvents("Sua receita ", "foi ", "R$ 250."));

    const stream = await streamAgentResponse(input());

    expect(await drain(stream)).toBe("Sua receita foi R$ 250.");
  });

  it("usa o modelo configurado em AGENT_MODEL", async () => {
    process.env.AGENT_MODEL = "gpt-5";

    await streamAgentResponse(input());

    expect(MockChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5" }));
    delete process.env.AGENT_MODEL;
  });

  it("dá ao modelo apenas tools de escopo fechado — nenhuma aceita filtro", async () => {
    await streamAgentResponse(input());

    const { tools } = mockCreateReactAgent.mock.calls[0][0];
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(Object.keys(tool.schema.shape).sort()).toEqual(["endDate", "startDate"]);
    }
  });

  it("manda o histórico da conversa antes da mensagem atual", async () => {
    await streamAgentResponse(
      input({
        history: [
          { role: "user", content: "e em maio?" },
          { role: "assistant", content: "Em maio foram R$ 100." },
        ],
      })
    );

    const { messages } = mockStreamEvents.mock.calls[0][0];
    expect(messages).toHaveLength(4); // system + 2 de histórico + mensagem atual
    expect(messages[messages.length - 1].content).toBe("Qual foi minha receita?");
  });

  it("uma tool que falha vira erro legível no chat — nunca resposta em branco", async () => {
    mockStreamEvents.mockReturnValue(
      failingEvents(new Error("relation dash_gestao_hotmart_sales does not exist"))
    );

    const stream = await streamAgentResponse(input());
    const out = await drain(stream);

    expect(out).not.toBe("");
    expect(out).toContain("Não consegui consultar os dados");
  });

  it("roda o grafo com um teto de passos — o laço de tools não corre solto", async () => {
    await streamAgentResponse(input());

    // O teto é aplicado pelo runtime do LangGraph; a config é o contrato com ele.
    const config = mockStreamEvents.mock.calls[0][1];
    expect(config.recursionLimit).toBeGreaterThan(0);
    expect(config.recursionLimit).toBeLessThanOrEqual(8);
  });

  it("ao bater o limite de passos, explica que parou — sem vazar o erro cru do grafo", async () => {
    // O que o LangGraph lança quando o modelo fica re-chamando tools sem concluir.
    const recursionError = Object.assign(
      new Error("Recursion limit of 8 reached without hitting a stop condition."),
      { name: "GraphRecursionError", lc_error_code: "GRAPH_RECURSION_LIMIT" }
    );
    mockStreamEvents.mockReturnValue(failingEvents(recursionError));

    const out = await drain(await streamAgentResponse(input()));

    expect(out).toContain("consultas");
    expect(out).not.toContain("Recursion limit");
  });

  it("uma consulta que passa do timeout é abortada e o usuário é informado", async () => {
    jest.useFakeTimers();

    // Um grafo que nunca responde: só termina quando alguém aborta o signal.
    mockStreamEvents.mockImplementation((_state, config: { signal: AbortSignal }) =>
      (async function* () {
        await new Promise<never>((_resolve, reject) => {
          config.signal.addEventListener("abort", () =>
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" }))
          );
        });
        yield { event: "on_chat_model_stream", data: { chunk: { content: "tarde demais" } } };
      })()
    );

    const drained = drain(await streamAgentResponse(input()));
    await jest.advanceTimersByTimeAsync(60_000);
    const out = await drained;

    jest.useRealTimers();

    expect(out).not.toContain("tarde demais");
    expect(out).toContain("demorou");
  });

  it("trunca o histórico no servidor — a décima pergunta não custa mais que a primeira", async () => {
    // O cliente manda a conversa inteira; o servidor decide o que vai ao modelo.
    const history: ChatTurn[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `turno ${i}`,
    }));

    await streamAgentResponse(input({ history }));

    const { messages } = mockStreamEvents.mock.calls[0][0];
    expect(messages).toHaveLength(12); // system + 10 turnos + mensagem atual

    const contents = messages.map((m: { content: string }) => m.content);
    expect(contents).toContain("turno 29"); // o mais recente sobrevive
    expect(contents).not.toContain("turno 19"); // o antigo é descartado
  });

  it("injeta o system prompt com o estado da tela e nenhum número", async () => {
    await streamAgentResponse(input());

    const { messages } = mockStreamEvents.mock.calls[0][0];
    const systemPrompt = messages[0].content as string;

    expect(systemPrompt).toContain("2026-07-14");
    expect(systemPrompt).toContain("Ingresso");
    expect(systemPrompt).not.toContain("total_revenue");
  });
});
