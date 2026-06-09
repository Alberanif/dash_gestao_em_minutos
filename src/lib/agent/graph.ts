import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { serializeDashboardContext } from "./context-serializer";
import type { DashboardContext } from "./types";
import {
  getMetaAdsMetrics,
  getHotmartMetrics,
  getLeadsMetrics,
  getDailySeries,
} from "./tools";
import type { AuthHeaders, ToolParams } from "./tools";

const toolParamsSchema = z.object({
  startDate: z.string().describe("Data inicial no formato YYYY-MM-DD"),
  endDate: z.string().describe("Data final no formato YYYY-MM-DD"),
  filterId: z.string().describe("ID do filtro ativo (string vazia se nenhum)"),
});

function buildTools(authHeaders: AuthHeaders) {
  return [
    new DynamicStructuredTool({
      name: "getMetaAdsMetrics",
      description: "Busca métricas do Meta Ads (spend, leads, impressões, CPL) para um período",
      schema: toolParamsSchema,
      func: async (params: ToolParams) => {
        const result = await getMetaAdsMetrics(params, authHeaders);
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: "getHotmartMetrics",
      description: "Busca métricas da Hotmart (receita, vendas) para um período",
      schema: toolParamsSchema,
      func: async (params: ToolParams) => {
        const result = await getHotmartMetrics(params, authHeaders);
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: "getLeadsMetrics",
      description: "Busca métricas de leads (total, por fonte) para um período",
      schema: toolParamsSchema,
      func: async (params: ToolParams) => {
        const result = await getLeadsMetrics(params, authHeaders);
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: "getDailySeries",
      description: "Busca a série diária de métricas para construção de gráficos",
      schema: toolParamsSchema,
      func: async (params: ToolParams) => {
        const result = await getDailySeries(params, authHeaders);
        return JSON.stringify(result);
      },
    }),
  ];
}

function buildSystemPrompt(ctx: DashboardContext): string {
  return `Você é o Analista, um assistente especializado em marketing digital e vendas online.
Responda sempre em português brasileiro, de forma clara e objetiva.
Ao fazer comparativos, mencione explicitamente os períodos que está comparando.
Sempre formate suas respostas em Markdown:
- Use **negrito** para destacar métricas e valores importantes
- Use cabeçalhos (### Título) para separar seções quando a resposta tiver múltiplos tópicos
- Use listas (- item) para enumerações e comparações
- Use tabelas Markdown quando apresentar dados comparativos lado a lado
- Use \`código\` para valores numéricos precisos quando relevante
Quando não houver dados suficientes, informe o usuário claramente.

[CONTEXTO DO DASHBOARD]
${serializeDashboardContext(ctx)}`;
}

export async function streamAgentResponse(input: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  context: DashboardContext;
  authHeaders: Record<string, string>;
}): Promise<ReadableStream<Uint8Array>> {
  const { message, history, context, authHeaders } = input;

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    streaming: true,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const tools = buildTools(authHeaders);

  const graph = createReactAgent({ llm: model, tools });

  const systemPrompt = buildSystemPrompt(context);

  // Build message list: system + history + current message
  const messages = [
    new SystemMessage(systemPrompt),
    ...history.map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
    new HumanMessage(message),
  ];

  const eventStream = graph.streamEvents({ messages }, { version: "v2" });

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of eventStream) {
          if (event.event === "on_chat_model_stream") {
            const chunk = event.data?.chunk;
            const content = chunk?.content;
            if (content && typeof content === "string" && content.length > 0) {
              controller.enqueue(encoder.encode(content));
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return readable;
}
