"use client";

import type { ReactNode } from "react";
import type { FilterStatus } from "@/types/indicadores";

export interface StatusAccent {
  accent: string;
  bg: string;
  border: string;
}

export interface FolderConfig extends StatusAccent {
  status: FilterStatus;
  name: string;
  desc: string;
  summaryLabel: string;
}

// Acentos das pastas: verde ativos, azul finalizados, vermelho cancelados
// (tokens de indicadores.css; alphas do design via color-mix).
export const FOLDER_CONFIGS: FolderConfig[] = [
  {
    status: "ativo",
    name: "Eventos Ativos",
    desc: "Em captação ou veiculação agora",
    summaryLabel: "Eventos ativos",
    accent: "var(--green)",
    bg: "color-mix(in srgb, var(--green) 10%, transparent)",
    border: "color-mix(in srgb, var(--green) 25%, transparent)",
  },
  {
    status: "finalizado",
    name: "Eventos Finalizados",
    desc: "Encerrados — dados consolidados",
    summaryLabel: "Finalizados",
    accent: "var(--link)",
    bg: "color-mix(in srgb, var(--link) 10%, transparent)",
    border: "color-mix(in srgb, var(--link) 24%, transparent)",
  },
  {
    status: "cancelado",
    name: "Eventos Cancelados",
    desc: "Interrompidos antes da conclusão",
    summaryLabel: "Cancelados",
    accent: "var(--red)",
    bg: "color-mix(in srgb, var(--red) 10%, transparent)",
    border: "color-mix(in srgb, var(--red) 24%, transparent)",
  },
];

interface EventoFolderProps {
  config: FolderConfig;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function EventoFolder({ config, count, collapsed, onToggle, children }: EventoFolderProps) {
  return (
    <section>
      <div
        data-testid={`folder-header-${config.status}`}
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "11px 4px",
          cursor: "pointer",
          userSelect: "none",
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-4)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, transition: "transform .18s ease", transform: collapsed ? "rotate(0deg)" : "rotate(90deg)" }}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: config.bg,
            border: `1px solid ${config.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={config.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", margin: 0, letterSpacing: "-0.01em" }}>
          {config.name}
        </h2>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            color: config.accent,
            background: config.bg,
            border: `1px solid ${config.border}`,
            borderRadius: 20,
            padding: "2px 9px",
          }}
        >
          {String(count).padStart(2, "0")}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{config.desc}</span>
      </div>

      {!collapsed && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(324px, 1fr))", gap: 14 }}>
          {children}
        </div>
      )}
    </section>
  );
}
