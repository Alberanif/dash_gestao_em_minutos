interface KpiCardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  format?: "number" | "compact";
}

function formatNumber(n: number, format: "number" | "compact" = "number"): string {
  if (format === "compact") {
    return Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
  }
  return Intl.NumberFormat("pt-BR").format(n);
}

export function KpiCard({ title, value, previousValue, currentValue, format = "number" }: KpiCardProps) {
  let delta: number | null = null;
  if (previousValue !== undefined && currentValue !== undefined && previousValue > 0) {
    delta = ((currentValue - previousValue) / previousValue) * 100;
  }

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">
        {typeof value === "number" ? formatNumber(value, format) : value}
      </p>
      {delta !== null && (
        <p className={`text-xs mt-1 ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs anterior
        </p>
      )}
    </div>
  );
}
