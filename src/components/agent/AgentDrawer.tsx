import React from 'react';

interface AgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function AgentDrawer({ isOpen, onClose, children }: AgentDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay semitransparente */}
      <div
        data-testid="drawer-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 50,
        }}
      />

      {/* Painel lateral */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: 400,
          zIndex: 51,
          background: 'var(--bg, #0f0f11)',
          borderLeft: '1px solid var(--border, #2a2a2e)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #2a2a2e)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text, #e8e8ed)' }}>
            Analista
          </span>
          <button
            data-testid="drawer-close"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text, #e8e8ed)',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </>
  );
}
