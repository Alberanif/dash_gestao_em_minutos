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

const TICK = { fontSize: 10, fill: "var(--text-3)" };

// Gráfico de renovações acumuladas por dia (PRD issue #114, seção 3.3,
// critério 9) — data já vem acumulada de buildCumulativeSeries; este
// componente só formata eixos (pt-BR, dd/mm) e desenha. A altura vive em
// .ult-chart-body (ultimates.css) para o mobile reduzir via media query.
export function CumulativeRenewalsChart({ data }: CumulativeRenewalsChartProps) {
  if (data.length === 0) {
    return (
      <div
        data-testid="ultimates-cumulative-chart-empty"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-vis)",
          borderRadius: 11,
          padding: 32,
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        Sem renovações registradas no ciclo ainda.
      </div>
    );
  }

  const chartData = data.map((d) => ({ date: fmtDateShort(d.day), cumulative: d.cumulative }));

  return (
    <div
      data-testid="ultimates-cumulative-chart"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 11,
        padding: "18px 20px",
      }}
    >
      <p
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-label)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          margin: "0 0 14px",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--violet)", flexShrink: 0 }} />
        Renovações acumuladas
      </p>
      <div className="ult-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ultimatesCumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--violet)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--violet)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--text)",
              }}
              labelStyle={{ color: "var(--text-muted)" }}
              itemStyle={{ color: "var(--text)" }}
              formatter={(value) => [value, "Renovações acumuladas"]}
            />
            <Area
              dataKey="cumulative"
              name="Renovações acumuladas"
              stroke="var(--violet)"
              strokeWidth={2}
              fill="url(#ultimatesCumulativeGradient)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
