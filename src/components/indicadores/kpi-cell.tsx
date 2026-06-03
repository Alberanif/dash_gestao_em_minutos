"use client";

interface KpiCellProps {
  label: string;
  value: string;
  accent?: string;
  large?: boolean;
}

export function KpiCell({ label, value, accent, large }: KpiCellProps) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
        minWidth: 0,
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
        {label}
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: large ? 22 : 14,
          fontWeight: 500,
          color: accent ?? "var(--text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
