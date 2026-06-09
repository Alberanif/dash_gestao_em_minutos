import React from 'react';

interface AgentFABProps {
  onClick: () => void;
}

export function AgentFAB({ onClick }: AgentFABProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 50,
        width: 52,
        height: 52,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: 'var(--violet, #7c3aed)',
        color: 'white',
        fontSize: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
      aria-label="Abrir assistente"
    >
      ✨
    </button>
  );
}
