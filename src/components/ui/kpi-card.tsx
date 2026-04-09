import { Sparkline } from "@/components/ui/sparkline";

interface KpiCardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  format?: "number" | "compact";
  icon?: React.ReactNode;
  accentColor?: string;
  sparklineData?: number[];
}

function formatNumber(n: number, format: "number" | "compact" = "number"): string {
  if (format === "compact") {
    return Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
  }
  return Intl.NumberFormat("pt-BR").format(n);
}

export function KpiCard({
  title,
  value,
  previousValue,
  currentValue,
  format = "number",
  icon,
  accentColor = "var(--color-primary)",
  sparklineData,
}: KpiCardProps) {
  let delta: number | null = null;
  if (previousValue !== undefined && currentValue !== undefined && previousValue > 0) {
    delta = ((currentValue - previousValue) / previousValue) * 100;
  }

  const isPositive = delta !== null && delta >= 0;
  const displayValue = typeof value === "number" ? formatNumber(value, format) : value;

  return (
    <div
      className="flex flex-col gap-3 rounded-[var(--radius-card)] p-5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-primary-light)", color: accentColor }}
          >
            <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
          </div>
          <p
            className="truncate"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}
          >
            {title}
          </p>
        </div>
        {delta !== null ? (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1"
            style={{
              background: isPositive ? "#DCFCE7" : "#FEE2E2",
              color: isPositive ? "#16A34A" : "#DC2626",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {isPositive ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        ) : null}
      </div>

      <p style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 700, color: "var(--color-text)" }}>
        {displayValue}
      </p>

      {sparklineData && sparklineData.length >= 2 ? (
        <div className="w-full" style={{ marginTop: 12 }}>
          <div className="h-12">
            <Sparkline data={sparklineData} color={accentColor} height={48} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
