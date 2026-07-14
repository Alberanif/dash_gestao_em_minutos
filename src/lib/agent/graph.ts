import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { resolveAgentModel } from "./model";
import { buildSystemPrompt, type AgentState } from "./prompt";
import { buildAgentTools, type AgentScope } from "./tools";

/**
 * Um passo = uma ida ao modelo ou uma execução de tool. Uma pergunta legítima
 * resolve em poucos passos (comparar dois períodos = 2 consultas + 2 idas ao
 * modelo). Acima disso o modelo está em laço, não progredindo — 8 dá folga para
 * o caso real e ainda assim corta o laço antes de virar custo e espera.
 */
const STEP_LIMIT = 8;

/**
 * Teto de espera de uma resposta inteira (várias consultas + geração). Fica
 * abaixo do limite de execução da função serverless, para que quem espera receba
 * uma explicação nossa em vez do erro genérico da plataforma — ou de nada.
 */
const TIMEOUT_MS = 60_000;

/**
 * Quantos turnos da conversa vão ao modelo. O cliente manda o histórico inteiro,
 * então o teto é aplicado aqui: sem ele, cada pergunta carrega todas as anteriores
 * e a conversa fica progressivamente mais cara e mais lenta. 10 turnos cobrem o
 * encadeamento real ("e no mês passado?") sem pagar pela conversa toda.
 */
const HISTORY_TURNS = 10;

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

/**
 * O LangGraph sinaliza o estouro do limite de passos com este código de erro
 * (`GraphRecursionError`). Detectamos pelo código, não pelo texto da mensagem.
 */
function isStepLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { lc_error_code, name } = error as { lc_error_code?: string; name?: string };
  return lc_error_code === "GRAPH_RECURSION_LIMIT" || name === "GraphRecursionError";
}

/**
 * Toda falha do agente vira texto legível no chat. O usuário nunca fica sem
 * resposta: ou recebe a análise, ou recebe o motivo de não ter recebido. O erro
 * cru do grafo nunca é exibido — ele não diz nada a quem lê o dashboard.
 */
function describeFailure(error: unknown, timedOut: boolean): string {
  if (timedOut) {
    return (
      `⚠️ A consulta demorou mais de ${TIMEOUT_MS / 1000} segundos e foi interrompida. ` +
      `Tente de novo, ou pergunte sobre um período menor.`
    );
  }

  if (isStepLimitError(error)) {
    return (
      `⚠️ Fiz várias consultas seguidas e não cheguei a uma conclusão, então parei por aqui. ` +
      `Tente uma pergunta mais específica — por exemplo, um período de cada vez.`
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return `⚠️ Não consegui consultar os dados: ${message}. Tente novamente em instantes.`;
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
    ...history
      .slice(-HISTORY_TURNS)
      .map((turn) =>
        turn.role === "user" ? new HumanMessage(turn.content) : new AIMessage(turn.content)
      ),
    new HumanMessage(message),
  ];

  const abort = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    abort.abort();
  }, TIMEOUT_MS);

  const eventStream = graph.streamEvents(
    { messages },
    { version: "v2", recursionLimit: STEP_LIMIT, signal: abort.signal }
  );

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let emittedAnything = false;

      try {
        for await (const event of eventStream) {
          if (event.event === "on_chat_model_stream") {
            const content = event.data?.chunk?.content;
            if (typeof content === "string" && content.length > 0) {
              controller.enqueue(encoder.encode(content));
              emittedAnything = true;
            }
          }
        }
      } catch (error) {
        // Sem este catch, uma tool que estoura fecha o stream vazio e o usuário
        // recebe uma resposta em branco, sem saber que algo falhou.
        const notice = describeFailure(error, timedOut);
        controller.enqueue(encoder.encode(emittedAnything ? `\n\n${notice}` : notice));
      } finally {
        clearTimeout(timer);
        controller.close();
      }
    },
  });
}
