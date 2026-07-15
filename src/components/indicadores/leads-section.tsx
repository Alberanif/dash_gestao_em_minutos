"use client";

import { useState } from "react";
import { LeadsCaptacoesChart } from "./trend-charts";
import type { GlobalLeadsMetrics, DailyPoint } from "@/types/indicadores";

const TOP_N = 5;

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

interface LeadsSectionProps {
  leadsState: SectionState<GlobalLeadsMetrics>;
  dailyState: SectionState<DailyPoint[]>;
}

function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
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
        stroke="var(--green)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>
        Coleta de Leads
      </span>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Orgânico + Pago</span>
    </div>
  );
}

export function LeadsSection({ leadsState, dailyState }: LeadsSectionProps) {
  const outerCard: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border-vis)",
    borderRadius: 11,
    overflow: "hidden",
    width: "100%",
  };

  if (leadsState.error) {
    return (
      <div style={outerCard}>
        <Header />
        <p style={{ color: "var(--red)", fontSize: 13, padding: 20 }}>
          Erro ao carregar dados de captações de leads.
        </p>
      </div>
    );
  }

  if (leadsState.loading) {
    return (
      <div style={outerCard}>
        <Header />
        <div className="leads-grid" style={{ padding: 20 }}>
          {[180, undefined, undefined].map((height, i) => (
            <div
              key={i}
              style={{
                height: height ?? 180,
                borderRadius: 9,
                background: "var(--surface-2)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const d = leadsState.data;
  if (!d) return null;

  return (
    <div style={outerCard}>
      <Header />
      <div className="leads-grid" style={{ padding: 20 }}>
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-vis)",
            borderRadius: 9,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
            Total de Captações
          </div>
          <span style={{ fontSize: 36, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1 }}>
            {fmtNum(d.total)}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>no período</span>
        </div>

        <div>
          <LeadsCaptacoesChart
            data={dailyState.data ?? []}
            loading={dailyState.loading}
          />
        </div>

        {d.by_event.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--text-3)",
                    borderBottom: "1px solid var(--border-vis)",
                    paddingBottom: 9,
                  }}
                >
                  Evento
                </th>
                <th
                  style={{
                    textAlign: "right",
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--text-3)",
                    borderBottom: "1px solid var(--border-vis)",
                    paddingBottom: 9,
                  }}
                >
                  Captações
                </th>
              </tr>
            </thead>
            <tbody>
              {d.by_event.map((row) => (
                <tr
                  key={row.evento}
                  style={{ borderBottom: "1px solid var(--border-vis)" }}
                >
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--cyan)",
                      fontSize: 12,
                      padding: "10px 8px",
                    }}
                  >
                    {row.evento}
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      textAlign: "right",
                      color: "var(--text-strong)",
                      padding: "10px 8px",
                    }}
                  >
                    {fmtNum(row.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {d.by_source.length > 0 && (
        <SourcesChart sources={d.by_source} />
      )}
    </div>
  );
}

function SourcesChart({ sources }: { sources: Array<{ source: string; count: number }> }) {
  const [expanded, setExpanded] = useState(false);

  const max = sources[0]?.count ?? 1;
  const hasOverflow = sources.length > TOP_N;

  let display: Array<{ source: string; count: number; isOther?: boolean }>;
  if (expanded || !hasOverflow) {
    display = sources;
  } else {
    const top = sources.slice(0, TOP_N);
    const rest = sources.slice(TOP_N);
    const restCount = rest.reduce((sum, r) => sum + r.count, 0);
    display = [...top, { source: `Outras fontes (${rest.length})`, count: restCount, isOther: true }];
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-vis)",
        padding: "18px 22px 22px",
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--text-3)",
          display: "block",
          marginBottom: 14,
        }}
      >
        Fontes (utm_source)
      </span>
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
                  background: row.isOther ? "#565d69" : "var(--green)",
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
          {expanded ? "Mostrar menos" : `Ver todas as ${sources.length} fontes`}
        </button>
      )}
    </div>
  );
}
