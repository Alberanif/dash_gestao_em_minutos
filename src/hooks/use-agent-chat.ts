import { useState } from 'react';
import type { DashboardContext } from '@/lib/agent/types';

export type { DashboardContext };

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  async function sendMessage(text: string, context: DashboardContext): Promise<void> {
    // Add user message immediately
    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      const history = messages; // snapshot before this message
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, context }),
      });

      let accumulated = '';

      if (!response.ok) {
        const status = response.status;
        const msg = status === 401
          ? 'Sessão expirada. Faça login novamente.'
          : `Erro ao contatar o agente (${status}). Tente novamente.`;
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
        return;
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Add assistant placeholder
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
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
