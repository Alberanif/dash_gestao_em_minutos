"use client";

interface KpiCellProps {
  label: string;
  value: string;
  large?: boolean;
  muted?: boolean;
}

export function KpiCell({ label, value, large, muted }: KpiCellProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: large ? 8 : 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: large ? 24 : 15,
          fontWeight: large ? 600 : 500,
          color: muted || !large ? "var(--text-2)" : "var(--text-strong)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
