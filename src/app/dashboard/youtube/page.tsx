"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";
import type { Account, ChannelSnapshot, VideoSnapshot } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Vídeos"];

function parseIsoDuration(iso: string): string {
  if (!iso) return "—";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] ?? "0");
  const min = parseInt(m[2] ?? "0");
  const sec = parseInt(m[3] ?? "0");
  if (h > 0) {
    return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function parseIsoDurationToSeconds(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0");
  const min = parseInt(m[2] ?? "0");
  const sec = parseInt(m[3] ?? "0");
  return h * 3600 + min * 60 + sec;
}

function formatSeconds(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function calcRetentionMetrics(videos: VideoSnapshot[]) {
  const withViews = videos.filter((v) => v.view_count > 0);
  if (withViews.length === 0) {
    return { retencao: 0, engajamento: 0, taxaComentarios: 0, duracaoMedia: "—" };
  }
  const retencao =
    withViews.reduce((sum, v) => sum + v.like_count / v.view_count, 0) / withViews.length;
  const engajamento =
    withViews.reduce((sum, v) => sum + (v.like_count + v.comment_count) / v.view_count, 0) /
    withViews.length;
  const taxaComentarios =
    withViews.reduce((sum, v) => sum + v.comment_count / v.view_count, 0) / withViews.length;
  const withDuration = videos.filter((v) => v.duration);
  const duracaoMedia =
    withDuration.length > 0
      ? formatSeconds(
          withDuration.reduce((sum, v) => sum + parseIsoDurationToSeconds(v.duration), 0) /
            withDuration.length
        )
      : "—";
  return { retencao, engajamento, taxaComentarios, duracaoMedia };
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function EngagementBadge({ views, likes, comments }: { views: number; likes: number; comments: number }) {
  if (!views) return <span className="text-xs text-gray-400">—</span>;
  const rate = ((likes + comments) / views) * 100;
  let label: string;
  let style: React.CSSProperties;
  if (rate >= 5) {
    label = "Alto";
    style = { background: "#DCFCE7", color: "#15803D", fontWeight: 600 };
  } else if (rate >= 2) {
    label = "Médio";
    style = { background: "#FEF9C3", color: "#A16207", fontWeight: 600 };
  } else {
    label = "Baixo";
    style = { background: "#FEE2E2", color: "#B91C1C", fontWeight: 600 };
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="px-2 py-0.5 rounded-full text-xs" style={style}>
        {label}
      </span>
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {rate.toFixed(1)}%
      </span>
    </div>
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

const IconEye = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconVideo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
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

const IconMessageSquare = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconClock = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export default function YouTubePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [channelData, setChannelData] = useState<ChannelSnapshot[]>([]);
  const [videos, setVideos] = useState<VideoSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

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
    Promise.all([
      fetch(`/api/youtube/channel?account_id=${selectedId}&days=90`).then((r) => r.json()),
      fetch(`/api/youtube/videos?account_id=${selectedId}&limit=100`).then((r) => r.json()),
    ])
      .then(([channel, vids]) => {
        setChannelData(Array.isArray(channel) ? channel : []);
        setVideos(Array.isArray(vids) ? vids : []);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const latest = channelData[channelData.length - 1];
  const previous = channelData[channelData.length - 2];

  function exportCsv() {
    const headers = "Titulo,Views,Likes,Comentarios,Engajamento%,Duracao,Publicado\n";
    const rows = videos
      .map((v) => {
        const eng = v.view_count ? (((v.like_count + v.comment_count) / v.view_count) * 100).toFixed(1) : "0";
        return `"${v.title}",${v.view_count},${v.like_count},${v.comment_count},${eng},"${parseIsoDuration(v.duration)}","${v.published_at}"`;
      })
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
      {/* Page header */}
      <div className="px-8 pt-8 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--color-text)" }}>YouTube</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Métricas e desempenho do canal</p>
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
                    title="Inscritos"
                    value={latest?.subscriber_count ?? 0}
                    format="compact"
                    previousValue={previous?.subscriber_count}
                    currentValue={latest?.subscriber_count}
                    icon={IconUsers}
                    accentColor="#2563EB"
                    sparklineData={channelData.map((d) => d.subscriber_count)}
                  />
                  <KpiCard
                    title="Views Totais"
                    value={latest?.view_count ?? 0}
                    format="compact"
                    previousValue={previous?.view_count}
                    currentValue={latest?.view_count}
                    icon={IconEye}
                    accentColor="#7C3AED"
                    sparklineData={channelData.map((d) => d.view_count)}
                  />
                  <KpiCard
                    title="Vídeos"
                    value={latest?.video_count ?? 0}
                    previousValue={previous?.video_count}
                    currentValue={latest?.video_count}
                    icon={IconVideo}
                    accentColor="#0EA5E9"
                    sparklineData={channelData.map((d) => d.video_count)}
                  />
                </div>

                {/* Temporal chart */}
                {channelData.length > 1 ? (
                  <LineChart
                    data={channelData}
                    xKey="collected_at"
                    lines={[
                      { key: "subscriber_count", color: "#2563EB", label: "Inscritos" },
                      { key: "view_count", color: "#7C3AED", label: "Views Totais" },
                    ]}
                    height={280}
                    title="Evolução do Canal"
                    subtitle="Inscritos e views ao longo do tempo"
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

        {/* === VÍDEOS === */}
        {selectedSection === "Vídeos" && (
          <>
            {loading ? (
              <SkeletonTable />
            ) : (
              <DataTable
                data={videos}
                columns={[
                  {
                    key: "title",
                    label: "Título",
                    render: (_, row) => (
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <img
                          src={row.thumbnail_url as string}
                          alt=""
                          className="rounded flex-shrink-0 object-cover"
                          style={{ width: 72, height: 40 }}
                          loading="lazy"
                        />
                        <span className="text-sm font-medium line-clamp-2" style={{ color: "var(--color-text)" }}>
                          {row.title as string}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "view_count",
                    label: "Views",
                    render: (v) => (
                      <span className="text-sm font-medium tabular-nums">{formatCompact(v as number)}</span>
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
                    key: "comment_count",
                    label: "Comentários",
                    render: (v) => (
                      <span className="text-sm tabular-nums">{formatCompact(v as number)}</span>
                    ),
                  },
                  {
                    key: "duration",
                    label: "Engajamento",
                    render: (_, row) => (
                      <EngagementBadge
                        views={row.view_count as number}
                        likes={row.like_count as number}
                        comments={row.comment_count as number}
                      />
                    ),
                  },
                  {
                    key: "published_at",
                    label: "Duração",
                    render: (_, row) => (
                      <span className="text-sm font-mono tabular-nums">{parseIsoDuration(row.duration as string)}</span>
                    ),
                  },
                  {
                    key: "thumbnail_url",
                    label: "Publicado",
                    render: (_, row) =>
                      row.published_at ? (
                        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                          {new Date(row.published_at as string).toLocaleDateString("pt-BR")}
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
