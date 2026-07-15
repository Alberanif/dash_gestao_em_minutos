"use client";

import type { ReactNode } from "react";
import type { FilterRecord } from "@/types/indicadores";
import { eventoMetaLine, eventoCompositionSubtitle } from "@/lib/indicadores/eventos";
import type { StatusAccent } from "./evento-folder";

interface EventoCardProps {
  filter: FilterRecord;
  accent: StatusAccent;
  onOpenDashboard: (filter: FilterRecord) => void;
  /** Slot para o menu "⋯" de ações (slice de ações). */
  menu?: ReactNode;
  /** Slot para as métricas vitalícias (slice de métricas). */
  metrics?: ReactNode;
}

export function EventoCard({ filter, accent, onOpenDashboard, menu, metrics }: EventoCardProps) {
  const cancelado = filter.status === "cancelado";

  return (
    <div
      data-testid={`evento-card-${filter.id}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderLeft: `3px solid ${accent.accent}`,
        borderRadius: 11,
        padding: "16px 18px 15px",
        display: "flex",
        flexDirection: "column",
        opacity: cancelado ? 0.62 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-strong)",
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {filter.name}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 3 }}>
            {eventoCompositionSubtitle(filter)}
          </div>
        </div>
        {menu}
      </div>

      {metrics}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 15,
          paddingTop: 13,
          borderTop: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--text-3)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="4.5" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          {eventoMetaLine(filter)}
        </span>
        <button
          onClick={() => onOpenDashboard(filter)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "7px 12px",
            borderRadius: 8,
            flexShrink: 0,
            cursor: "pointer",
            background: cancelado ? "transparent" : accent.bg,
            border: `1px solid ${cancelado ? "var(--border-strong)" : accent.border}`,
            color: cancelado ? "var(--text-2)" : accent.accent,
          }}
        >
          {cancelado ? "Ver dashboard" : "Abrir dashboard"}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
