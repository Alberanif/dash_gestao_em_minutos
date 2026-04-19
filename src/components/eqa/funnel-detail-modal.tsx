"use client";

import { useEffect } from "react";
import type { Funnel, FunnelMetrics } from "@/types/funnels";

function formatBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

const FUNNEL_TYPE_LABELS: Record<string, string> = {
  destrave: "Destrave",
};

interface FunnelDetailModalProps {
  funnel: Funnel;
  metrics: FunnelMetrics;
  open: boolean;
  onClose: () => void;
}

export function FunnelDetailModal({
  funnel,
  metrics,
  open,
  onClose,
}: FunnelDetailModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const progress =
    funnel.goal_sales > 0
      ? Math.min((metrics.total_sales / funnel.goal_sales) * 100, 100)
      : 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 480,
          padding: 24,
          position: "relative",
        }}
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
          title="Fechar"
        >
          ✕
        </button>

        {/* Título */}
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 4,
            paddingRight: 32,
          }}
        >
          {funnel.name}
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20 }}>
          {FUNNEL_TYPE_LABELS[funnel.type] ?? funnel.type} ·{" "}
          {formatDate(funnel.start_date)} → {formatDate(funnel.end_date)}
        </p>

        <div
          style={{
            height: 1,
            background: "var(--color-border)",
            marginBottom: 20,
          }}
        />

        {/* KPIs */}
        <div
          className={`grid gap-4 mb-6 ${funnel.config.inactive_ads ? "grid-cols-2" : "grid-cols-3"}`}
        >
          <div
            style={{
              background: "var(--color-bg)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 14px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>
              Total de Vendas
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)" }}>
              {metrics.total_sales}
            </p>
            {metrics.total_sales_other_currencies > 0 && (
              <p style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 3, lineHeight: 1.4 }}>
                BRL: {metrics.total_sales_brl} · Outras: {metrics.total_sales_other_currencies}
              </p>
            )}
          </div>
          {!funnel.config.inactive_ads && (
            <div
              style={{
                background: "var(--color-bg)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>
                CAC
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)" }}>
                {metrics.cac > 0 ? formatBRL(metrics.cac) : "—"}
              </p>
            </div>
          )}
          <div
            style={{
              background: "var(--color-bg)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 14px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>
              Pace Diário
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)" }}>
              {metrics.pace_diario}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-text-muted)" }}>
                /dia
              </span>
            </p>
          </div>
        </div>

        {/* Progresso */}
        <div>
          <div className="flex justify-between mb-2">
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Progresso do objetivo
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
              {metrics.total_sales} de {funnel.goal_sales} vendas ({Math.round(progress)}%)
            </span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 99,
              background: "var(--color-bg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                borderRadius: 99,
                background: "var(--color-primary)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
