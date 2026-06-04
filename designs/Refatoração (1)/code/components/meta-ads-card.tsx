"use client";

import { KpiCell } from "./kpi-cell";
import { MetaAdsInvestimentoLeadsChart } from "./trend-charts";
import type { GlobalMetrics, DailyPoint } from "@/types/indicadores";

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

interface MetaAdsCardProps {
  metaState: SectionState<GlobalMetrics>;
  dailyState: SectionState<DailyPoint[]>;
}

function fmt(n: number | null | undefined, type: "brl" | "pct" | "num"): string {
  if (n === null || n === undefined) return "—";
  if (type === "brl") return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  if (type === "pct") return `${n.toFixed(2)}%`;
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function CardHeader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 20px",
        borderBottom: "1px solid var(--border-vis)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          background: "rgba(61,132,245,0.15)",
          border: "1px solid rgba(61,132,245,0.2)",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--blue)",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        M
      </div>
      <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>
        Meta Ads
      </span>
      <span
        style={{
          background: "rgba(61,132,245,0.1)",
          border: "1px solid rgba(61,132,245,0.2)",
          color: "var(--blue)",
          fontSize: 10,
          borderRadius: 4,
          padding: "2px 7px",
          marginLeft: 2,
        }}
      >
        Tráfego Pago
      </span>
    </div>
  );
}

export function MetaAdsCard({ metaState, dailyState }: MetaAdsCardProps) {
  const cardStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border-vis)",
    borderRadius: 10,
    overflow: "hidden",
  };

  if (metaState.loading) {
    return (
      <div style={cardStyle}>
        <CardHeader />
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ height: 68, background: "var(--surface-2)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 52, background: "var(--surface-2)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (metaState.error || !metaState.data) {
    return (
      <div style={cardStyle}>
        <CardHeader />
        <div style={{ padding: 20 }}>
          <span style={{ color: "var(--red)", fontSize: 13 }}>
            Erro ao carregar dados do Meta Ads.
          </span>
        </div>
      </div>
    );
  }

  const d = metaState.data;

  return (
    <div style={cardStyle}>
      <CardHeader />
      <div style={{ padding: 20 }}>

        {/* Primary: Investimento + Leads — large, high-signal */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <KpiCell
            label="Investimento"
            value={fmt(d.meta_spend, "brl")}
            accent="var(--blue)"
            size="lg"
          />
          <KpiCell
            label="Leads Gerados"
            value={fmt(d.meta_leads, "num")}
            accent="var(--blue)"
            size="lg"
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />

        {/* Secondary: efficiency metrics — smaller */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <KpiCell label="CPM"          value={fmt(d.meta_cpm, "brl")} />
          <KpiCell label="CTR"          value={fmt(d.meta_ctr, "pct")} />
          <KpiCell label="CPL Tráfego"  value={fmt(d.meta_cpl_traffic, "brl")} />
          <KpiCell label="Connect Rate" value={fmt(d.meta_connect_rate, "pct")} />
          <KpiCell label="Conv. LP"     value={fmt(d.meta_lp_conversion, "pct")} />
          <KpiCell label="Checkout"     value={fmt(d.meta_checkout, "num")} />
        </div>

        {/* Chart */}
        <MetaAdsInvestimentoLeadsChart
          data={dailyState.data ?? []}
          loading={dailyState.loading}
        />

      </div>
    </div>
  );
}
