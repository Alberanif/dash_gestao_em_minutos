"use client";

import { useState, useRef, useEffect } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
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

interface FunnelCardProps {
  funnel: Funnel;
  metrics: FunnelMetrics | null;
  loading: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function FunnelCard({
  funnel,
  metrics,
  loading,
  onClick,
  onEdit,
  onDelete,
}: FunnelCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (loading) return <SkeletonCard />;

  const progress =
    metrics && funnel.goal_sales > 0
      ? Math.min((metrics.total_sales / funnel.goal_sales) * 100, 100)
      : 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "16px",
        cursor: "pointer",
        transition: "box-shadow 0.15s",
        position: "relative",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-md)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-card)")
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div style={{ minWidth: 0 }}>
          <p
            className="truncate font-semibold"
            style={{ fontSize: 15, color: "var(--color-text)" }}
          >
            {funnel.name}
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            {FUNNEL_TYPE_LABELS[funnel.type] ?? funnel.type} ·{" "}
            {formatDate(funnel.start_date)} → {formatDate(funnel.end_date)}
          </p>
        </div>

        {/* Menu ⋯ */}
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 6,
              color: "var(--color-text-muted)",
              fontSize: 18,
              lineHeight: 1,
            }}
            title="Opções"
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--shadow-md)",
                zIndex: 20,
                minWidth: 120,
                overflow: "hidden",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onEdit();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 14px",
                  fontSize: 13,
                  color: "var(--color-text)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--color-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                Editar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 14px",
                  fontSize: 13,
                  color: "var(--color-danger)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--color-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "var(--color-border)",
          margin: "12px 0",
        }}
      />

      {/* Métricas */}
      {metrics ? (
        <>
          {/* Barra de progresso */}
          <div className="mb-2">
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Vendas
              </span>
              <span style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>
                {metrics.total_sales} / {funnel.goal_sales}{" "}
                <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
                  ({Math.round(progress)}%)
                </span>
                {metrics.total_sales_other_currencies > 0 && (
                  <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: 11 }}>
                    {" "}· {metrics.total_sales_brl} BRL + {metrics.total_sales_other_currencies} ext.
                  </span>
                )}
              </span>
            </div>
            <div
              style={{
                height: 6,
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

          {/* Pace e CAC */}
          <div className="flex gap-4 mt-3">
            <div>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                Pace
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                {metrics.pace_diario}/dia
              </p>
            </div>
            {!funnel.config.inactive_ads && (
              <>
                <div
                  style={{
                    width: 1,
                    background: "var(--color-border)",
                    margin: "0 4px",
                  }}
                />
                <div>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>CAC</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                    {metrics.cac > 0 ? formatBRL(metrics.cac) : "—"}
                  </p>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Sem dados no período
        </p>
      )}
    </div>
  );
}
