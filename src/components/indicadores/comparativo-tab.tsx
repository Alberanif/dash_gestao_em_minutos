"use client";

import { useState, useCallback } from "react";
import type { IndicadoresMetrics, ComparativoPeriod } from "@/types/indicadores";
import { PeriodDateModal } from "./period-date-modal";

function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

type KpiItem = {
  label: string;
  key: keyof IndicadoresMetrics;
  fmt: (n: number | null | undefined) => string;
};

type KpiGroup = {
  group: string;
  accent: string;
  items: KpiItem[];
};

const KPI_GROUPS: KpiGroup[] = [
  {
    group: "Meta Ads",
    accent: "#1877f2",
    items: [
      { label: "Investimento", key: "meta_spend", fmt: fmtBRL },
      { label: "CPM", key: "meta_cpm", fmt: fmtBRL },
      { label: "CTR", key: "meta_ctr", fmt: fmtPct },
      { label: "Leads", key: "meta_leads", fmt: fmtNum },
      { label: "Connect Rate", key: "meta_connect_rate", fmt: fmtPct },
      { label: "CPL Tráfego", key: "meta_cpl_traffic", fmt: fmtBRL },
      { label: "Conversão LP", key: "meta_lp_conversion", fmt: fmtPct },
    ],
  },
  {
    group: "Google Ads",
    accent: "#34a853",
    items: [
      { label: "Investimento", key: "google_spend", fmt: fmtBRL },
      { label: "CPM", key: "google_cpm", fmt: fmtBRL },
      { label: "Leads Total", key: "google_leads", fmt: fmtNum },
      { label: "Connect Rate", key: "google_connect_rate", fmt: fmtPct },
      { label: "CPL Tráfego", key: "google_cpl_traffic", fmt: fmtBRL },
      { label: "Conversão LP", key: "google_lp_conversion", fmt: fmtPct },
    ],
  },
  {
    group: "Leads Orgânicos",
    accent: "#0891b2",
    items: [
      { label: "Leads Orgânicos", key: "organic_leads", fmt: fmtNum },
      { label: "Leads Desconhecidos", key: "unknown_leads", fmt: fmtNum },
    ],
  },
];

interface ComparativoTabProps {
  projectId: string;
  projectName: string;
}

export function ComparativoTab({ projectId, projectName }: ComparativoTabProps) {
  const [periods, setPeriods] = useState<(ComparativoPeriod | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  const fetchMetrics = useCallback(
    async (index: number, start: string, end: string) => {
      setPeriods((prev) => {
        const next = [...prev];
        next[index] = {
          startDate: start,
          endDate: end,
          metrics: null,
          loading: true,
          error: false,
        };
        return next;
      });
      try {
        const params = new URLSearchParams({
          start_date: start,
          end_date: end,
        });
        const res = await fetch(
          `/api/indicadores/projects/${projectId}/metrics?${params}`
        );
        const data: IndicadoresMetrics & { error?: string } = await res.json();
        setPeriods((prev) => {
          const next = [...prev];
          next[index] = {
            startDate: start,
            endDate: end,
            metrics: data.error ? null : data,
            loading: false,
            error: !!data.error,
          };
          return next;
        });
      } catch {
        setPeriods((prev) => {
          const next = [...prev];
          next[index] = {
            startDate: start,
            endDate: end,
            metrics: null,
            loading: false,
            error: true,
          };
          return next;
        });
      }
    },
    [projectId]
  );

  function handleSave(index: number, start: string, end: string) {
    setModalIndex(null);
    fetchMetrics(index, start, end);
  }

  function clearPeriod(index: number) {
    setPeriods((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  return (
    <div style={{ padding: "20px 24px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(200px, 1fr))",
          gap: 16,
          overflowX: "auto",
        }}
      >
        {periods.map((period, index) =>
          period === null ? (
            <EmptySlot key={index} onAdd={() => setModalIndex(index)} />
          ) : (
            <FilledSlot
              key={index}
              period={period}
              projectName={projectName}
              onEditDates={() => setModalIndex(index)}
              onClear={() => clearPeriod(index)}
              onRetry={() =>
                fetchMetrics(index, period.startDate, period.endDate)
              }
            />
          )
        )}
      </div>

      {modalIndex !== null && (
        <PeriodDateModal
          initialStart={periods[modalIndex]?.startDate ?? ""}
          initialEnd={periods[modalIndex]?.endDate ?? ""}
          onSave={(start, end) => handleSave(modalIndex, start, end)}
          onCancel={() => setModalIndex(null)}
        />
      )}
    </div>
  );
}

function EmptySlot({ onAdd }: { onAdd: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onAdd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        minHeight: 400,
        border: "2px dashed var(--color-border)",
        borderRadius: "var(--radius-card)",
        background: hovered ? "var(--color-surface)" : "var(--color-bg)",
        cursor: "pointer",
        transition: "background 0.15s",
        color: "var(--color-text-muted)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        +
      </div>
      <span style={{ fontSize: 12, fontWeight: 500 }}>Adicionar período</span>
    </button>
  );
}

function FilledSlot({
  period,
  projectName,
  onEditDates,
  onClear,
  onRetry,
}: {
  period: ComparativoPeriod;
  projectName: string;
  onEditDates: () => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        background: "var(--color-surface)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-text)",
            paddingRight: 24,
            lineHeight: 1.3,
          }}
        >
          {projectName}
        </p>
        <button
          onClick={onEditDates}
          title="Alterar período"
          style={{
            fontSize: 11,
            color: "var(--color-primary)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            fontWeight: 600,
          }}
        >
          {formatDate(period.startDate)} – {formatDate(period.endDate)}
        </button>
        <button
          onClick={onClear}
          title="Remover período"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            color: "var(--color-text-muted)",
            fontSize: 14,
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", flex: 1 }}>
        {period.error ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <p style={{ fontSize: 12, color: "var(--color-danger)" }}>
              Erro ao carregar dados
            </p>
            <button
              onClick={onRetry}
              style={{
                fontSize: 12,
                color: "var(--color-primary)",
                background: "none",
                border: "1px solid var(--color-primary)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 10px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {KPI_GROUPS.map(({ group, accent, items }) => (
              <div key={group}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  {group}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {items.map(({ label, key, fmt }) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "5px 8px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-bg)",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minWidth: 0,
                        }}
                      >
                        {label}
                      </span>
                      {period.loading ? (
                        <div
                          style={{
                            height: 12,
                            width: 48,
                            borderRadius: 4,
                            background: "var(--color-border)",
                            animation: "pulse 1.5s ease-in-out infinite",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color:
                              period.metrics?.[key] !== null &&
                              period.metrics?.[key] !== undefined
                                ? "var(--color-text)"
                                : "var(--color-text-muted)",
                            fontFamily: "monospace",
                            flexShrink: 0,
                          }}
                        >
                          {fmt(period.metrics?.[key] as number | null | undefined)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
