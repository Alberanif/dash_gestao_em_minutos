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
  accentColor = "#2563EB",
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
      className="bg-white rounded-[10px] p-5 flex flex-col gap-3"
      style={{
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Top row: icon + sparkline */}
      <div className="flex items-start justify-between">
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}18` }}
          >
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
        )}
        {sparklineData && sparklineData.length >= 2 && (
          <div className="w-24 flex-shrink-0">
            <Sparkline data={sparklineData} color={accentColor} height={48} />
          </div>
        )}
      </div>

      {/* Value */}
      <div>
        <p
          className="text-4xl font-bold tracking-tight leading-none"
          style={{ color: "var(--color-text)" }}
        >
          {displayValue}
        </p>
      </div>

      {/* Title + delta */}
      <div>
        <p className="text-sm font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
          {title}
        </p>
        {delta !== null && (
          <div className="flex items-center gap-1">
            <span style={{ color: isPositive ? "var(--color-success)" : "var(--color-danger)" }}>
              {isPositive ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </span>
            <p
              className="text-xs font-medium"
              style={{ color: isPositive ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {isPositive ? "+" : ""}{delta.toFixed(1)}% vs anterior
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
