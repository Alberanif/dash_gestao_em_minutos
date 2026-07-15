"use client";

import type { ReactNode } from "react";
import type { FilterRecord } from "@/types/indicadores";
import { eventoMetaLine, eventoCompositionSubtitle } from "@/lib/indicadores/eventos";
import type { EventoMetrics } from "@/lib/indicadores/service/eventos-metrics";
import type { StatusAccent } from "./evento-folder";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

interface EventoCardMetricsProps {
  /** undefined = carregando (skeleton); null = falha/indisponível para o filtro. */
  metrics: EventoMetrics | null | undefined;
  loading: boolean;
}

export function EventoCardMetrics({ metrics, loading }: EventoCardMetricsProps) {
  const cells: Array<{ label: string; value: string | null }> = [
    { label: "Leads", value: metrics?.leads != null ? fmtNum(metrics.leads) : null },
    { label: "CPL", value: metrics?.cpl != null ? fmtBRL(metrics.cpl) : null },
    { label: "Invest.", value: metrics?.spend != null ? fmtBRL(metrics.spend) : null },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
      {cells.map((cell) => (
        <div
          key={cell.label}
          style={{ background: "var(--surface-2)", borderRadius: 8, padding: "9px 8px", textAlign: "center" }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 5,
            }}
          >
            {cell.label}
          </div>
          {loading ? (
            <div
              style={{
                height: 15,
                borderRadius: 4,
                margin: "0 auto",
                width: "70%",
                background: "var(--border-vis)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ) : (
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1 }}>
              {cell.value ?? "—"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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
