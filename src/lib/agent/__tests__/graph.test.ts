import type { DashboardContext } from "../types";

// Mock @langchain/openai before importing graph
jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn(),
}));

// Mock @langchain/langgraph/prebuilt
jest.mock("@langchain/langgraph/prebuilt", () => ({
  createReactAgent: jest.fn(),
}));

// Mock @langchain/core/messages
jest.mock("@langchain/core/messages", () => ({
  HumanMessage: jest.fn().mockImplementation((content: string) => ({ _type: "human", content })),
  AIMessage: jest.fn().mockImplementation((content: string) => ({ _type: "ai", content })),
  SystemMessage: jest.fn().mockImplementation((content: string) => ({ _type: "system", content })),
}));

// Mock tools module
jest.mock("../tools", () => ({
  getMetaAdsMetrics: jest.fn(),
  getHotmartMetrics: jest.fn(),
  getLeadsMetrics: jest.fn(),
  getDailySeries: jest.fn(),
}));

import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { streamAgentResponse } from "../graph";

const MockChatOpenAI = ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>;
const mockCreateReactAgent = createReactAgent as jest.MockedFunction<typeof createReactAgent>;

function makeContext(overrides: Partial<DashboardContext> = {}): DashboardContext {
  return {
    activeFilter: null,
    startDate: "2026-05-01",
    endDate: "2026-05-31",
    activePreset: "last30days",
    metaData: null,
    hotmartData: null,
    leadsData: null,
    ...overrides,
  };
}

function makeAsyncGenerator<T>(items: T[]): AsyncGenerator<T> {
  return (async function* () {
    for (const item of items) {
      yield item;
    }
  })();
}

describe("streamAgentResponse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna um ReadableStream", async () => {
    // Arrange: mock agent with empty stream
    const mockGraph = {
      streamEvents: jest.fn().mockReturnValue(makeAsyncGenerator([])),
    };
    mockCreateReactAgent.mockReturnValue(mockGraph as unknown as ReturnType<typeof createReactAgent>);
    MockChatOpenAI.mockImplementation(() => ({}) as unknown as InstanceType<typeof ChatOpenAI>);

    // Act
    const result = await streamAgentResponse({
      message: "Olá",
      history: [],
      context: makeContext(),
      authHeaders: {},
    });

    // Assert
    expect(result).toBeInstanceOf(ReadableStream);
  });

  it("o stream emite texto quando o LLM responde com tokens", async () => {
    // Arrange: simulate on_chat_model_stream events (ChatOpenAI emits AIMessageChunk with .content)
    const events = [
      { event: "on_chat_model_stream", data: { chunk: { content: "Olá, " } } },
      { event: "on_chat_model_stream", data: { chunk: { content: "como posso ajudar?" } } },
    ];
    const mockGraph = {
      streamEvents: jest.fn().mockReturnValue(makeAsyncGenerator(events)),
    };
    mockCreateReactAgent.mockReturnValue(mockGraph as unknown as ReturnType<typeof createReactAgent>);
    MockChatOpenAI.mockImplementation(() => ({}) as unknown as InstanceType<typeof ChatOpenAI>);

    // Act
    const stream = await streamAgentResponse({
      message: "Olá",
      history: [],
      context: makeContext(),
      authHeaders: {},
    });

    // Collect all chunks from the stream
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }

    // Assert
    expect(text).toContain("Olá, ");
    expect(text).toContain("como posso ajudar?");
  });

  it("quando há histórico, as mensagens anteriores são incluídas no grafo", async () => {
    // Arrange
    const mockGraph = {
      streamEvents: jest.fn().mockReturnValue(makeAsyncGenerator([])),
    };
    mockCreateReactAgent.mockReturnValue(mockGraph as unknown as ReturnType<typeof createReactAgent>);
    MockChatOpenAI.mockImplementation(() => ({}) as unknown as InstanceType<typeof ChatOpenAI>);

    const history = [
      { role: "user" as const, content: "Qual foi o spend de ontem?" },
      { role: "assistant" as const, content: "O spend foi R$ 500." },
    ];

    // Act
    await streamAgentResponse({
      message: "E hoje?",
      history,
      context: makeContext(),
      authHeaders: {},
    });

    // Assert: streamEvents was called with messages containing the history
    expect(mockGraph.streamEvents).toHaveBeenCalledTimes(1);
    const callArgs = mockGraph.streamEvents.mock.calls[0][0];
    const messages: Array<{ _type: string; content: string }> = callArgs.messages;

    // Should include history messages + current message
    const contents = messages.map((m) => m.content);
    expect(contents).toContain("Qual foi o spend de ontem?");
    expect(contents).toContain("O spend foi R$ 500.");
    expect(contents).toContain("E hoje?");
  });

  it("eventos que não são on_chat_model_stream são ignorados", async () => {
    // Arrange: mix of event types
    const events = [
      { event: "on_chain_start", data: {} },
      { event: "on_chat_model_stream", data: { chunk: { content: "token" } } },
      { event: "on_tool_start", data: {} },
    ];
    const mockGraph = {
      streamEvents: jest.fn().mockReturnValue(makeAsyncGenerator(events)),
    };
    mockCreateReactAgent.mockReturnValue(mockGraph as unknown as ReturnType<typeof createReactAgent>);
    MockChatOpenAI.mockImplementation(() => ({}) as unknown as InstanceType<typeof ChatOpenAI>);

    // Act
    const stream = await streamAgentResponse({
      message: "teste",
      history: [],
      context: makeContext(),
      authHeaders: {},
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }

    // Assert: only the llm_stream token was emitted
    expect(text).toBe("token");
  });
});
