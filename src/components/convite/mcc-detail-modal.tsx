"use client";

import { useEffect } from "react";
import type { ConviteMccMetrics, ConviteProject } from "@/types/convite";

interface ConviteMccDetailModalProps {
  open: boolean;
  project: ConviteProject | null;
  onClose: () => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const cellStyle: React.CSSProperties = {
  padding: "11px 16px",
  fontSize: 13,
  color: "var(--color-text)",
};

function isMccMetrics(
  metrics: ConviteProject["metrics"]
): metrics is ConviteMccMetrics {
  return !!metrics && "latest_perc_ultimate" in metrics;
}

export function ConviteMccDetailModal({
  open,
  project,
  onClose,
}: ConviteMccDetailModalProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !project) return null;

  const metrics = isMccMetrics(project.metrics) ? project.metrics : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 560,
          padding: 24,
          position: "relative",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
          title="Fechar"
        >
          ✕
        </button>

        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            paddingRight: 32,
          }}
        >
          {project.nome_projeto}
        </h2>
        <p
          style={{
            margin: "6px 0 18px",
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          MCC · {formatDate(project.data_inicio)} → {formatDate(project.data_fim)}
        </p>

        <div style={{ height: 1, background: "var(--color-border)", marginBottom: 20 }} />

        <h3
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          Histórico de Métricas
        </h3>
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
            overflow: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--color-bg)" }}>
                <th style={thStyle}>Data</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% Ultimate</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% PC ao Vivo</th>
              </tr>
            </thead>
            <tbody>
              {metrics && metrics.history.length > 0 ? (
                metrics.history.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={cellStyle}>{formatDate(row.created_at)}</td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatPercent(row.perc_ultimate)}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatPercent(row.perc_pc_ao_vivo)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      ...cellStyle,
                      textAlign: "center",
                      color: "var(--color-text-muted)",
                      padding: "24px 16px",
                    }}
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
