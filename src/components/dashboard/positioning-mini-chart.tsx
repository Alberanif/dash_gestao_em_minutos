"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface MiniChartPoint {
  date: string;
  value: number;
}

interface PositioningMiniChartProps {
  data: MiniChartPoint[];
  color: string;
  seriesLabel: string;
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatFull(n: number): string {
  return Intl.NumberFormat("pt-BR").format(n);
}

function formatDate(iso: string): string {
  // iso pode ser "YYYY-MM-DD" ou ISO completo
  const d = new Date(iso.length > 10 ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value as number;
  const seriesName = payload[0]?.name as string;
  const dateStr = label as string;
  const d = new Date(dateStr.length > 10 ? dateStr : dateStr + "T00:00:00");
  const formatted = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        background: "white",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
        pointerEvents: "none",
      }}
    >
      <p style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>{formatted}</p>
      <p style={{ color: payload[0]?.color }}>
        <span style={{ fontWeight: 500 }}>{seriesName}:</span>{" "}
        <span style={{ fontWeight: 700 }}>{formatFull(value)}</span>
      </p>
    </div>
  );
}

export function PositioningMiniChart({ data, color, seriesLabel }: PositioningMiniChartProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 160, fontSize: 12, color: "var(--color-text-muted)" }}
      >
        Dados insuficientes para o gráfico
      </div>
    );
  }

  // Calcula domínio do eixo Y com padding proporcional para evitar linha plana
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;
  // Padding mínimo de 5% do valor absoluto ou 10% do range (o que for maior)
  const padding = Math.max(range * 0.15, Math.abs(maxVal) * 0.03, 1);
  const yMin = Math.floor(minVal - padding);
  const yMax = Math.ceil(maxVal + padding);

  // Intervalo do eixo X para no máximo 6 ticks (evita sobreposição)
  const xInterval = useMemo(() => {
    if (data.length <= 6) return 0;
    return Math.ceil(data.length / 6) - 1;
  }, [data.length]);

  // Largura do eixo Y baseada no maior valor (para não cortar labels)
  const yAxisWidth = useMemo(() => {
    const maxLabel = formatCompact(maxVal);
    return Math.max(36, maxLabel.length * 7 + 8);
  }, [maxVal]);

  const gradientId = `pos-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div>
      {/* Legenda */}
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span
          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ background: color }}
        />
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)" }}>
          {seriesLabel}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#F1F5F9" vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            interval={xInterval}
            tickFormatter={formatDate}
            dy={4}
          />

          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCompact}
            width={yAxisWidth}
            tickCount={5}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="value"
            name={seriesLabel}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: color }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
