"use client";

import type { ConversionSourceRow } from "@/types/indicadores";

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

interface ConversionSourcesCardProps {
  state: SectionState<ConversionSourceRow[]>;
}

function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

function Header() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "16px 20px",
        borderBottom: "1px solid var(--border-vis)",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--orange)", flexShrink: 0 }}
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 600 }}>
        Origens de Conversão
      </span>
      <span
        style={{
          background: "rgba(249,115,22,0.1)",
          border: "1px solid rgba(249,115,22,0.2)",
          color: "var(--orange)",
          fontSize: 10,
          borderRadius: 4,
          padding: "2px 7px",
        }}
      >
        por utm_source
      </span>
    </div>
  );
}

export function ConversionSourcesCard({ state }: ConversionSourcesCardProps) {
  const outerCard: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border-vis)",
    borderRadius: 10,
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

  return (
    <div style={outerCard}>
      <Header />
      <div style={{ padding: "16px 20px 20px" }}>
        {sources.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            Nenhuma venda encontrada no período.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 28,
                  fontWeight: 500,
                  color: "var(--orange)",
                  lineHeight: 1,
                }}
              >
                {fmtNum(total)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>vendas atribuídas</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sources.map((row) => (
                <div key={row.source} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: "var(--text-2)",
                      width: 200,
                      flexShrink: 0,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.source}
                  </span>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 20,
                        background: "var(--surface-2)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(row.count / max) * 100}%`,
                          height: "100%",
                          background: "var(--orange)",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text)",
                        width: 48,
                        flexShrink: 0,
                        textAlign: "right",
                      }}
                    >
                      {fmtNum(row.count)}
                    </span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 10,
                        color: "var(--text-3)",
                        width: 44,
                        flexShrink: 0,
                        textAlign: "right",
                      }}
                    >
                      {fmtPct(row.count, total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
