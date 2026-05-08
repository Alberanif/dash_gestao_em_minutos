"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import type { LtvMetrics } from "@/types/ltv";

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function Delta({ value, positiveIsGood }: { value: number; positiveIsGood: boolean }) {
  if (value === 0) return <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>—</span>;
  const isPositive = value > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: isGood ? "var(--color-success)" : "var(--color-danger)",
      }}
    >
      {isPositive ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}

interface LtvCardProps {
  title: string;
  start: string;
  end: string;
  metrics: LtvMetrics | null;
  loading: boolean;
}

export function LtvCard({ title, start, end, metrics, loading }: LtvCardProps) {
  if (loading) return <SkeletonCard />;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "16px",
        flex: 1,
        minWidth: 0,
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-md)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card)")}
    >
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <p className="font-semibold" style={{ fontSize: 15, color: "var(--color-text)" }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
          {formatDate(start)} → {formatDate(end)}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--color-border)", margin: "12px 0" }} />

      {/* Métricas */}
      {metrics ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Assinaturas Ativas */}
          <div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>
              Assinaturas Ativas
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)", lineHeight: 1 }}>
              {metrics.assinaturas_ativas}
            </p>
          </div>

          {/* Total de Assinaturas Ativas */}
          {metrics.total_assinaturas_ativas !== undefined && (
            <div
              style={{
                background: "var(--color-bg)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
              }}
            >
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>
                Total de Assinaturas Ativas
              </p>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>
                {metrics.total_assinaturas_ativas}
              </p>
            </div>
          )}

          {/* Assinaturas Canceladas */}
          <div>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Assinaturas Canceladas
              </p>
              <Delta value={metrics.assinaturas_canceladas_delta} positiveIsGood={false} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)" }}>
              {metrics.assinaturas_canceladas}
            </p>
          </div>

          {/* Novas Assinaturas */}
          <div>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Novas Assinaturas
              </p>
              <Delta value={metrics.novas_assinaturas_delta} positiveIsGood={true} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)" }}>
              {metrics.novas_assinaturas}
            </p>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Sem dados no período</p>
      )}
    </div>
  );
}
