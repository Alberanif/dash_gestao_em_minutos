"use client";

import { useEffect } from "react";
import type { ConviteProject, ConviteUltimateMetrics } from "@/types/convite";

interface ConviteUltimateDetailModalProps {
  open: boolean;
  project: ConviteProject | null;
  onClose: () => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function fmtMonthYear(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function fmtFloat(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function isUltimateMetrics(
  metrics: ConviteProject["metrics"]
): metrics is ConviteUltimateMetrics {
  return !!metrics && "latest_numero_absoluto" in metrics;
}

export function ConviteUltimateDetailModal({
  open,
  project,
  onClose,
}: ConviteUltimateDetailModalProps) {
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

  const metrics = isUltimateMetrics(project.metrics) ? project.metrics : null;

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
          maxWidth: 600,
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
          Ultimate · {formatDate(project.data_inicio)} → {formatDate(project.data_fim)}
        </p>

        <div style={{ height: 1, background: "var(--color-border)", marginBottom: 20 }} />

        {/* Histórico Mensal */}
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          Histórico Mensal
        </h3>
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
            overflow: "auto",
            marginBottom: 24,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--color-bg)" }}>
                <th style={thStyle}>Mês/Ano</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Nº Absoluto</th>
              </tr>
            </thead>
            <tbody>
              {metrics && metrics.monthly_history.length > 0 ? (
                metrics.monthly_history.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={cellStyle}>{fmtMonthYear(row.month_year)}</td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.numero_absoluto.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      ...cellStyle,
                      textAlign: "center",
                      color: "var(--color-text-muted)",
                      padding: "24px 16px",
                    }}
                  >
                    Nenhum registro mensal encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Percentuais por Turma */}
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          Percentuais por Turma
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
                <th style={thStyle}>Projeto</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% Renovação</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% Conv. Pitch</th>
              </tr>
            </thead>
            <tbody>
              {metrics && metrics.percentuais_history.length > 0 ? (
                metrics.percentuais_history.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={cellStyle}>{row.projeto}</td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtFloat(row.perc_renovacao)}%
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtFloat(row.perc_conv_pitch)}%
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
                    Nenhum percentual cadastrado.
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
