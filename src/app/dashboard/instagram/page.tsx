"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";
import type { Account, ProfileSnapshot, MediaSnapshot } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Posts/Reels"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function MediaTypeBadge({ type }: { type: string }) {
  const styles: Record<string, React.CSSProperties> = {
    REEL:     { background: "#F3E8FF", color: "#7E22CE", fontWeight: 600 },
    IMAGE:    { background: "#DBEAFE", color: "#1D4ED8", fontWeight: 600 },
    VIDEO:    { background: "#DCFCE7", color: "#15803D", fontWeight: 600 },
    CAROUSEL: { background: "#FEF3C7", color: "#B45309", fontWeight: 600 },
    STORY:    { background: "#F1F5F9", color: "#475569", fontWeight: 600 },
  };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs"
      style={styles[type] ?? { background: "#F1F5F9", color: "#64748B" }}
    >
      {type}
    </span>
  );
}

function EngRateBadge({ likes, comments, reach }: { likes: number; comments: number; reach: number }) {
  if (!reach) return <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>;
  const rate = ((likes + comments) / reach) * 100;
  let style: React.CSSProperties;
  if (rate >= 5) {
    style = { color: "#15803D", fontWeight: 600 };
  } else if (rate >= 2) {
    style = { color: "#A16207", fontWeight: 600 };
  } else {
    style = { color: "#B91C1C", fontWeight: 600 };
  }
  return (
    <span className="text-xs tabular-nums" style={style}>
      {rate.toFixed(1)}%
    </span>
  );
}

