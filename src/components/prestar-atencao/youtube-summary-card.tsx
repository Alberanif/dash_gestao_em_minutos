"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import type { Account, ChannelDailyRow } from "@/types/accounts";

interface YouTubeSummaryCardProps {
  accountId: string;
  accounts: Account[];
  startDate: string;
  endDate: string;
  onSelectAccount: (id: string) => void;
}

interface VideoData {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string;
  duration: string;
  total_views: number;
  total_watch_min: number;
  avg_view_percentage: number;
  avg_view_duration: number;
  total_likes: number;
  total_comments: number;
}

export function YouTubeSummaryCard({
  accountId,
  accounts,
  startDate,
  endDate,
  onSelectAccount,
}: YouTubeSummaryCardProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChannelDailyRow[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);

  useEffect(() => {
    if (!accountId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [channelRes, videosRes] = await Promise.all([
          fetch(
            `/api/youtube/channel?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}`
          ),
          fetch(
            `/api/youtube/videos?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}`
          ),
        ]);

        if (channelRes.ok) {
          const result = await channelRes.json();
          setData(result);
        }

        if (videosRes.ok) {
          const result = await videosRes.json();
          setVideos(result);
        }
      } catch (error) {
        console.error("Erro ao buscar dados do YouTube:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accountId, startDate, endDate]);

  const ytAccounts = accounts.filter((a) => a.platform === "youtube");
  const selectedAccount = ytAccounts.find((a) => a.id === accountId);

  // Cálculos
  const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
  const avgRetention = data.length > 0 ? data.reduce((sum, row) => sum + (row.average_view_percentage || 0), 0) / data.length : 0;
  const avgDuration = data.length > 0 ? data.reduce((sum, row) => sum + (row.average_view_duration || 0), 0) / data.length : 0;
  const totalViews = data.reduce((sum, row) => sum + (row.views || 0), 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Data indisponível";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Data indisponível";
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "20px",
      }}
    >
      {ytAccounts.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <AccountTabs accounts={ytAccounts} selectedId={accountId} onSelect={onSelectAccount} />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KpiCard
              title="Impressões Totais"
              value={totalImpressions.toLocaleString("pt-BR")}
              format="compact"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
              accentColor="#3b82f6"
            />
            <KpiCard
              title="Retenção Média"
              value={`${avgRetention.toFixed(2)}%`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
              }
              accentColor="#10b981"
            />
            <KpiCard
              title="Tempo de Sessão Médio"
              value={formatDuration(avgDuration)}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
              accentColor="#f59e0b"
            />
            <KpiCard
              title="Visualizações Totais de Vídeos"
              value={totalViews.toLocaleString("pt-BR")}
              format="compact"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
              accentColor="#8b5cf6"
            />
          </div>

          {videos.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 600,
                marginBottom: "12px",
                color: "var(--color-text)",
              }}
            >
              Top 5 Vídeos
            </h3>
            <div className="space-y-2">
              {videos.slice(0, 5).map((video, index) => (
                <div
                  key={video.video_id}
                  style={{
                    padding: "12px",
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                    <div>
                      <p style={{ margin: "0 0 4px 0", color: "var(--color-text-muted)", fontSize: "12px" }}>
                        {formatDate(video.published_at || "")}
                      </p>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>
                        {video.title}
                      </p>
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "var(--color-primary)",
                        color: "white",
                        fontSize: "11px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      #{index + 1}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", fontSize: "12px" }}>
                    <div>
                      <p style={{ margin: "0 0 2px 0", color: "var(--color-text-muted)" }}>Visualizações</p>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>
                        {video.total_views.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px 0", color: "var(--color-text-muted)" }}>Likes</p>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>
                        {video.total_likes.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px 0", color: "var(--color-text-muted)" }}>Comentários</p>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>
                        {video.total_comments.toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

          {!loading && videos.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "20px 0" }}>
              Nenhum vídeo encontrado no período selecionado
            </p>
          )}
        </div>
      )}
    </div>
  );
}
