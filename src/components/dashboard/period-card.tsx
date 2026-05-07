"use client";

import { PositioningMiniChart, type MiniChartPoint } from "@/components/dashboard/positioning-mini-chart";

interface PeriodCardProps {
  periodLabel: string;
  value: number;
  metricLabel: string;
  sparklineData: MiniChartPoint[];
  variant: "positive" | "negative" | "neutral";
  periodType: "current" | "previous";
}

const VARIANT = {
  positive: { borderColor: "#22c55e", bg: "rgba(34,197,94,0.08)", chartColor: "#22c55e" },
  negative: { borderColor: "#ef4444", bg: "rgba(239,68,68,0.08)", chartColor: "#ef4444" },
  neutral:  { borderColor: "var(--color-border)", bg: "var(--color-surface)", chartColor: "#3B82F6" },
};

function formatValue(v: number): string {
  return Intl.NumberFormat("pt-BR").format(v);
}

export function PeriodCard({ periodLabel, value, metricLabel, sparklineData, variant, periodType }: PeriodCardProps) {
  const v = VARIANT[variant];

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-[var(--radius-sm)]"
      style={{
        borderTop: "1px solid var(--color-border)",
        borderRight: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        borderLeft: `3px solid ${v.borderColor}`,
        background: v.bg,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)" }}>
          {periodLabel}
        </p>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.04em",
            padding: "2px 6px",
            borderRadius: 4,
            background: periodType === "current" ? "rgba(59,130,246,0.12)" : "var(--color-accent)",
            color: periodType === "current" ? "#3B82F6" : "var(--color-text-muted)",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {periodType === "current" ? "Atual" : "Anterior"}
        </span>
      </div>

      <div>
        <p
          className="tabular-nums"
          style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: "var(--color-text)" }}
        >
          {formatValue(value)}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
          {metricLabel}
        </p>
      </div>

      <div
        className="rounded-[var(--radius-sm)] p-2"
        style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
      >
        <PositioningMiniChart data={sparklineData} color={v.chartColor} seriesLabel={metricLabel} />
      </div>
    </div>
  );
}
