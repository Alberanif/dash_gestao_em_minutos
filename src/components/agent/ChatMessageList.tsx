import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '@/hooks/use-agent-chat';

interface ChatMessageListProps {
  messages: Message[];
}

const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => (
    <p style={{ margin: '4px 0', lineHeight: 1.6 }}>{children}</p>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: 'var(--text, #e8e8ed)' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontStyle: 'italic' }}>{children}</em>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: '6px 0', paddingLeft: 18, listStyleType: 'disc' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '6px 0', paddingLeft: 18 }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ margin: '2px 0', lineHeight: 1.6 }}>{children}</li>
  ),
  h1: ({ children }) => (
    <h1 style={{ fontSize: 16, fontWeight: 700, margin: '10px 0 4px', color: 'var(--text, #e8e8ed)' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 4px', color: 'var(--text, #e8e8ed)' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 2px', color: 'var(--violet, #7c3aed)' }}>{children}</h3>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <pre style={{ background: 'var(--surface-2, #1c1c21)', borderRadius: 6, padding: '8px 12px', overflowX: 'auto', margin: '6px 0' }}>
          <code style={{ fontSize: 12, fontFamily: 'monospace', color: '#a3e635' }}>{children}</code>
        </pre>
      );
    }
    return (
      <code style={{ background: 'var(--surface-2, #1c1c21)', borderRadius: 4, padding: '1px 5px', fontSize: 12, fontFamily: 'monospace', color: '#a3e635' }}>
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '3px solid var(--violet, #7c3aed)', paddingLeft: 10, margin: '6px 0', color: 'var(--text-muted, #a1a1aa)' }}>
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ borderBottom: '1px solid var(--border, #2e2e38)', padding: '4px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--violet, #7c3aed)' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ borderBottom: '1px solid var(--border, #2e2e38)', padding: '4px 8px' }}>{children}</td>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid var(--border, #2e2e38)', margin: '8px 0' }} />
  ),
};

export function ChatMessageList({ messages }: ChatMessageListProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {messages.map((msg, idx) => {
        if (msg.role === 'user') {
          return (
            <div key={idx} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  maxWidth: '80%',
                  background: 'var(--surface-2, #1c1c21)',
                  color: 'var(--text, #e8e8ed)',
                  borderRadius: '12px 12px 2px 12px',
                  padding: '10px 14px',
                  fontSize: 13,
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        }

        // assistant
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--violet, #7c3aed)',
              }}
            >
              Analista
            </span>
            <div
              style={{
                maxWidth: '90%',
                color: 'var(--text, #e8e8ed)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}
