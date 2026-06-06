"use client";

import { LeadsCaptacoesChart } from "./trend-charts";
import type { GlobalLeadsMetrics, DailyPoint } from "@/types/indicadores";

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
        style={{ color: "var(--green)", flexShrink: 0 }}
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span
        style={{
          color: "var(--text)",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Coleta de Leads
      </span>
      <span
        style={{
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.2)",
          color: "var(--green)",
          fontSize: 10,
          borderRadius: 4,
          padding: "2px 7px",
        }}
      >
        Orgânico + Pago
      </span>
    </div>
  );
}

export function LeadsSection({ leadsState, dailyState }: LeadsSectionProps) {
  const outerCard: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border-vis)",
    borderRadius: 10,
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
        <div
          style={{
            padding: 20,
            display: "grid",
            gridTemplateColumns: "200px 1fr 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {[180, undefined, undefined].map((height, i) => (
            <div
              key={i}
              style={{
                height: height ?? 180,
                borderRadius: 8,
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
      <div
        style={{
          padding: 20,
          display: "grid",
          gridTemplateColumns: "200px 1fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-3)",
            }}
          >
            Total de Captações
          </span>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 36,
              fontWeight: 500,
              color: "var(--green)",
              lineHeight: 1,
            }}
          >
            {fmtNum(d.total)}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            no período
          </span>
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
                    letterSpacing: "0.08em",
                    color: "var(--text-3)",
                    borderBottom: "1px solid var(--border-vis)",
                    paddingBottom: 8,
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
                    letterSpacing: "0.08em",
                    color: "var(--text-3)",
                    borderBottom: "1px solid var(--border-vis)",
                    paddingBottom: 8,
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
                      fontFamily: "'DM Mono', monospace",
                      color: "var(--cyan)",
                      fontSize: 12,
                      padding: 8,
                    }}
                  >
                    {row.evento}
                  </td>
                  <td
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontWeight: 700,
                      textAlign: "right",
                      color: "var(--text)",
                      padding: 8,
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
  const max = sources[0]?.count ?? 1;

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-vis)",
        padding: "16px 20px 20px",
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-3)",
          display: "block",
          marginBottom: 14,
        }}
      >
        Fontes (utm_source)
      </span>
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
                    background: "var(--cyan)",
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
