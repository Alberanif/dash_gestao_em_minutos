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

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function ChartSkeleton() {
  return (
    <div
      style={{
        height: 180,
        borderRadius: 8,
        background: "var(--color-bg)",
        animation: "pulse 1.5s ease-in-out infinite",
        marginTop: 16,
      }}
    />
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyChart() {
  return (
    <div
      style={{
        height: 180,
        borderRadius: 8,
        border: "1px dashed var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
      }}
    >
      <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
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
        fontSize: 11,
        fontWeight: 600,
        color: "var(--color-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginTop: 20,
        marginBottom: 4,
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
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmtBRL(v)}
            width={72}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              if (name === "Investimento") return [fmtBRL(Number(value)), String(name)];
              return [value, String(name)];
            }}
          />
          <Bar yAxisId="left" dataKey="spend" name="Investimento" fill="#1877f2" opacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={32} />
          <Line yAxisId="right" dataKey="leads" name="Leads" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmtBRL(v)}
            width={72}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value) => [fmtBRL(Number(value)), "CPL"]}
          />
          <Line dataKey="cpl" name="CPL" stroke="#1877f2" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
  if (loading) return <><ChartLabel>Vendas diárias</ChartLabel><ChartSkeleton /></>;

  const chartData = data
    .filter((d) => d.hotmart_sales > 0)
    .map((d) => ({
      date: fmtDate(d.date),
      sales: d.hotmart_sales,
    }));

  if (chartData.length === 0) return <><ChartLabel>Vendas diárias</ChartLabel><EmptyChart /></>;

  return (
    <>
      <ChartLabel>Vendas diárias</ChartLabel>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value) => [value, "Vendas"]}
          />
          <Bar dataKey="sales" name="Vendas" fill="#f97316" opacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
