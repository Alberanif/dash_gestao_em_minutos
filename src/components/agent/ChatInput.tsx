import React, { useState } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = value.trim();
      if (!text || isStreaming) return;
      onSend(text);
      setValue('');
    }
  }

  function handleSendClick() {
    const text = value.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setValue('');
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border, #2a2a2e)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}
    >
      <textarea
        data-testid="chat-textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isStreaming}
        rows={3}
        placeholder={isStreaming ? 'Aguardando resposta…' : 'Pergunte algo sobre os dados…'}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--surface, #18181b)',
          border: '1px solid var(--border, #2a2a2e)',
          borderRadius: 8,
          padding: '8px 12px',
          color: 'var(--text, #e8e8ed)',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
      <button
        data-testid="chat-send"
        onClick={handleSendClick}
        disabled={isStreaming || !value.trim()}
        aria-label="Enviar"
        style={{
          padding: '8px 14px',
          background: 'var(--violet, #7c3aed)',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: isStreaming ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 600,
          opacity: isStreaming ? 0.6 : 1,
        }}
      >
        ↑
      </button>
    </div>
  );
}