// SVG icons
const IconUsers = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconTrending = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const IconEye = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function InstagramPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [profileData, setProfileData] = useState<ProfileSnapshot[]>([]);
  const [media, setMedia] = useState<MediaSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [appliedStart, setAppliedStart] = useState(daysAgo(30));
  const [appliedEnd, setAppliedEnd] = useState(today());

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  useEffect(() => {
    fetch("/api/accounts?platform=instagram")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedId(accs[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);

    const params = new URLSearchParams({
      account_id: selectedId,
      start_date: `${appliedStart}T00:00:00`,
      end_date: `${appliedEnd}T23:59:59`,
    });

    Promise.all([
      fetch(`/api/instagram/profile?${params}`).then((r) => r.json()),
      fetch(`/api/instagram/media?account_id=${selectedId}&limit=100`).then((r) => r.json()),
    ])
      .then(([profile, med]) => {
        setProfileData(Array.isArray(profile) ? profile : []);
        setMedia(Array.isArray(med) ? med : []);
      })
      .finally(() => setLoading(false));
  }, [selectedId, appliedStart, appliedEnd]);

  const latest = profileData[profileData.length - 1];
  const previous = profileData[0]; // first point in the filtered period

  const filteredMedia = media.filter((m) => {
    if (!m.published_at) return true;
    const pub = new Date(m.published_at);
    return pub >= new Date(`${appliedStart}T00:00:00`) && pub <= new Date(`${appliedEnd}T23:59:59`);
  });

  function exportCsv() {
    const headers = "Tipo,Legenda,Curtidas,Comentarios,Alcance,Impressoes,Plays,Eng%,Publicado\n";
    const rows = filteredMedia
      .map((m) => {
        const eng = m.reach ? (((m.like_count + m.comments_count) / m.reach) * 100).toFixed(1) : "0";
        return `"${m.media_type}","${(m.caption ?? "").replace(/"/g, "''")}",${m.like_count},${m.comments_count},${m.reach},${m.impressions},${m.plays},${eng},"${m.published_at}"`;
      })
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "instagram_media.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--color-text-muted)" }}>
        <p className="text-lg mb-2">Nenhuma conta Instagram cadastrada</p>
        <a href="/dashboard/settings" style={{ color: "var(--color-primary)" }} className="text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="px-8 pt-8 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--color-text)" }}>Instagram</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Métricas de perfil e conteúdo</p>
      </div>

      {/* Account + section tabs */}
      <div className="px-8 pt-4">
        <AccountTabs
          accounts={accounts}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setSelectedSection("Visão Geral");
          }}
        />
      </div>

      {/* Date range filter */}
      <div className="px-8 pt-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>De:</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Até:</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={applyDateFilter}
          className="px-4 py-1.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          Aplicar
        </button>
      </div>

      <div className="px-8 pt-4">
        <SectionTabs
          sections={SECTIONS}
          selected={selectedSection}
          onSelect={setSelectedSection}
        />
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* === VISÃO GERAL === */}
        {selectedSection === "Visão Geral" && (
          <>
            {loading ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard
                    title="Seguidores"
                    value={latest?.followers_count ?? 0}
                    format="compact"
                    previousValue={previous?.followers_count}
                    currentValue={latest?.followers_count}
                    icon={IconUsers}
                    accentColor="#E1306C"
                    sparklineData={profileData.map((d) => d.followers_count)}
                  />
                  <KpiCard
                    title="Alcance (28d)"
                    value={latest?.reach ?? 0}
                    format="compact"
                    previousValue={previous?.reach}
                    currentValue={latest?.reach}
                    icon={IconTrending}
                    accentColor="#F97316"
                    sparklineData={profileData.map((d) => d.reach)}
                  />
                  <KpiCard
                    title="Impressões (28d)"
                    value={latest?.impressions ?? 0}
                    format="compact"
                    previousValue={previous?.impressions}
                    currentValue={latest?.impressions}
                    icon={IconEye}
                    accentColor="#8B5CF6"
                    sparklineData={profileData.map((d) => d.impressions)}
                  />
                </div>

                {/* Temporal chart */}
                {profileData.length > 1 ? (
                  <LineChart
                    data={profileData}
                    xKey="collected_at"
                    lines={[
                      { key: "followers_count", color: "#E1306C", label: "Seguidores" },
                      { key: "reach", color: "#F97316", label: "Alcance" },
                      { key: "impressions", color: "#8B5CF6", label: "Impressões" },
                    ]}
                    height={280}
                    title="Evolução do Perfil"
                    subtitle="Seguidores, alcance e impressões no período selecionado"
                    hideRangeSelector={true}
                  />
                ) : (
                  <div
                    className="rounded-[10px] p-8 text-center text-sm"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", boxShadow: "var(--shadow-card)", background: "white" }}
                  >
                    Dados insuficientes para o gráfico. Execute o cron pelo menos 2 vezes.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === POSTS/REELS === */}
        {selectedSection === "Posts/Reels" && (
          <>
            {loading ? (
              <SkeletonTable />
            ) : (
              <DataTable
                data={filteredMedia}
                columns={[
                  {
                    key: "media_type",
                    label: "Tipo",
                    render: (v) => <MediaTypeBadge type={v as string} />,
                  },
                  {
                    key: "caption",
                    label: "Legenda",
                    render: (v) => (
                      <span
                        className="text-sm line-clamp-2"
                        style={{ maxWidth: 200, display: "block", color: "var(--color-text-muted)" }}
                      >
                        {(v as string) || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "like_count",
                    label: "Curtidas",
                    render: (v) => (
                      <span className="text-sm tabular-nums">{formatCompact(v as number)}</span>
                    ),
                  },
                  {
                    key: "comments_count",
                    label: "Comentários",
                    render: (v) => (
                      <span className="text-sm tabular-nums">{formatCompact(v as number)}</span>
                    ),
                  },
                  {
                    key: "reach",
                    label: "Alcance",
                    render: (v) => (
                      <span className="text-sm tabular-nums">{formatCompact(v as number)}</span>
                    ),
                  },
                  {
                    key: "plays",
                    label: "Plays",
                    render: (v) => (
                      <span className="text-sm tabular-nums">{formatCompact(v as number)}</span>
                    ),
                  },
                  {
                    key: "impressions",
                    label: "Eng. Rate",
                    render: (_, row) => (
                      <EngRateBadge
                        likes={row.like_count as number}
                        comments={row.comments_count as number}
                        reach={row.reach as number}
                      />
                    ),
                  },
                  {
                    key: "published_at",
                    label: "Publicado",
                    render: (v) =>
                      v ? (
                        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                          {new Date(v as string).toLocaleDateString("pt-BR")}
                        </span>
                      ) : "—",
                  },
                ]}
                onExportCsv={exportCsv}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
