"use client";

import type { FunnelStage, ConversionRate } from "@/lib/utils/funnel-metrics";

interface FunnelChartProps {
  stages: FunnelStage[];
  rates: ConversionRate[];
}

function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

// Meta Ads stages use blue; Hotmart stage uses orange
const META_COLOR = "#1877f2";
const HOTMART_COLOR = "#f97316";

function getStageColor(index: number): string {
  // stages 0-3 are Meta Ads, stage 4 is Hotmart
  return index < 4 ? META_COLOR : HOTMART_COLOR;
}

export function FunnelChart({ stages, rates }: FunnelChartProps) {
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        overflowX: "hidden",
      }}
    >
      {stages.map((stage, i) => {
        const barWidthPct = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
        const color = getStageColor(i);
        const rate = rates[i - 1]; // rate ABOVE this stage (between prev and this)

        return (
          <div key={stage.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Conversion rate badge between stages */}
            {i > 0 && rate && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8 }}>
                <div
                  style={{
                    width: 1,
                    height: 12,
                    background: "var(--color-border)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 20,
                    padding: "1px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {rate.label}: {fmtPct(rate.pct)}
                </span>
              </div>
            )}

            {/* Bar row */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {/* The proportional bar */}
              <div
                style={{
                  width: `${barWidthPct}%`,
                  minWidth: stage.value === 0 ? 4 : undefined,
                  height: 24,
                  background: color,
                  borderRadius: 4,
                  transition: "width 0.3s ease",
                  opacity: 0.85,
                }}
              />
              {/* Label and value below the bar */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stage.label}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: color,
                    fontFamily: "monospace",
                  }}
                >
                  {fmtNum(stage.value)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
