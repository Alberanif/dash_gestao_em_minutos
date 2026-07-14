import { useRef, useState } from 'react';
import { createFrameParser, type FramePeriod } from '@/lib/agent/sse';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * A consulta que o agente está executando *neste instante* — `null` quando ele
 * não está consultando nada. É efêmera por natureza: nasce no `tool_start`,
 * morre no `tool_end`.
 */
export interface ActiveQuery {
  tool: string;
  period: FramePeriod | null;
}


/**
 * O que o cliente manda ao agente. Apenas o *id* do filtro: o servidor carrega
 * o registro e decide o que ele significa. O cliente não pode forjar quais
 * produtos serão lidos, nem injetar um snapshot de métricas.
 */
export interface AgentScopeInput {
  filterId: string;
  offerCode: string | null;
  startDate: string;
  endDate: string;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // Uma pilha, não um slot: comparar dois períodos faz o modelo emitir dois
  // tool_calls no mesmo turno, e o LangGraph roda os dois em paralelo. Com um slot
  // só, o `tool_end` da primeira apagaria o indicador enquanto a segunda ainda
  // estivesse no banco — o chat voltaria a ficar mudo no meio do trabalho.
  const [queriesEmVoo, setQueriesEmVoo] = useState<ActiveQuery[]>([]);
  const activeQuery = queriesEmVoo.at(-1) ?? null;

  /** O abort da resposta em curso. Vive num ref: trocá-lo não re-renderiza nada. */
  const abortRef = useRef<AbortController | null>(null);

  async function sendMessage(text: string, scope: AgentScopeInput): Promise<void> {
    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    // Cada envio tem o seu controller: o abort de uma resposta anterior não pode
    // matar a próxima.
    const controller = new AbortController();
    abortRef.current = controller;

    // O texto que já chegou, e o balão do assistente onde ele está sendo escrito.
    // Vivem fora do `try` porque o `catch` precisa dos dois: uma falha depois do
    // primeiro byte tem que entrar *naquele* balão, não em um novo.
    let accumulated = '';
    let placeholderNaTela = false;

    const render = (content: string) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content };
        return next;
      });

    /** O aviso entra depois da resposta parcial; sem resposta, é a resposta. */
    const anexarAviso = (aviso: string) => {
      accumulated = accumulated ? `${accumulated}\n\n${aviso}` : aviso;
      render(accumulated);
    };

    try {
      const history = messages; // snapshot antes desta mensagem
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // O sinal vai ao fetch, não só ao laço de leitura: abortar o fetch
        // derruba a conexão, e é a queda dela que faz o servidor cancelar o
        // trabalho em curso. Parar de ler, sozinho, deixaria o modelo gerando
        // (e cobrando) do outro lado.
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history,
          filterId: scope.filterId,
          offerCode: scope.offerCode,
          startDate: scope.startDate,
          endDate: scope.endDate,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const msg =
          status === 401
            ? 'Sessão expirada. Faça login novamente.'
            : `Erro ao contatar o agente (${status}). Tente novamente.`;
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
        return;
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = createFrameParser();

        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
        placeholderNaTela = true;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
            if (frame.type === 'token') {
              accumulated += frame.content;
              render(accumulated);
            } else if (frame.type === 'tool_start') {
              setQueriesEmVoo((prev) => [...prev, { tool: frame.tool, period: frame.period }]);
            } else if (frame.type === 'tool_end') {
              setQueriesEmVoo((prev) => prev.slice(0, -1));
            } else if (frame.type === 'error') {
              anexarAviso(frame.message);
            }
          }
        }
      }
    } catch {
      // Parar de propósito não é falhar. O texto que já chegou fica como está —
      // limpo, sem aviso nenhum. Só um erro de verdade vira mensagem de erro.
      if (!controller.signal.aborted) {
        const aviso = 'Ocorreu um erro ao processar sua mensagem. Tente novamente.';
        // A rede caindo no meio do stream é falha *fora* do agente, então não vem
        // como frame `error` — e o balão do assistente já está na tela. Empurrar
        // uma mensagem nova aqui deixaria um balão vazio acima do aviso: o mesmo
        // "resposta em branco" que esta refatoração existe para matar.
        if (placeholderNaTela) {
          anexarAviso(aviso);
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: aviso }]);
        }
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
      // Uma consulta que morre no meio (erro, timeout, abort) nunca manda o
      // `tool_end` que a fecharia. Sem isto o indicador fica preso na tela para
      // sempre, anunciando um trabalho que já acabou.
      setQueriesEmVoo([]);
    }
  }

  /** Interrompe a resposta em andamento. Sem nada em curso, não faz nada. */
  function stop() {
    abortRef.current?.abort();
  }

  function clearHistory() {
    setMessages([]);
  }

  return { messages, isStreaming, activeQuery, sendMessage, stop, clearHistory };
}
