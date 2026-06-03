"use client";

import { FunnelStage, ConversionRate } from "@/lib/utils/funnel-metrics";

interface HorizontalFunnelFlowProps {
  stages: FunnelStage[];
  rates: ConversionRate[];
  metaSpend?: number | null;
  metaCpl?: number | null;
  metaCpm?: number | null;
  metaConvRate?: number | null;
  cpa?: number | null;
}

function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function getRateClass(label: string, pct: number): string {
  switch (label) {
    case "CTR":
      return pct > 1.5 ? "rate-ok" : pct >= 0.5 ? "rate-warn" : "rate-low";
    case "Taxa LP":
    case "Conversão LP→Lead":
      return pct > 70 ? "rate-ok" : pct >= 30 ? "rate-warn" : "rate-low";
    case "Taxa de Fechamento":
      return pct > 30 ? "rate-ok" : pct >= 10 ? "rate-warn" : "rate-low";
    default:
      return "rate-warn";
  }
}

const STAGE_COLORS = [
  "var(--text-2)",
  "var(--blue)",
  "var(--cyan)",
  "var(--green)",
  "var(--orange)",
];

function IconImpressions() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconCliques() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 2L4 11L6.5 8.5L8.5 13L10 12.3L8 7.5L11.5 7.5L4 2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconVisualizacoes() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 13.5H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 11.5V13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconLeads() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 13.5C2.5 10.7 5 8.5 8 8.5C11 8.5 13.5 10.7 13.5 13.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconVendas() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M5.5 6.5V4.5C5.5 3.12 6.62 2 8 2C9.38 2 10.5 3.12 10.5 4.5V6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="2.5" y="6.5" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 9.5L7.3 11.3L10.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STAGE_ICONS = [IconImpressions, IconCliques, IconVisualizacoes, IconLeads, IconVendas];

function hexToRgba(cssVar: string, opacity: number): string {
  const map: Record<string, string> = {
    "var(--text-2)": `148,163,184`,
    "var(--blue)": `59,130,246`,
    "var(--cyan)": `8,145,178`,
    "var(--green)": `34,197,94`,
    "var(--orange)": `249,115,22`,
  };
  const rgb = map[cssVar] ?? "148,163,184";
  return `rgba(${rgb},${opacity})`;
}

export function HorizontalFunnelFlow({
  stages,
  rates,
  metaSpend,
  metaCpl,
  metaCpm,
  metaConvRate,
  cpa,
}: HorizontalFunnelFlowProps) {
  if (!stages || stages.length === 0) return null;

  const showConnectors = stages.length >= 2;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 10,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {stages.map((stage, idx) => {
          const color = STAGE_COLORS[idx] ?? "var(--text-2)";
          const Icon = STAGE_ICONS[idx] ?? IconImpressions;
          const rate = showConnectors && idx < rates.length ? rates[idx] : null;

          return (
            <div key={stage.label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                  minWidth: 0,
                  position: "relative",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-vis)",
                  borderRadius: 8,
                  padding: "12px 8px 0 8px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: hexToRgba(color, 0.1),
                    border: `1px solid ${hexToRgba(color, 0.2)}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color,
                    flexShrink: 0,
                  }}
                >
                  <Icon />
                </div>

                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 16,
                    fontWeight: 600,
                    color,
                    lineHeight: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                >
                  {fmtNum(stage.value)}
                </span>

                <span
                  style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    color: "var(--text-3)",
                    letterSpacing: "0.06em",
                    textAlign: "center",
                    lineHeight: 1.3,
                    paddingBottom: 10,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                >
                  {stage.label}
                </span>

                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: color,
                  }}
                />
              </div>

              {showConnectors && idx < stages.length - 1 && rate && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "0 4px",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1 }}>›</span>
                  {rate.pct === null ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--text-3)",
                        background: "rgba(71,85,105,0.15)",
                        border: "1px solid rgba(71,85,105,0.3)",
                        borderRadius: 4,
                        padding: "1px 4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      —
                    </span>
                  ) : (
                    <span
                      className={getRateClass(rate.label, rate.pct)}
                      style={{
                        fontSize: 9,
                        fontFamily: "'DM Mono', monospace",
                        borderRadius: 4,
                        padding: "1px 4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtPct(rate.pct)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border-vis)",
          marginTop: 16,
          paddingTop: 12,
          display: "flex",
          gap: 0,
        }}
      >
        {[
          { label: "CPA", value: fmtBRL(cpa) },
          { label: "CPL Tráfego", value: fmtBRL(metaCpl) },
          { label: "Conv. Ads→Vendas", value: fmtPct(metaConvRate) },
          { label: "CPM", value: fmtBRL(metaCpm) },
        ].map((metric, idx) => (
          <div
            key={metric.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              alignItems: "center",
              borderLeft: idx > 0 ? "1px solid var(--border-vis)" : "none",
              padding: "0 12px",
            }}
          >
            <span
              style={{
                fontSize: 9,
                textTransform: "uppercase",
                color: "var(--text-3)",
                letterSpacing: "0.06em",
              }}
            >
              {metric.label}
            </span>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                color: "var(--text-2)",
              }}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
