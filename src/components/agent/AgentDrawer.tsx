import React from 'react';

interface AgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nome do filtro ativo no dashboard; `null`/ausente quando nenhum está selecionado. */
  filterName?: string | null;
  /** Início do período selecionado, no formato `YYYY-MM-DD`. */
  startDate?: string | null;
  /** Fim do período selecionado, no formato `YYYY-MM-DD`. */
  endDate?: string | null;
  /** Código da oferta ativa; `null`/ausente quando nenhuma está selecionada. */
  offerCode?: string | null;
  children: React.ReactNode;
}

/**
 * Formata `YYYY-MM-DD` como `DD/MM`.
 *
 * Deliberadamente sem `new Date`: `new Date("2026-06-01")` é lido como UTC e,
 * em BRT (UTC-3), volta 31/05. A string já é a data que o usuário escolheu na
 * tela — basta reordenar os campos.
 */
function formatDayMonth(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [, , month, day] = match;
  return `${day}/${month}`;
}

function formatPeriod(startDate?: string | null, endDate?: string | null): string | null {
  const start = startDate ? formatDayMonth(startDate) : null;
  const end = endDate ? formatDayMonth(endDate) : null;
  if (!start || !end) return null;
  return `${start}–${end}`;
}

export function AgentDrawer({
  isOpen,
  onClose,
  filterName,
  startDate,
  endDate,
  offerCode,
  children,
}: AgentDrawerProps) {
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

        {/* Barra de contexto — o que o agente está enxergando */}
        <div
          data-testid="drawer-context-bar"
          style={{
            padding: '8px 20px',
            borderBottom: '1px solid var(--border, #2a2a2e)',
            background: 'var(--surface-2, #1c1c21)',
            fontSize: 11,
            lineHeight: 1.5,
            color: 'var(--text-muted, #a1a1aa)',
          }}
        >
          {[
            `Filtro: ${filterName ?? 'nenhum'}`,
            formatPeriod(startDate, endDate),
            offerCode ? `Oferta: ${offerCode}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </>
  );
}
