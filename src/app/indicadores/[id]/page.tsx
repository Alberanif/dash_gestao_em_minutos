"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { WeeklyDataModal } from "@/components/indicadores/weekly-data-modal";
import type { IndicadoresProject, IndicadoresWeeklyData, IndicadoresMetrics } from "@/types/indicadores";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildWeeks(start: string, end: string): { weekStart: string; weekEnd: string }[] {
  const weeks: { weekStart: string; weekEnd: string }[] = [];
  const endDate = new Date(end);
  let current = new Date(start);
  while (current <= endDate) {
    const weekStart = current.toISOString().slice(0, 10);
    const weekEndDate = new Date(current);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = (weekEndDate > endDate ? endDate : weekEndDate)
      .toISOString()
      .slice(0, 10);
    weeks.push({ weekStart, weekEnd });
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: 13,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  outline: "none",
};

function KpiBox({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.1 }}>
        {value}
      </p>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<IndicadoresProject | null>(null);
  const [startDate, setStartDate] = useState(daysAgo(28));
  const [endDate, setEndDate] = useState(today());
  const [metrics, setMetrics] = useState<IndicadoresMetrics | null>(null);
  const [weeklyData, setWeeklyData] = useState<IndicadoresWeeklyData[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const [weeklyModal, setWeeklyModal] = useState<{
    weekStart: string;
    weekEnd: string;
    existing: IndicadoresWeeklyData | null;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/indicadores/projects`)
      .then((r) => r.json())
      .then((data: IndicadoresProject[]) => {
        const found = data.find((p) => p.id === id) ?? null;
        setProject(found);
      })
      .catch(() => setProject(null));
  }, [id]);

  const loadData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoadingMetrics(true);
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    const [metricsRes, weeklyRes] = await Promise.all([
      fetch(`/api/indicadores/projects/${id}/metrics?${params}`),
      fetch(`/api/indicadores/projects/${id}/weekly?${params}`),
    ]);
    const [metricsData, weeklyRaw] = await Promise.all([metricsRes.json(), weeklyRes.json()]);
    setMetrics(metricsData.error ? null : metricsData);
    setWeeklyData(Array.isArray(weeklyRaw) ? weeklyRaw : []);
    setLoadingMetrics(false);
  }, [id, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleWeeklySave(saved: IndicadoresWeeklyData) {
    setWeeklyData((prev) => {
      const idx = prev.findIndex((w) => w.week_start === saved.week_start);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved].sort((a, b) => a.week_start.localeCompare(b.week_start));
    });
  }

  const weeks = buildWeeks(startDate, endDate);

  const sectionBoxStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: 20,
    marginBottom: 20,
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>
          {project?.name ?? "Carregando..."}
        </h1>
        {project?.campaign_terms && project.campaign_terms.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            Termos: {project.campaign_terms.join(", ")}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>Período:</span>
        <input
          type="date"
          style={inputStyle}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>até</span>
        <input
          type="date"
          style={inputStyle}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        {loadingMetrics && (
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Carregando...</span>
        )}
      </div>

      <div style={sectionBoxStyle}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>
          Meta Ads
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          <KpiBox title="Investimento Total" value={fmtBRL(metrics?.meta_spend)} />
          <KpiBox title="CPM" value={fmtBRL(metrics?.meta_cpm)} />
          <KpiBox title="CTR" value={fmtPct(metrics?.meta_ctr)} />
          <KpiBox title="Leads" value={fmtNum(metrics?.meta_leads)} />
          <KpiBox title="Connect Rate" value={fmtPct(metrics?.meta_connect_rate)} />
          <KpiBox title="CPL Tráfego" value={fmtBRL(metrics?.meta_cpl_traffic)} />
          <KpiBox title="Taxa Conversão LP" value={fmtPct(metrics?.meta_lp_conversion)} />
        </div>
      </div>

      <div style={sectionBoxStyle}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>
          Google Ads
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          <KpiBox title="Investimento Total" value={fmtBRL(metrics?.google_spend)} />
          <KpiBox title="CPM" value={fmtBRL(metrics?.google_cpm)} />
          <KpiBox title="Leads Total" value={fmtNum(metrics?.google_leads)} />
          <KpiBox title="Connect Rate" value={fmtPct(metrics?.google_connect_rate)} />
          <KpiBox title="CPL Tráfego" value={fmtBRL(metrics?.google_cpl_traffic)} />
          <KpiBox title="Taxa Conversão LP" value={fmtPct(metrics?.google_lp_conversion)} />
        </div>
      </div>

      <div style={sectionBoxStyle}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>
          Planilha de Indicadores Semanais
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  "Semana",
                  "Invest. Meta",
                  "CPM Meta",
                  "CTR Meta",
                  "Leads Meta",
                  "Connect Rate",
                  "Conversão LP",
                  "CPL Tráfego",
                  "Invest. Google",
                  "Leads Google",
                  "",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid var(--color-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map(({ weekStart, weekEnd }) => {
                const wd = weeklyData.find((w) => w.week_start === weekStart) ?? null;
                return (
                  <tr
                    key={weekStart}
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "var(--color-bg)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "transparent")
                    }
                  >
                    <td style={{ padding: "8px 10px", color: "var(--color-text)", whiteSpace: "nowrap", fontWeight: 500 }}>
                      {formatDate(weekStart)} – {formatDate(weekEnd)}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>—</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>—</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>—</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>—</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtPct(wd?.meta_connect_rate)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtPct(wd?.meta_lp_conversion)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtBRL(wd?.meta_cpl_traffic)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtBRL(wd?.google_spend)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtNum(wd?.google_leads)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <button
                        onClick={() => setWeeklyModal({ weekStart, weekEnd, existing: wd })}
                        style={{
                          background: "none",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-sm)",
                          padding: "4px 10px",
                          fontSize: 12,
                          color: "var(--color-primary)",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {wd ? "Editar" : "Inserir"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {weeklyModal && (
        <WeeklyDataModal
          projectId={id}
          weekStart={weeklyModal.weekStart}
          weekEnd={weeklyModal.weekEnd}
          existing={weeklyModal.existing}
          open={!!weeklyModal}
          onClose={() => setWeeklyModal(null)}
          onSave={handleWeeklySave}
        />
      )}
    </div>
  );
}
