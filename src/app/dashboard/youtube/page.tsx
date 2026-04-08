// src/app/dashboard/youtube/page.tsx
"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";
import type { Account, ChannelDailyRow, VideoAggregated } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Vídeos"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseIsoDuration(iso: string): string {
  if (!iso) return "—";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] ?? "0");
  const min = parseInt(m[2] ?? "0");
  const sec = parseInt(m[3] ?? "0");
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

// SVG icons (unchanged from original)
const IconUsers = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconEye = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconVideo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);
const IconThumbUp = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);
const IconActivity = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconClock = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconTrendingUp = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);

interface ChannelStats {
  subscriber_count: number;
  video_count: number;
}

export default function YouTubePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [channelData, setChannelData] = useState<ChannelDailyRow[]>([]);
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [videos, setVideos] = useState<VideoAggregated[]>([]);
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
    fetch("/api/accounts?platform=youtube")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedId(accs[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setChannelData([]);
    setChannelStats(null);
    setVideos([]);

    const params = new URLSearchParams({
      account_id: selectedId,
      start_date: appliedStart,
      end_date: appliedEnd,
    });

    Promise.all([
      fetch(`/api/youtube/channel?${params}`).then((r) => r.json()),
      fetch(`/api/youtube/stats?account_id=${selectedId}`).then((r) => r.json()),
      fetch(`/api/youtube/videos?${params}`).then((r) => r.json()),
    ])
      .then(([daily, stats, vids]) => {
        setChannelData(Array.isArray(daily) ? daily : []);
        setChannelStats(stats?.subscriber_count != null ? stats : null);
        setVideos(Array.isArray(vids) ? vids : []);
      })
      .finally(() => setLoading(false));
  }, [selectedId, appliedStart, appliedEnd]);

  // Aggregate period metrics from daily rows
  const periodViews = channelData.reduce((s, d) => s + d.views, 0);
  const periodWatchMin = channelData.reduce((s, d) => s + d.estimated_minutes_watched, 0);
  const netSubsChange = channelData.reduce(
    (s, d) => s + d.subscribers_gained - d.subscribers_lost,
    0
  );
  const avgRetention =
    channelData.length > 0
      ? channelData.reduce((s, d) => s + d.average_view_percentage, 0) / channelData.length
      : 0;
  const avgViewDuration =
    channelData.length > 0
      ? channelData.reduce((s, d) => s + d.average_view_duration, 0) / channelData.length
      : 0;

  function exportCsv() {
    const headers = "Titulo,Views,RetencaoMedia%,DuracaoMediaVis,WatchMin,Likes,Comentarios,Publicado\n";
    const rows = videos
      .map((v) =>
        [
          `"${v.title}"`,
          v.total_views,
          v.avg_view_percentage.toFixed(2),
          `"${formatSeconds(v.avg_view_duration)}"`,
          v.total_watch_min,
          v.total_likes,
          v.total_comments,
          `"${v.published_at}"`,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youtube_videos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--color-text-muted)" }}>
        <p className="text-lg mb-2">Nenhuma conta YouTube cadastrada</p>
        <a href="/dashboard/settings" style={{ color: "var(--color-primary)" }} className="text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-8 pt-8 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--color-text)" }}>YouTube</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Métricas e desempenho do canal</p>
      </div>

      {/* Account tabs */}
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

      {/* Section tabs */}
      <div className="px-8 pt-4">
        <SectionTabs sections={SECTIONS} selected={selectedSection} onSelect={setSelectedSection} />
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                {/* Primary KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard
                    title="Inscritos (Total)"
                    value={channelStats?.subscriber_count ?? 0}
                    format="compact"
                    icon={IconUsers}
                    accentColor="#2563EB"
                  />
                  <KpiCard
                    title="Views no Período"
                    value={periodViews}
                    format="compact"
                    icon={IconEye}
                    accentColor="#7C3AED"
                    sparklineData={channelData.map((d) => d.views)}
                  />
                  <KpiCard
                    title="Watch Time (min)"
                    value={formatCompact(periodWatchMin)}
                    icon={IconVideo}
                    accentColor="#0EA5E9"
                    sparklineData={channelData.map((d) => d.estimated_minutes_watched)}
                  />
                </div>

                {/* Secondary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard
                    title="Retenção Média"
                    value={`${avgRetention.toFixed(2)}%`}
                    icon={IconThumbUp}
                    accentColor="#16A34A"
                  />
                  <KpiCard
                    title="Duração Média Vis."
                    value={formatSeconds(avgViewDuration)}
                    icon={IconClock}
                    accentColor="#0EA5E9"
                  />
                  <KpiCard
                    title="Inscritos Ganhos"
                    value={netSubsChange >= 0 ? `+${formatCompact(netSubsChange)}` : formatCompact(netSubsChange)}
                    icon={IconTrendingUp}
                    accentColor={netSubsChange >= 0 ? "#16A34A" : "#DC2626"}
                  />
                  <KpiCard
                    title="Vídeos Publicados"
                    value={channelStats?.video_count ?? 0}
                    icon={IconVideo}
                    accentColor="#D97706"
                  />
                </div>

                {/* Chart */}
                {channelData.length > 1 ? (
                  <LineChart
                    data={channelData}
                    xKey="date"
                    lines={[
                      { key: "views", color: "#2563EB", label: "Views" },
                      { key: "estimated_minutes_watched", color: "#7C3AED", label: "Watch Time (min)" },
                    ]}
                    height={280}
                    title="Evolução Diária do Canal"
                    subtitle="Views e watch time no período selecionado"
                    hideRangeSelector={true}
                  />
                ) : (
                  <div
                    className="rounded-[10px] p-8 text-center text-sm"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "white" }}
                  >
                    Sem dados para o período. Execute a sincronização no painel Dados.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === VÍDEOS === */}
        {selectedSection === "Vídeos" && (
          <>
            {loading ? (
              <SkeletonTable />
            ) : (
              <DataTable<VideoAggregated>
                data={videos}
                columns={[
                  {
                    key: "title",
                    label: "Título",
                    render: (_, row) => (
                      <div className="flex items-center gap-3 min-w-[220px]">
                        {row.thumbnail_url && (
                          <img
                            src={row.thumbnail_url as string}
                            alt=""
                            className="rounded flex-shrink-0 object-cover"
                            style={{ width: 72, height: 40 }}
                            loading="lazy"
                          />
                        )}
                        <span className="text-sm font-medium line-clamp-2" style={{ color: "var(--color-text)" }}>
                          {row.title as string}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "total_views",
                    label: "Views",
                    render: (v) => (
                      <span className="text-sm font-medium tabular-nums">
                        {formatCompact(v as number)}
                      </span>
                    ),
                  },
                  {
                    key: "avg_view_percentage",
                    label: "Retenção",
                    render: (v) => (
                      <span className="text-sm tabular-nums font-medium" style={{ color: "var(--color-text)" }}>
                        {(v as number).toFixed(1)}%
                      </span>
                    ),
                  },
                  {
                    key: "avg_view_duration",
                    label: "Duração Média Vis.",
                    render: (v) => (
                      <span className="text-sm font-mono tabular-nums">
                        {formatSeconds(v as number)}
                      </span>
                    ),
                  },
                  {
                    key: "total_watch_min",
                    label: "Watch Time (min)",
                    render: (v) => (
                      <span className="text-sm tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                        {formatCompact(v as number)}
                      </span>
                    ),
                  },
                  {
                    key: "total_likes",
                    label: "Likes",
                    render: (v) => (
                      <span className="text-sm tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                        {formatCompact(v as number)}
                      </span>
                    ),
                  },
                  {
                    key: "duration",
                    label: "Duração",
                    render: (v) => (
                      <span className="text-sm font-mono tabular-nums">
                        {parseIsoDuration(v as string)}
                      </span>
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
