"use client";

interface KpiCellProps {
  label: string;
  value: string;
  accent?: string;
  /** "lg" renders a larger value — use for primary metrics */
  size?: "md" | "lg";
  /** span 2 columns in a grid */
  span2?: boolean;
}

export function KpiCell({ label, value, accent, size = "md", span2 }: KpiCellProps) {
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
        gridColumn: span2 ? "span 2" : undefined,
      }}
    >
      <span
        style={{
          fontSize: 10,
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
          fontFamily: "var(--font-mono)",
          fontSize: size === "lg" ? 22 : 14,
          fontWeight: 500,
          color: accent ?? "var(--text)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  );
}
