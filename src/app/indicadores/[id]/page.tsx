"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { WeeklyDataModal } from "@/components/indicadores/weekly-data-modal";
import { ComparativoTab } from "@/components/indicadores/comparativo-tab";
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

interface KpiBoxProps {
  title: string;
  value: string;
  accent?: string;
  loading?: boolean;
}

function KpiBox({ title, value, accent, loading }: KpiBoxProps) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderTop: accent ? `3px solid ${accent}` : "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.2 }}>
        {title}
      </p>
      {loading ? (
        <div style={{ height: 24, borderRadius: 6, background: "var(--color-bg)", animation: "pulse 1.5s ease-in-out infinite", width: "70%" }} />
      ) : (
        <p style={{ fontSize: 20, fontWeight: 700, color: accent && value !== "—" ? accent : value === "—" ? "var(--color-text-muted)" : "var(--color-text)", lineHeight: 1.1 }}>
          {value}
        </p>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  children: React.ReactNode;
}

function Section({ title, icon, accent, accentBg, children }: SectionProps) {
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--color-border)", background: accentBg }}>
        <div style={{ color: accent, display: "flex", alignItems: "center" }}>{icon}</div>
        <p style={{ fontSize: 13, fontWeight: 700, color: accent }}>{title}</p>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<IndicadoresProject | null>(null);
  const [startDate, setStartDate] = useState(daysAgo(28));
  const [endDate, setEndDate] = useState(today());
  const [metrics, setMetrics] = useState<IndicadoresMetrics | null>(null);
  const [weeklyData, setWeeklyData] = useState<IndicadoresWeeklyData[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "comparativo">("overview");

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

  return (
    <div>
      {/* Page Header */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          padding: "16px 24px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <button
            onClick={() => router.push("/indicadores")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              flexShrink: 0,
              marginTop: 2,
              transition: "background 0.15s, color 0.15s",
            }}
            aria-label="Voltar para projetos"
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "var(--color-surface)";
              el.style.color = "var(--color-text)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "var(--color-bg)";
              el.style.color = "var(--color-text-muted)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.3, wordBreak: "break-word", marginBottom: 4 }}>
              {project?.name ?? "Carregando…"}
            </h1>
            {project?.campaign_terms && project.campaign_terms.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {project.campaign_terms.map((term) => (
                  <span
                    key={term}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--color-primary)",
                      background: "var(--color-primary-light)",
                      padding: "2px 7px",
                      borderRadius: 20,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {term}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {activeTab === "overview" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>De</span>
              <input
                type="date"
                className="field-control"
                style={{ fontSize: 13, width: 148, height: 36 }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>até</span>
              <input
                type="date"
                className="field-control"
                style={{ fontSize: 13, width: 148, height: 36 }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            {loadingMetrics && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)", animation: "spin 0.7s linear infinite" }} />
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Atualizando…</span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          padding: "0 24px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {(["overview", "comparativo"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              color:
                activeTab === tab
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            {tab === "overview" ? "Visão Geral" : "Comparativo"}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "overview" ? (
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 }}>
        <Section
          title="Meta Ads"
          accent="#1877f2"
          accentBg="#eff6ff"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}>
            <KpiBox title="Investimento" value={fmtBRL(metrics?.meta_spend)} accent="#1877f2" loading={loadingMetrics} />
            <KpiBox title="CPM" value={fmtBRL(metrics?.meta_cpm)} loading={loadingMetrics} />
            <KpiBox title="CTR" value={fmtPct(metrics?.meta_ctr)} loading={loadingMetrics} />
            <KpiBox title="Leads" value={fmtNum(metrics?.meta_leads)} loading={loadingMetrics} />
            <KpiBox title="Connect Rate" value={fmtPct(metrics?.meta_connect_rate)} loading={loadingMetrics} />
            <KpiBox title="CPL Tráfego" value={fmtBRL(metrics?.meta_cpl_traffic)} loading={loadingMetrics} />
            <KpiBox title="Conversão LP" value={fmtPct(metrics?.meta_lp_conversion)} loading={loadingMetrics} />
          </div>
        </Section>

        <Section
          title="Google Ads"
          accent="#34a853"
          accentBg="#f0fdf4"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}>
            <KpiBox title="Investimento" value={fmtBRL(metrics?.google_spend)} accent="#34a853" loading={loadingMetrics} />
            <KpiBox title="CPM" value={fmtBRL(metrics?.google_cpm)} loading={loadingMetrics} />
            <KpiBox title="Leads Total" value={fmtNum(metrics?.google_leads)} loading={loadingMetrics} />
            <KpiBox title="Connect Rate" value={fmtPct(metrics?.google_connect_rate)} loading={loadingMetrics} />
            <KpiBox title="CPL Tráfego" value={fmtBRL(metrics?.google_cpl_traffic)} loading={loadingMetrics} />
            <KpiBox title="Conversão LP" value={fmtPct(metrics?.google_lp_conversion)} loading={loadingMetrics} />
          </div>
        </Section>

        <Section
          title="Leads Orgânicos"
          accent="#0891b2"
          accentBg="#ecfeff"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}>
            <KpiBox title="Leads Orgânicos" value={fmtNum(metrics?.organic_leads)} accent="#0891b2" loading={loadingMetrics} />
            <KpiBox title="Leads Desconhecidos" value={fmtNum(metrics?.unknown_leads)} loading={loadingMetrics} />
          </div>
        </Section>

        {/* Weekly table */}
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--color-border)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>Indicadores Semanais</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--color-bg)" }}>
                  {["Semana", "Invest. Meta", "CPM Meta", "CTR Meta", "Leads Meta", "Connect Rate", "Conversão LP", "CPL Tráfego", "Invest. Google", "Leads Google", ""].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
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
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-bg)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 12px", color: "var(--color-text)", whiteSpace: "nowrap", fontWeight: 600, fontSize: 12 }}>
                        {formatDate(weekStart)} – {formatDate(weekEnd)}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>—</td>
                      <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>—</td>
                      <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>—</td>
                      <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>—</td>
                      <td style={{ padding: "10px 12px", color: wd ? "var(--color-text)" : "var(--color-text-muted)", fontFamily: "monospace" }}>{fmtPct(wd?.meta_connect_rate)}</td>
                      <td style={{ padding: "10px 12px", color: wd ? "var(--color-text)" : "var(--color-text-muted)", fontFamily: "monospace" }}>{fmtPct(wd?.meta_lp_conversion)}</td>
                      <td style={{ padding: "10px 12px", color: wd ? "var(--color-text)" : "var(--color-text-muted)", fontFamily: "monospace" }}>{fmtBRL(wd?.meta_cpl_traffic)}</td>
                      <td style={{ padding: "10px 12px", color: wd ? "var(--color-text)" : "var(--color-text-muted)", fontFamily: "monospace" }}>{fmtBRL(wd?.google_spend)}</td>
                      <td style={{ padding: "10px 12px", color: wd ? "var(--color-text)" : "var(--color-text-muted)", fontFamily: "monospace" }}>{fmtNum(wd?.google_leads)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <button
                          onClick={() => setWeeklyModal({ weekStart, weekEnd, existing: wd })}
                          style={{
                            background: wd ? "var(--color-primary-light)" : "none",
                            border: `1px solid ${wd ? "var(--color-primary)" : "var(--color-border)"}`,
                            borderRadius: "var(--radius-sm)",
                            padding: "4px 10px",
                            fontSize: 12,
                            color: wd ? "var(--color-primary)" : "var(--color-text-muted)",
                            cursor: "pointer",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
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
      </div>
      ) : (
        <ComparativoTab
          projectId={id}
          projectName={project?.name ?? ""}
        />
      )}

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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
