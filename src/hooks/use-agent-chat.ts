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
  const [activeQuery, setActiveQuery] = useState<ActiveQuery | null>(null);
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
        let accumulated = '';

        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        const render = (content: string) =>
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content };
            return next;
          });

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
            if (frame.type === 'token') {
              accumulated += frame.content;
              render(accumulated);
            } else if (frame.type === 'tool_start') {
              setActiveQuery({ tool: frame.tool, period: frame.period });
            } else if (frame.type === 'tool_end') {
              setActiveQuery(null);
            } else if (frame.type === 'error') {
              // A resposta parcial não se perde: o aviso entra depois dela, não
              // no lugar dela. Sem conteúdo antes, o aviso é a resposta — o que
              // nunca pode acontecer é a mensagem chegar em branco.
              accumulated = accumulated
                ? `${accumulated}\n\n${frame.message}`
                : frame.message;
              render(accumulated);
            }
          }
        }
      }
    } catch {
      // Parar de propósito não é falhar. O texto que já chegou fica como está —
      // limpo, sem aviso nenhum. Só um erro de verdade vira mensagem de erro.
      if (!controller.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Ocorreu um erro ao processar sua mensagem. Tente novamente.' },
        ]);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
      // Uma consulta que morre no meio (erro, timeout, abort) nunca manda o
      // `tool_end` que a fecharia. Sem isto o indicador fica preso na tela para
      // sempre, anunciando um trabalho que já acabou.
      setActiveQuery(null);
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
