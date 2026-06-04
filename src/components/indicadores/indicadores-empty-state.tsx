"use client";

interface IndicadoresEmptyStateProps {
  onOpenFilter: () => void;
}

export function IndicadoresEmptyState({ onOpenFilter }: IndicadoresEmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        gap: 20,
        textAlign: "center",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-3)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text)",
            margin: 0,
          }}
        >
          Nenhum filtro selecionado
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-3)",
            margin: 0,
            maxWidth: 380,
            lineHeight: 1.6,
          }}
        >
          Selecione ou crie um filtro para visualizar os indicadores do dashboard.
          Os filtros permitem segmentar os dados por produto e campanha.
        </p>
      </div>

      <button
        onClick={onOpenFilter}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 8,
          border: "1.5px solid var(--violet)",
          background: "rgba(144,112,232,0.12)",
          color: "var(--violet)",
          cursor: "pointer",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Criar ou selecionar filtro
      </button>
    </div>
  );
}
