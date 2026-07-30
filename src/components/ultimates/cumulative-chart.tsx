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
import type { CumulativeRenewalPoint, UltimatesSeries } from "@/lib/ultimates/cumulative-chart";
import { fmtDateShort } from "@/lib/ultimates/format";

interface CumulativeChartProps {
  data: CumulativeRenewalPoint[];
  series: UltimatesSeries;
  onSeriesChange: (series: UltimatesSeries) => void;
  // Política do ciclo (migration 053). Com ela false só existe uma métrica —
  // as vendas sem vínculo já vieram somadas em `data` por
  // applyNewPurchasesModeToDaily —, então o switch de séries não tem o que
  // alternar e é escondido em vez de mostrar uma curva zerada.
  countsNewBuyers: boolean;
}

const TICK = { fontSize: 10, fill: "var(--text-3)" };

// Tudo que muda entre as duas séries vive aqui — o desenho abaixo é um só.
// A cor de "novos" é a mesma do KPI "Novos Compradores" (--orange, ver
// kpi-row.tsx), para o vínculo entre card 1 e card 2 ser óbvio; renovações
// mantém o violeta que já estava em produção.
const SERIES_CONFIG: Record<
  UltimatesSeries,
  { button: string; title: string; color: string; chip: string; chipBorder: string; chipText: string; empty: string }
> = {
  renovacoes: {
    button: "Renovações",
    title: "Renovações acumuladas",
    color: "var(--violet)",
    chip: "rgba(124, 111, 240, 0.14)",
    chipBorder: "rgba(124, 111, 240, 0.55)",
    chipText: "#b3a9ff",
    empty: "Sem renovações registradas no ciclo ainda.",
  },
  novos: {
    button: "Novos compradores",
    title: "Novos compradores acumulados",
    color: "var(--orange)",
    chip: "rgba(232, 133, 63, 0.14)",
    chipBorder: "rgba(232, 133, 63, 0.55)",
    chipText: "#f0b183",
    empty: "Sem novos compradores registrados no ciclo ainda.",
  },
};

const SERIES_ORDER: UltimatesSeries[] = ["renovacoes", "novos"];

function SeriesSwitch({
  series,
  onSeriesChange,
}: {
  series: UltimatesSeries;
  onSeriesChange: (series: UltimatesSeries) => void;
}) {
  return (
    <div
      data-testid="ultimates-cumulative-series-switch"
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      {SERIES_ORDER.map((option) => {
        const config = SERIES_CONFIG[option];
        const active = option === series;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onSeriesChange(option)}
            data-testid={`ultimates-cumulative-series-${option}`}
            style={{
              padding: "5px 11px",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              borderRadius: 20,
              border: active ? `1px solid ${config.chipBorder}` : "1px solid var(--border-vis)",
              background: active ? config.chip : "var(--surface)",
              color: active ? config.chipText : "var(--text-muted)",
              cursor: "pointer",
              transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
            }}
          >
            {config.button}
          </button>
        );
      })}
    </div>
  );
}

// Gráfico acumulado do card "Evolução" (PRD issue #114, seção 3.3, critério
// 9), alternável entre renovações e novos compradores. Os dados já vêm
// acumulados de buildCumulativeSeries — aqui só formatamos eixos (pt-BR,
// dd/mm) e desenhamos. A altura vive em .ult-chart-body (ultimates.css) para
// o mobile reduzir via media query.
export function CumulativeChart({ data, series, onSeriesChange, countsNewBuyers }: CumulativeChartProps) {
  const config = SERIES_CONFIG[series];
  const chartData = data.map((d) => ({ date: fmtDateShort(d.day), cumulative: d.cumulative }));
  // O eixo de dias é compartilhado pelas duas séries (a RPC agrega as duas
  // juntas), então "sem dados" aqui não é lista vazia: é a série ativa somar
  // zero. Sem isso, um ciclo só com novos compradores mostraria a curva de
  // renovações como uma linha reta colada no eixo, parecendo bug.
  const isEmpty = data.length === 0 || data[data.length - 1].cumulative === 0;
  const gradientId = `ultimatesCumulativeGradient-${series}`;

  return (
    <div
      data-testid="ultimates-cumulative-chart"
      data-series={series}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 11,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          margin: "0 0 14px",
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
            margin: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: config.color, flexShrink: 0 }} />
          {config.title}
        </p>
        {countsNewBuyers && <SeriesSwitch series={series} onSeriesChange={onSeriesChange} />}
      </div>

      {isEmpty ? (
        <div
          data-testid="ultimates-cumulative-chart-empty"
          style={{
            padding: "32px 0",
            textAlign: "center",
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          {config.empty}
        </div>
      ) : (
        <div className="ult-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0} />
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
                formatter={(value) => [value, config.title]}
              />
              <Area
                dataKey="cumulative"
                name={config.title}
                stroke={config.color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
