"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface LineChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Array<Record<string, any>>;
  xKey: string;
  lines: Array<{
    key: string;
    color: string;
    label: string;
  }>;
  height?: number;
  title?: string;
  subtitle?: string;
  hideRangeSelector?: boolean;
}

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function formatChartValue(value: number): string {
  if (value >= 1000) {
    return formatCompact(value);
  }
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm"
      style={{
        background: "white",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <p className="font-medium mb-1" style={{ color: "var(--color-text)" }}>
        {new Date(String(label)).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
      </p>
      {payload.map((entry: { color: string; name: string; value: number }) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          <span className="font-semibold">{entry.name}:</span> {formatChartValue(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function LineChart({ data, xKey, lines, height = 300, title, subtitle, hideRangeSelector }: LineChartProps) {
  const [range, setRange] = useState<number>(30);

  const filteredData = useMemo(() => {
    if (!data.length || hideRangeSelector) return data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    return data.filter((row) => new Date(row[xKey] as string) >= cutoff);
  }, [data, xKey, range, hideRangeSelector]);

  const displayData = hideRangeSelector ? data : (filteredData.length >= 2 ? filteredData : data);

  return (
    <div
      className="rounded-[var(--radius-card)] p-5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          {title && (
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {/* Range selector */}
        {!hideRangeSelector && (
          <div className="flex gap-1 flex-shrink-0">
            {RANGE_OPTIONS.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => setRange(days)}
                className="cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={
                  range === days
                    ? {
                        background: "var(--color-primary)",
                        border: "1px solid var(--color-primary)",
                        color: "white",
                      }
                    : {
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-muted)",
                      }
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 flex-shrink-0 rounded-full"
              style={{ background: line.color }}
            />
            <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              {line.label}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={displayData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            {lines.map((line) => (
              <linearGradient key={line.key} id={`grad-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={line.color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={line.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) =>
              new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
            }
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatChartValue}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          {lines.map((line) => (
            <Area
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              fill={`url(#grad-${line.key})`}
              name={line.label}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
