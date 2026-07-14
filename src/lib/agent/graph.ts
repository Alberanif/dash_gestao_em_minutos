import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { resolveAgentModel } from "./model";
import { buildSystemPrompt, type AgentState } from "./prompt";
import { buildAgentTools, type AgentScope } from "./tools";
import { encodeFrame, type AgentFrame, type FramePeriod } from "./sse";

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
  /**
   * O cancelamento vindo do cliente (o signal da request). Abortá-lo encerra o
   * trabalho em curso — inclusive a chamada ao modelo, que é o que se paga.
   */
  signal?: AbortSignal;
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

/**
 * O período que a tool está consultando, tirado do input com que o modelo a
 * chamou — é o que o chat exibe enquanto espera. O LangGraph às vezes aninha o
 * input um nível; e o modelo pode chamar a tool com argumento malformado. Nada
 * disso pode derrubar o stream: sem período legível, o frame vai com `null`.
 */
function readPeriod(input: unknown): FramePeriod | null {
  if (typeof input !== "object" || input === null) return null;

  const candidate = input as { startDate?: unknown; endDate?: unknown; input?: unknown };
  const { startDate, endDate } = candidate;

  if (typeof startDate === "string" && typeof endDate === "string") {
    return { startDate, endDate };
  }

  return candidate.input === undefined ? null : readPeriod(candidate.input);
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

  // Um único abort para o grafo, com duas razões possíveis de disparar: o teto de
  // tempo e a desistência do cliente. As duas encerram o mesmo trabalho — o que
  // muda é só o que se diz a quem ficou olhando.
  const abort = new AbortController();
  let timedOut = false;
  let cancelledByClient = false;

  const timer = setTimeout(() => {
    timedOut = true;
    abort.abort();
  }, TIMEOUT_MS);

  const cancelWork = () => {
    cancelledByClient = true;
    abort.abort();
  };

  // Sem esta ponte, apertar parar só faz o cliente deixar de ler: o modelo segue
  // gerando do outro lado, até o fim, e a conta chega igual.
  const clientSignal = input.signal;
  if (clientSignal) {
    if (clientSignal.aborted) cancelWork();
    else clientSignal.addEventListener("abort", cancelWork, { once: true });
  }

  const eventStream = graph.streamEvents(
    { messages },
    { version: "v2", recursionLimit: STEP_LIMIT, signal: abort.signal }
  );

  /** Ninguém do outro lado: escrever no stream a partir daqui é erro de estado. */
  let streamGone = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (frame: AgentFrame) => {
        if (streamGone) return;
        controller.enqueue(encoder.encode(encodeFrame(frame)));
      };

      try {
        for await (const event of eventStream) {
          if (event.event === "on_chat_model_stream") {
            const content = event.data?.chunk?.content;
            if (typeof content === "string" && content.length > 0) {
              emit({ type: "token", content });
            }
            continue;
          }

          // Enquanto uma tool roda, o modelo não emite token nenhum. Sem estes
          // frames o chat fica mudo por segundos e o usuário conclui que travou.
          if (event.event === "on_tool_start") {
            emit({
              type: "tool_start",
              tool: event.name ?? "",
              period: readPeriod(event.data?.input),
            });
            continue;
          }

          if (event.event === "on_tool_end") {
            emit({ type: "tool_end", tool: event.name ?? "" });
          }
        }
      } catch (error) {
        // Parar de propósito não é falhar. O abort do cliente chega aqui como
        // exceção do grafo, mas virar "⚠️ ocorreu um erro" seria mentir: o
        // usuário mandou parar, e o texto parcial é a resposta dele.
        if (!cancelledByClient) {
          // Sem este catch, uma tool que estoura fecha o stream vazio e o usuário
          // recebe uma resposta em branco, sem saber que algo falhou. Os tokens já
          // emitidos continuam valendo: a resposta parcial não se perde — quem
          // junta o aviso ao texto parcial é o cliente.
          emit({ type: "error", message: describeFailure(error, timedOut) });
        }
      } finally {
        emit({ type: "done" });
        clearTimeout(timer);
        clientSignal?.removeEventListener("abort", cancelWork);
        if (!streamGone) controller.close();
      }
    },

    /**
     * O cliente fechou a conexão sem abortar o signal (o runtime nem sempre
     * expõe as duas coisas). Cancelar o grafo aqui também é o que garante que
     * nenhum caminho de desconexão deixe o modelo gerando sozinho.
     */
    cancel() {
      streamGone = true;
      cancelWork();
      clearTimeout(timer);
    },
  });
}
