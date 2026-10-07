"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VendasViewDailyRow, VendasViewHourlyRow } from "@/types/vendas";
import type { ChartGranularity } from "@/lib/vendas/cumulative-chart";
import { fmtDateShort, fmtHourLong, fmtHourShort } from "@/lib/vendas/format";
import { buildViewDailyCumulative, buildViewHourlyCumulative } from "@/lib/vendas/views";
import { buildChartRows } from "./cumulative-chart";

const TICK = { fontSize: 10, fill: "var(--text-3)" };
const TOOLTIP_STYLE = {
  background: "var(--surface-2)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text)",
};
const GRANULARITIES: { value: ChartGranularity; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "hora", label: "Hora" },
];

// Linha do gráfico de barras: rótulo curto do eixo, rótulo longo do balão.
export interface SalesBarRow {
  x: string;
  tooltip: string;
  sales: number;
}

// Pura e exportada: sob jsdom o Recharts não desenha eixo, então a tradução
// chave-crua → rótulo só é testável isolada. A chave nunca vira Date (já é hora
// de parede em America/Sao_Paulo).
export function buildSalesBarRows(
  daily: VendasViewDailyRow[],
  hourly: VendasViewHourlyRow[],
  granularity: ChartGranularity
): SalesBarRow[] {
  if (granularity === "hora") {
    return [...hourly]
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .map((r) => ({ x: fmtHourShort(r.hour), tooltip: fmtHourLong(r.hour), sales: r.sales }));
  }
  return [...daily]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => ({ x: fmtDateShort(r.day), tooltip: fmtDateShort(r.day), sales: r.sales }));
}

export function GranularitySwitch({
  testId,
  active,
  onChange,
}: {
  testId: string;
  active: ChartGranularity;
  onChange: (g: ChartGranularity) => void;
}) {
  return (
    <div data-testid={testId} role="group" aria-label="Granularidade" style={{ display: "flex", gap: 6 }}>
      {GRANULARITIES.map(({ value, label }) => {
        const on = value === active;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            data-testid={`${testId}-${value}`}
            onClick={() => onChange(value)}
            style={{
              padding: "5px 11px",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              borderRadius: 20,
              border: on ? "1px solid var(--border-strong)" : "1px solid var(--border-vis)",
              background: on ? "var(--surface-2)" : "var(--surface)",
              color: on ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ testId, title, color, controls, children }: { testId: string; title: string; color: string; controls?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      data-testid={testId}
      style={{ background: "var(--surface)", border: "1px solid var(--border-vis)", borderRadius: 11, padding: "18px 20px", minWidth: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "0 0 14px" }}>
        <p
          style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, color: "var(--text-label)", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
          {title}
        </p>
        {controls}
      </div>
      {children}
    </div>
  );
}

function Empty({ testId }: { testId: string }) {
  return (
    <div data-testid={testId} style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
      Sem vendas no período.
    </div>
  );
}

interface ChartProps {
  daily: VendasViewDailyRow[];
  // null = a série horária não chegou: o switch some em vez de levar a um gráfico vazio.
  hourly: VendasViewHourlyRow[] | null;
  granularity: ChartGranularity;
  onGranularityChange: (g: ChartGranularity) => void;
}

export function SalesBarChart({ daily, hourly, granularity, onGranularityChange }: ChartProps) {
  const porHora = granularity === "hora" && hourly !== null;
  const rows = useMemo(
    () => buildSalesBarRows(daily, hourly ?? [], porHora ? "hora" : "dia"),
    [daily, hourly, porHora]
  );
  const empty = rows.length === 0 || rows.every((r) => r.sales === 0);

  return (
    <Card
      testId="view-daily-chart"
      title={porHora ? "Vendas por hora" : "Vendas por dia"}
      color="var(--orange)"
      controls={hourly !== null ? <GranularitySwitch testId="view-daily-granularity" active={porHora ? "hora" : "dia"} onChange={onGranularityChange} /> : undefined}
    >
      {empty ? (
        <Empty testId="view-daily-chart-empty" />
      ) : (
        <div className="ult-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="x" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={porHora ? 48 : 24} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--text-muted)" }}
                itemStyle={{ color: "var(--text)" }}
                labelFormatter={(_l: unknown, payload?: readonly { payload?: { tooltip?: string } }[]) => payload?.[0]?.payload?.tooltip ?? ""}
                formatter={(value) => [value, "Vendas"]}
              />
              <Bar dataKey="sales" name="Vendas" fill="var(--orange)" radius={[2, 2, 0, 0]} maxBarSize={32} isAnimationActive={rows.length < 300} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function ViewCumulativeChart({ daily, hourly, granularity, onGranularityChange }: ChartProps) {
  const porHora = granularity === "hora" && hourly !== null;
  const points = useMemo(
    () => (porHora ? buildViewHourlyCumulative(hourly ?? []) : buildViewDailyCumulative(daily)),
    [daily, hourly, porHora]
  );
  const rows = useMemo(() => buildChartRows(points, porHora ? "hora" : "dia"), [points, porHora]);
  const empty = points.length === 0 || points[points.length - 1].cumulative === 0;

  return (
    <Card
      testId="view-cumulative-chart"
      title={porHora ? "Vendas acumuladas — por hora" : "Vendas acumuladas"}
      color="var(--violet)"
      controls={hourly !== null ? <GranularitySwitch testId="view-cumulative-granularity" active={porHora ? "hora" : "dia"} onChange={onGranularityChange} /> : undefined}
    >
      {empty ? (
        <Empty testId="view-cumulative-chart-empty" />
      ) : (
        <div className="ult-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="viewCumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--violet)" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="var(--violet)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="x" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={porHora ? 48 : 24} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--text-muted)" }}
                itemStyle={{ color: "var(--text)" }}
                labelFormatter={(_l: unknown, payload?: readonly { payload?: { tooltip?: string } }[]) => payload?.[0]?.payload?.tooltip ?? ""}
                formatter={(value) => [value, "Vendas acumuladas"]}
              />
              <Area dataKey="cumulative" name="Vendas acumuladas" stroke="var(--violet)" strokeWidth={2} fill="url(#viewCumulativeGradient)" dot={false} activeDot={{ r: 4 }} isAnimationActive={rows.length < 300} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
