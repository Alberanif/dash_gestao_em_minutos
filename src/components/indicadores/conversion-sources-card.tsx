"use client";

import { useState } from "react";
import type { ConversionSourceRow } from "@/types/indicadores";

const TOP_N = 5;

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

interface ConversionSourcesCardProps {
  state: SectionState<ConversionSourceRow[]>;
}

interface DisplayRow {
  source: string;
  count: number;
  isOther?: boolean;
}

function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function Header() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "15px 20px",
        borderBottom: "1px solid var(--border-vis)",
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--orange)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>
        Origens de Conversão
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
        por utm_source
      </span>
    </div>
  );
}

export function ConversionSourcesCard({ state }: ConversionSourcesCardProps) {
  const [expanded, setExpanded] = useState(false);

  const outerCard: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border-vis)",
    borderRadius: 11,
    overflow: "hidden",
    width: "100%",
  };

  if (state.error) {
    return (
      <div style={outerCard}>
        <Header />
        <p style={{ color: "var(--red)", fontSize: 13, padding: 20, margin: 0 }}>
          Erro ao carregar origens de conversão.
        </p>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div style={outerCard}>
        <Header />
        <div style={{ padding: 20 }}>
          <div
            style={{
              height: 160,
              borderRadius: 8,
              background: "var(--surface-2)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    );
  }

  const sources = state.data ?? [];
  const total = sources.reduce((sum, r) => sum + r.count, 0);
  const max = sources[0]?.count ?? 1;
  const hasOverflow = sources.length > TOP_N;

  let display: DisplayRow[];
  if (expanded || !hasOverflow) {
    display = sources;
  } else {
    const top = sources.slice(0, TOP_N);
    const rest = sources.slice(TOP_N);
    const restCount = rest.reduce((sum, r) => sum + r.count, 0);
    display = [...top, { source: `Outras origens (${rest.length})`, count: restCount, isOther: true }];
  }

  return (
    <div style={outerCard}>
      <Header />
      <div style={{ padding: "18px 22px 22px" }}>
        {sources.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            Nenhuma venda encontrada no período.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 18 }}>
              <span style={{ fontSize: 26, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1 }}>
                {fmtNum(total)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>vendas atribuídas</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {display.map((row) => (
                <div key={row.source} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: row.isOther ? "var(--text-muted)" : "#a2a9b4",
                      fontStyle: row.isOther ? "italic" : "normal",
                      width: 210,
                      flexShrink: 0,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.source}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 18,
                      background: "var(--surface-2)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(row.count / max) * 100}%`,
                        height: "100%",
                        background: row.isOther ? "#565d69" : "var(--orange)",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text-strong)",
                      width: 26,
                      flexShrink: 0,
                      textAlign: "right",
                    }}
                  >
                    {fmtNum(row.count)}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-3)",
                      width: 42,
                      flexShrink: 0,
                      textAlign: "right",
                    }}
                  >
                    {fmtPct(row.count, total)}
                  </span>
                </div>
              ))}
            </div>
            {hasOverflow && (
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                  marginTop: 14,
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--cyan)",
                  cursor: "pointer",
                }}
              >
                {expanded ? "Mostrar menos" : `Ver todas as ${sources.length} origens`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
