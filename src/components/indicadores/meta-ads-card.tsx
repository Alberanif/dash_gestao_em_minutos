"use client";

import { KpiCell } from "./kpi-cell";
import { MetaAdsInvestimentoLeadsChart } from "./trend-charts";
import type { GlobalMetrics, DailyPoint } from "@/types/indicadores";
import { NotConfiguredBadge } from "./not-configured-badge";

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

interface MetaAdsPanelProps {
  metaState: SectionState<GlobalMetrics>;
  dailyState: SectionState<DailyPoint[]>;
  hasMetaFilter?: boolean;
}

function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

export function MetaAdsPanel({ metaState, dailyState, hasMetaFilter = true }: MetaAdsPanelProps) {
  if (metaState.loading) {
    return (
      <div style={{ padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 44,
                background: "var(--surface-2)",
                borderRadius: 8,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (metaState.error) {
    return (
      <div style={{ padding: 22 }}>
        <span style={{ color: "var(--red)", fontSize: 13 }}>
          Erro ao carregar dados do Meta Ads.
        </span>
      </div>
    );
  }

  if (!metaState.data) return null;
  const d = metaState.data;

  return (
    <>
      {!hasMetaFilter && (
        <NotConfiguredBadge text="Meta Ads não configurado neste filtro — dados zerados" />
      )}
      <div style={{ padding: 22 }}>
        {/* Métricas primárias */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 24 }}>
          <KpiCell label="Investimento" value={fmtBRL(d.meta_spend)} large />
          <KpiCell label="Leads Gerados" value={fmtNum(d.meta_leads)} large />
          <KpiCell label="CPM" value={fmtBRL(d.meta_cpm)} large />
          <KpiCell label="CTR" value={fmtPct(d.meta_ctr)} large />
        </div>

        {/* Métricas secundárias */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            paddingBottom: 22,
            borderBottom: "1px solid var(--border-vis)",
            marginBottom: 20,
          }}
        >
          <KpiCell label="CPL Tráfego" value={d.meta_cpl_traffic !== null ? fmtBRL(d.meta_cpl_traffic) : "—"} />
          <KpiCell label="Connect Rate" value={fmtPct(d.meta_connect_rate)} />
          <KpiCell label="Conv. LP" value={fmtPct(d.meta_lp_conversion)} />
          <KpiCell label="Checkout" value={fmtNum(d.meta_checkout)} />
        </div>

        {hasMetaFilter && (
          <MetaAdsInvestimentoLeadsChart
            data={dailyState.data ?? []}
            loading={dailyState.loading}
          />
        )}
      </div>
    </>
  );
}
