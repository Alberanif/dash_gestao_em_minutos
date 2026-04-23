"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ComparativoTab } from "@/components/indicadores/comparativo-tab";
import type { IndicadoresProject, IndicadoresMetrics, HotmartMetrics } from "@/types/indicadores";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
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

function HotmartSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 120px",
            gap: "8px 16px",
          }}
        >
          <div
            className="animate-pulse"
            style={{ height: 16, borderRadius: 4, background: "var(--color-border)" }}
          />
          <div
            className="animate-pulse"
            style={{ height: 16, borderRadius: 4, background: "var(--color-border)" }}
          />
          <div
            className="animate-pulse"
            style={{ height: 16, borderRadius: 4, background: "var(--color-border)" }}
          />
        </div>
      ))}
    </div>
  );
}

function HotmartSection({ metrics }: { metrics: HotmartMetrics }) {
  const showTotal = metrics.products.length > 1;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 140px",
          gap: "4px 16px",
          paddingBottom: 6,
          marginBottom: 2,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Produto
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            textAlign: "right",
          }}
        >
          Vendas
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            textAlign: "right",
          }}
        >
          Receita (BRL)
        </span>
      </div>

      {metrics.products.map((p) => (
        <div
          key={p.product_id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 140px",
            gap: "4px 16px",
            padding: "8px 0",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 6 }}>
            {p.product_name}
            {p.is_foreign_currency && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "1px 5px", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                moeda ext.
              </span>
            )}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--color-text)",
              textAlign: "right",
              fontFamily: "monospace",
            }}
          >
            {fmtNum(p.sales_count)}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: p.is_foreign_currency ? "var(--color-text-muted)" : "#f97316",
              textAlign: "right",
              fontFamily: "monospace",
            }}
          >
            {p.is_foreign_currency ? "—" : fmtBRL(p.revenue)}
          </span>
        </div>
      ))}

      {showTotal && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 140px",
            gap: "4px 16px",
            padding: "10px 0 4px",
            borderTop: "2px solid var(--color-border)",
          }}
        >
          <span
            style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}
          >
            Total
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--color-text)",
              textAlign: "right",
              fontFamily: "monospace",
            }}
          >
            {fmtNum(metrics.total_sales)}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#f97316",
              textAlign: "right",
              fontFamily: "monospace",
            }}
          >
            {fmtBRL(metrics.total_revenue)}
          </span>
        </div>
      )}

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
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [hotmartMetrics, setHotmartMetrics] = useState<HotmartMetrics | null>(null);
  const [loadingHotmart, setLoadingHotmart] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "comparativo">("overview");

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
    setLoadingHotmart(true);
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    const [metricsRes, hotmartRes] = await Promise.all([
      fetch(`/api/indicadores/projects/${id}/metrics?${params}`),
      fetch(`/api/indicadores/projects/${id}/hotmart-metrics?${params}`),
    ]);
    const [metricsData, hotmartData] = await Promise.all([
      metricsRes.json(),
      hotmartRes.json(),
    ]);
    setMetrics(metricsData.error ? null : metricsData);
    setHotmartMetrics(hotmartData.error ? null : hotmartData);
    setLoadingMetrics(false);
    setLoadingHotmart(false);
  }, [id, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);


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

        <Section
          title="Hotmart"
          accent="#f97316"
          accentBg="#fff7ed"
          icon={
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          }
        >
          {loadingHotmart ? (
            <HotmartSkeleton />
          ) : hotmartMetrics && hotmartMetrics.products.length > 0 ? (
            <HotmartSection metrics={hotmartMetrics} />
          ) : (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Nenhum produto Hotmart configurado.
            </p>
          )}
        </Section>

      </div>
      ) : (
        <ComparativoTab
          projectId={id}
          projectName={project?.name ?? ""}
        />
      )}

      <style>{`
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
`}</style>
    </div>
  );
}
