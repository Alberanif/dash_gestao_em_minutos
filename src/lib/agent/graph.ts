import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { resolveAgentModel } from "./model";
import { buildSystemPrompt, type AgentState } from "./prompt";
import { buildAgentTools, type AgentScope } from "./tools";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamAgentInput {
  message: string;
  history: ChatTurn[];
  scope: AgentScope;
  state: AgentState;
}

export async function streamAgentResponse(
  input: StreamAgentInput
): Promise<ReadableStream<Uint8Array>> {
  const { message, history, scope, state } = input;

  const model = new ChatOpenAI({
    model: resolveAgentModel(process.env),
    streaming: true,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const graph = createReactAgent({ llm: model, tools: buildAgentTools(scope) });

  const messages = [
    new SystemMessage(buildSystemPrompt(state)),
    ...history.map((turn) =>
      turn.role === "user" ? new HumanMessage(turn.content) : new AIMessage(turn.content)
    ),
    new HumanMessage(message),
  ];

  const eventStream = graph.streamEvents({ messages }, { version: "v2" });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of eventStream) {
          if (event.event === "on_chat_model_stream") {
            const content = event.data?.chunk?.content;
            if (typeof content === "string" && content.length > 0) {
              controller.enqueue(encoder.encode(content));
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}
