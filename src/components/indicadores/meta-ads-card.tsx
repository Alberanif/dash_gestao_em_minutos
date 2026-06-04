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

interface MetaAdsCardProps {
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

function CardHeader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "16px 20px",
        borderBottom: "1px solid var(--border-vis)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          background: "rgba(59,130,246,0.15)",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--blue)",
          fontSize: 14,
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
          background: "rgba(59,130,246,0.1)",
          border: "1px solid rgba(59,130,246,0.2)",
          color: "var(--blue)",
          fontSize: 10,
          borderRadius: 4,
          padding: "2px 7px",
        }}
      >
        Tráfego Pago
      </span>
    </div>
  );
}

export function MetaAdsCard({ metaState, dailyState, hasMetaFilter = true }: MetaAdsCardProps) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <CardHeader />
      {!hasMetaFilter && (
        <NotConfiguredBadge text="Meta Ads não configurado neste filtro — dados zerados" />
      )}

      {metaState.loading && (
        <div style={{ padding: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 52,
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {!metaState.loading && metaState.error && (
        <div style={{ padding: 20 }}>
          <span style={{ color: "var(--red)", fontSize: 13 }}>
            Erro ao carregar dados do Meta Ads.
          </span>
        </div>
      )}

      {!metaState.loading && !metaState.error && metaState.data && (
        <div style={{ padding: 20 }}>
          {(() => {
            const d = metaState.data!;
            return (
              <>
                {/* Métricas primárias: 2 colunas, large=true */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 8 }}>
                  <KpiCell label="Investimento" value={fmtBRL(d.meta_spend)} accent="var(--blue)" large />
                  <KpiCell label="Leads Gerados" value={fmtNum(d.meta_leads)} accent="var(--blue)" large />
                </div>

                {/* Separador */}
                <div style={{ borderTop: "1px solid var(--border-vis)", margin: "8px 0" }} />

                {/* Métricas secundárias: 3 colunas */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  <KpiCell label="CPM" value={fmtBRL(d.meta_cpm)} />
                  <KpiCell label="CTR" value={fmtPct(d.meta_ctr)} />
                  <KpiCell label="CPL Tráfego" value={d.meta_cpl_traffic !== null ? fmtBRL(d.meta_cpl_traffic) : "—"} />
                  <KpiCell label="Connect Rate" value={fmtPct(d.meta_connect_rate)} />
                  <KpiCell label="Conv. LP" value={fmtPct(d.meta_lp_conversion)} />
                  <KpiCell label="Checkout" value={fmtNum(d.meta_checkout)} />
                </div>
              </>
            );
          })()}
          {hasMetaFilter && (
            <MetaAdsInvestimentoLeadsChart
              data={dailyState.data ?? []}
              loading={dailyState.loading}
            />
          )}
        </div>
      )}
    </div>
  );
}
