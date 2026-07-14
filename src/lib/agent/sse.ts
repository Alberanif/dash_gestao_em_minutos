/**
 * Contrato dos frames que o agente envia ao chat. Servidor codifica, cliente
 * parseia, os dois contra o mesmo tipo: um frame novo não pode nascer numa ponta
 * sem a outra saber lê-lo.
 */

/** O intervalo que uma consulta está lendo. */
export interface FramePeriod {
  startDate: string;
  endDate: string;
}

/** Um pedaço do texto que o modelo está gerando. */
export interface TokenFrame {
  type: "token";
  content: string;
}

/**
 * Uma consulta começou. Carrega o período porque é isso que o chat mostra
 * enquanto espera ("Consultando dados de 01/06 a 30/06...") — sem ele, o usuário
 * não percebe que o agente entendeu errado a pergunta senão no fim.
 * `period` é `null` quando a tool foi chamada sem um intervalo legível.
 */
export interface ToolStartFrame {
  type: "tool_start";
  tool: string;
  period: FramePeriod | null;
}

/** A consulta terminou. O indicador sai da tela. */
export interface ToolEndFrame {
  type: "tool_end";
  tool: string;
}

/** A falha, já traduzida para algo que se possa ler no chat. */
export interface ErrorFrame {
  type: "error";
  message: string;
}

/** O fim da resposta — chega mesmo quando houve erro. */
export interface DoneFrame {
  type: "done";
}

export type AgentFrame = TokenFrame | ToolStartFrame | ToolEndFrame | ErrorFrame | DoneFrame;

const FRAME_PREFIX = "data: ";

/** Um frame por evento SSE, no formato `data: <json>\n\n`. */
export function encodeFrame(frame: AgentFrame): string {
  return `${FRAME_PREFIX}${JSON.stringify(frame)}\n\n`;
}

export interface FrameParser {
  push(chunk: string): AgentFrame[];
}

/**
 * A rede corta onde quer: um chunk pode trazer meio frame, ou três de uma vez. O
 * parser guarda o resto entre leituras e só entrega frame completo — sem isso, um
 * token some no meio da resposta ou um JSON pela metade derruba o stream.
 */
export function createFrameParser(): FrameParser {
  let buffer = "";

  return {
    push(chunk: string): AgentFrame[] {
      buffer += chunk;

      const blocks = buffer.split("\n\n");
      // O último pedaço só está completo se o chunk terminou na fronteira; até
      // lá ele fica no buffer, esperando o resto chegar.
      buffer = blocks.pop() ?? "";

      return blocks
        .filter((block) => block.startsWith(FRAME_PREFIX))
        .map((block) => JSON.parse(block.slice(FRAME_PREFIX.length)) as AgentFrame);
    },
  };
}
