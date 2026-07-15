"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  BarChart,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import type { DailyPoint } from "@/types/indicadores";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(n: number) {
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(dateStr: string) {
  // "2026-05-01" → "01/05"
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

const TICK = { fontSize: 9, fill: "var(--text-3)" };

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-vis)",
  borderRadius: 7,
  fontSize: 12,
};

const TOOLTIP_LABEL_STYLE: React.CSSProperties = { color: "var(--text-2)" };

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function ChartSkeleton() {
  return (
    <div
      style={{
        height: 170,
        borderRadius: 8,
        background: "var(--surface-2)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyChart() {
  return (
    <div
      style={{
        height: 170,
        borderRadius: 8,
        border: "1px dashed var(--border-vis)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ fontSize: 13, color: "var(--text-3)" }}>
        Sem dados no período
      </p>
    </div>
  );
}

// ── Chart label ───────────────────────────────────────────────────────────────

function ChartLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 9,
        fontWeight: 600,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginTop: 0,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  );
}

// ── 1. Investimento × Leads por dia ──────────────────────────────────────────

export function MetaAdsInvestimentoLeadsChart({
  data,
  loading,
}: {
  data: DailyPoint[];
  loading: boolean;
}) {
  if (loading) return <><ChartLabel>Investimento × Leads por dia</ChartLabel><ChartSkeleton /></>;
  if (data.length === 0) return <><ChartLabel>Investimento × Leads por dia</ChartLabel><EmptyChart /></>;

  const hasSpend = data.some((d) => d.meta_spend > 0);
  const hasLeads = data.some((d) => d.meta_leads > 0);
  if (!hasSpend && !hasLeads) return <><ChartLabel>Investimento × Leads por dia</ChartLabel><EmptyChart /></>;

  const chartData = data.map((d) => ({
    date: fmtDate(d.date),
    spend: d.meta_spend,
    leads: d.meta_leads,
  }));

  return (
    <>
      <ChartLabel>Investimento × Leads por dia</ChartLabel>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmtBRL(v)}
            width={72}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value, name) => {
              if (name === "Investimento") return [fmtBRL(Number(value)), String(name)];
              return [value, String(name)];
            }}
          />
          <Bar yAxisId="left" dataKey="spend" name="Investimento" fill="var(--blue)" radius={[2, 2, 0, 0]} maxBarSize={32} />
          <Line yAxisId="right" dataKey="leads" name="Leads" stroke="var(--orange)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </>
  );
}

// ── 2. CPL diário ────────────────────────────────────────────────────────────

export function MetaAdsCplChart({
  data,
  loading,
}: {
  data: DailyPoint[];
  loading: boolean;
}) {
  if (loading) return <><ChartLabel>CPL diário</ChartLabel><ChartSkeleton /></>;

  const chartData = data
    .filter((d) => d.meta_cpl_traffic !== null)
    .map((d) => ({
      date: fmtDate(d.date),
      cpl: d.meta_cpl_traffic as number,
    }));

  if (chartData.length === 0) return <><ChartLabel>CPL diário</ChartLabel><EmptyChart /></>;

  return (
    <>
      <ChartLabel>CPL diário</ChartLabel>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmtBRL(v)}
            width={72}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value) => [fmtBRL(Number(value)), "CPL"]}
          />
          <Line dataKey="cpl" name="CPL" stroke="var(--blue)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

// ── 3. Vendas diárias Hotmart ────────────────────────────────────────────────

export function HotmartVendasChart({
  data,
  loading,
}: {
  data: DailyPoint[];
  loading: boolean;
}) {
  if (loading) return <><ChartLabel>Vendas Diárias</ChartLabel><ChartSkeleton /></>;

  const chartData = data
    .filter((d) => d.hotmart_sales > 0)
    .map((d) => ({
      date: fmtDate(d.date),
      sales: d.hotmart_sales,
    }));

  if (chartData.length === 0) return <><ChartLabel>Vendas Diárias</ChartLabel><EmptyChart /></>;

  return (
    <>
      <ChartLabel>Vendas Diárias</ChartLabel>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value) => [value, "Vendas"]}
          />
          <Bar dataKey="sales" name="Vendas" fill="var(--orange)" radius={[2, 2, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

// ── 4. Captações de leads diárias ────────────────────────────────────────────

export function LeadsCaptacoesChart({
  data,
  loading,
}: {
  data: DailyPoint[];
  loading: boolean;
}) {
  if (loading) return <><ChartLabel>Captações Diárias</ChartLabel><ChartSkeleton /></>;

  const chartData = data
    .filter((d) => d.lead_captacoes > 0)
    .map((d) => ({
      date: fmtDate(d.date),
      captacoes: d.lead_captacoes,
    }));

  if (chartData.length === 0) return <><ChartLabel>Captações Diárias</ChartLabel><EmptyChart /></>;

  return (
    <>
      <ChartLabel>Captações Diárias</ChartLabel>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4fae82" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#4fae82" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value) => [value, "Captações"]}
          />
          <Area
            dataKey="captacoes"
            name="Captações"
            stroke="var(--green)"
            strokeWidth={2}
            fill="url(#leadGradient)"
            dot={{ r: 3.5, stroke: "var(--green)", strokeWidth: 2, fill: "var(--bg)" }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}
