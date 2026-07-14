import { useState } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
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

  async function sendMessage(text: string, scope: AgentScopeInput): Promise<void> {
    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      const history = messages; // snapshot antes desta mensagem
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        let accumulated = '';

        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const captured = accumulated;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: captured };
            return next;
          });
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Ocorreu um erro ao processar sua mensagem. Tente novamente.' },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  function clearHistory() {
    setMessages([]);
  }

  return { messages, isStreaming, sendMessage, clearHistory };
}
