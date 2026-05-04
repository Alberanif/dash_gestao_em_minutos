"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import type { Account, MediaDailyRecord } from "@/types/accounts";

interface InstagramSummaryCardProps {
  accountId: string;
  accounts: Account[];
  startDate: string;
  endDate: string;
  onSelectAccount: (id: string) => void;
}

export function InstagramSummaryCard({
  accountId,
  accounts,
  startDate,
  endDate,
  onSelectAccount,
}: InstagramSummaryCardProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MediaDailyRecord[]>([]);

  useEffect(() => {
    if (!accountId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/instagram/media?account_id=${accountId}&sort_by=engagement_rate&limit=5&start_date=${startDate}&end_date=${endDate}`
        );
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Erro ao buscar dados do Instagram:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accountId, startDate, endDate]);

  const igAccounts = accounts.filter((a) => a.platform === "instagram");
  const selectedAccount = igAccounts.find((a) => a.id === accountId);

  // Cálculos
  const avgEngagement = data.length > 0
    ? data.reduce((sum, row) => sum + (row.engagement_rate || 0), 0) / data.length
    : 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const getMediaTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      IMAGE: "Imagem",
      VIDEO: "Vídeo",
      CAROUSEL: "Carrossel",
      REEL: "Reel",
      STORY: "Story",
    };
    return labels[type] || type;
  };

  const getMediaTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      IMAGE: "#60a5fa",
      VIDEO: "#8b5cf6",
      CAROUSEL: "#f59e0b",
      REEL: "#ec4899",
      STORY: "#14b8a6",
    };
    return colors[type] || "#6b7280";
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
      {igAccounts.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <AccountTabs accounts={igAccounts} selectedId={accountId} onSelect={onSelectAccount} />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-6">
          <KpiCard
            title="Engajamento Geral"
            value={`${avgEngagement.toFixed(2)}%`}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
            accentColor="#ec4899"
          />

          {data.length > 0 && (
            <div>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  marginBottom: "12px",
                  color: "var(--color-text)",
                }}
              >
                Top 5 Publicações
              </h3>
              <div className="space-y-2">
                {data.map((post) => (
                  <div
                    key={post.media_id}
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
                          {formatDate(post.published_at || "")}
                        </p>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: getMediaTypeColor(post.media_type),
                            color: "white",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          {getMediaTypeLabel(post.media_type)}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--color-primary)" }}>
                        {post.engagement_rate.toFixed(2)}%
                      </p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", fontSize: "12px" }}>
                      <div>
                        <p style={{ margin: "0 0 2px 0", color: "var(--color-text-muted)" }}>Likes</p>
                        <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>{post.like_count.toLocaleString("pt-BR")}</p>
                      </div>
                      <div>
                        <p style={{ margin: "0 0 2px 0", color: "var(--color-text-muted)" }}>Comentários</p>
                        <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>{post.comments_count.toLocaleString("pt-BR")}</p>
                      </div>
                      <div>
                        <p style={{ margin: "0 0 2px 0", color: "var(--color-text-muted)" }}>Compartilhamentos</p>
                        <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>{post.shares.toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && data.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "20px 0" }}>
              Nenhum post encontrado no período selecionado
            </p>
          )}
        </div>
      )}
    </div>
  );
}
