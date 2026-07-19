"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { CumulativeRenewalPoint } from "@/lib/ultimates/cumulative-chart";
import { fmtDateShort } from "@/lib/ultimates/format";

interface CumulativeRenewalsChartProps {
  data: CumulativeRenewalPoint[];
}

const TICK = { fontSize: 10, fill: "var(--color-text-muted)" };

// Gráfico de renovações acumuladas por dia (PRD issue #114, seção 3.3,
// critério 9) — data já vem acumulada de buildCumulativeSeries; este
// componente só formata eixos (pt-BR, dd/mm) e desenha.
export function CumulativeRenewalsChart({ data }: CumulativeRenewalsChartProps) {
  if (data.length === 0) {
    return (
      <div
        data-testid="ultimates-cumulative-chart-empty"
        className="surface-card"
        style={{
          padding: 32,
          textAlign: "center",
          fontSize: 13,
          color: "var(--color-text-muted)",
        }}
      >
        Sem renovações registradas no ciclo ainda.
      </div>
    );
  }

  const chartData = data.map((d) => ({ date: fmtDateShort(d.day), cumulative: d.cumulative }));

  return (
    <div data-testid="ultimates-cumulative-chart" className="surface-card" style={{ padding: 20 }}>
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          margin: "0 0 14px",
        }}
      >
        Renovações acumuladas
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ultimatesCumulativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-text-muted)" }}
            formatter={(value) => [value, "Renovações acumuladas"]}
          />
          <Area
            dataKey="cumulative"
            name="Renovações acumuladas"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#ultimatesCumulativeGradient)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
