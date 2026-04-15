"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangeControls } from "@/components/layout/date-range-controls";
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

const IconUsers = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconEye = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconVideo = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);
const IconThumbUp = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);
const IconClock = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconTrendingUp = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);

interface ChannelStats {
  subscriber_count: number;
  video_count: number;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="surface-card rounded-[var(--radius-card)] p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
      {message}
    </div>
  );
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
    async function loadChannel() {
      setLoading(true);
      setChannelData([]);
      setChannelStats(null);
      setVideos([]);

      const params = new URLSearchParams({
        account_id: selectedId,
        start_date: appliedStart,
        end_date: appliedEnd,
      });

      try {
        const [daily, stats, vids] = await Promise.all([
          fetch(`/api/youtube/channel?${params}`).then((r) => r.json()),
          fetch(`/api/youtube/stats?account_id=${selectedId}`).then((r) => r.json()),
          fetch(`/api/youtube/videos?${params}`).then((r) => r.json()),
        ]);
        setChannelData(Array.isArray(daily) ? daily : []);
        setChannelStats(stats?.subscriber_count != null ? stats : null);
        setVideos(Array.isArray(vids) ? vids : []);
      } finally {
        setLoading(false);
      }
    }

    void loadChannel();
  }, [selectedId, appliedStart, appliedEnd]);

  const periodViews = channelData.reduce((s, d) => s + d.views, 0);
  const periodWatchMin = channelData.reduce((s, d) => s + d.estimated_minutes_watched, 0);
  const netSubsChange = channelData.reduce((s, d) => s + d.subscribers_gained - d.subscribers_lost, 0);
  const avgRetention = channelData.length > 0
    ? channelData.reduce((s, d) => s + d.average_view_percentage, 0) / channelData.length
    : 0;
  const avgViewDuration = channelData.length > 0
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
      <div className="flex h-64 flex-col items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
        <p className="mb-2 text-lg">Nenhuma conta YouTube cadastrada</p>
        <a href="/dashboard/settings" style={{ color: "var(--color-primary)" }} className="text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  const headerActions = (
    <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:flex-nowrap xl:items-center xl:justify-end">
      <div className="min-w-[220px]">
        <AccountTabs
          accounts={accounts}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setSelectedSection("Visão Geral");
          }}
        />
      </div>
      <DateRangeControls
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={applyDateFilter}
      />
    </div>
  );

  return (
    <div className="min-h-full">
      <PageHeader title="YouTube" subtitle="Análise de canal" actions={headerActions} />

      <div style={{ padding: "24px" }}>
        <SectionTabs sections={SECTIONS} selected={selectedSection} onSelect={setSelectedSection} />

        <div className="mt-6 space-y-6">
          {selectedSection === "Visão Geral" ? (
            loading ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard title="Inscritos" value={[...channelData].reverse().find((d) => d.subscriber_count > 0)?.subscriber_count ?? 0} format="compact" icon={IconUsers} sparklineData={channelData.map((d) => d.subscribers_gained - d.subscribers_lost)} />
                  <KpiCard title="Views no período" value={periodViews} format="compact" icon={IconEye} sparklineData={channelData.map((d) => d.views)} />
                  <KpiCard title="Watch time (min)" value={formatCompact(periodWatchMin)} icon={IconVideo} sparklineData={channelData.map((d) => d.estimated_minutes_watched)} />
                  <KpiCard title="Vídeos publicados" value={channelStats?.video_count ?? 0} icon={IconVideo} />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard title="Retenção média" value={`${avgRetention.toFixed(2)}%`} icon={IconThumbUp} />
                  <KpiCard title="Duração média" value={formatSeconds(avgViewDuration)} icon={IconClock} />
                  <KpiCard title="Saldo de inscritos" value={netSubsChange >= 0 ? `+${formatCompact(netSubsChange)}` : formatCompact(netSubsChange)} previousValue={0} currentValue={0} icon={IconTrendingUp} accentColor={netSubsChange >= 0 ? "#16A34A" : "#DC2626"} />
                  <KpiCard title="Dias com coleta" value={channelData.length} icon={IconClock} />
                </div>

                {channelData.length > 1 ? (
                  <LineChart
                    data={channelData}
                    xKey="date"
                    lines={[
                      { key: "views", color: "var(--color-primary)", label: "Views" },
                      { key: "estimated_minutes_watched", color: "#F5A623", label: "Watch Time (min)" },
                    ]}
                    height={320}
                    title="Evolução diária do canal"
                    subtitle="Performance consolidada do período selecionado"
                    hideRangeSelector
                  />
                ) : (
                  <EmptyState message="Sem dados para o período. Execute a sincronização no painel Dados." />
                )}
              </>
            )
          ) : loading ? (
            <SkeletonTable />
          ) : (
            <DataTable<VideoAggregated>
              data={videos}
              columns={[
                {
                  key: "title",
                  label: "Título",
                  render: (_, row) => (
                    <div className="flex min-w-[260px] items-center gap-3">
                      {row.thumbnail_url ? (
                        <img
                          src={row.thumbnail_url as string}
                          alt=""
                          className="flex-shrink-0 rounded object-cover"
                          style={{ width: 72, height: 40 }}
                          loading="lazy"
                        />
                      ) : null}
                      <span className="line-clamp-2 text-sm font-medium">{row.title as string}</span>
                    </div>
                  ),
                },
                { key: "total_views", label: "Views", render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span> },
                { key: "avg_view_percentage", label: "Retenção", render: (v) => <span className="tabular-nums">{(v as number).toFixed(1)}%</span> },
                { key: "avg_view_duration", label: "Duração média", render: (v) => <span className="tabular-nums">{formatSeconds(v as number)}</span> },
                { key: "total_watch_min", label: "Watch time", render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span> },
                { key: "total_likes", label: "Likes", render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span> },
                { key: "duration", label: "Duração", render: (v) => <span className="tabular-nums">{parseIsoDuration(v as string)}</span> },
                {
                  key: "published_at",
                  label: "Publicado",
                  render: (v) => v ? <span>{new Date(v as string).toLocaleDateString("pt-BR")}</span> : "—",
                },
              ]}
              onExportCsv={exportCsv}
            />
          )}
        </div>
      </div>
    </div>
  );
}
