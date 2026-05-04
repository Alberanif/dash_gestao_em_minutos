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

export function YouTubeSummaryCard({
  accountId,
  accounts,
  startDate,
  endDate,
  onSelectAccount,
}: YouTubeSummaryCardProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChannelDailyRow[]>([]);

  useEffect(() => {
    if (!accountId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/youtube/channel?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}`
        );
        if (response.ok) {
          const result = await response.json();
          setData(result);
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
  const validCtrRows = data.filter((row) => (row.ctr || 0) > 0);
  const avgCtr = validCtrRows.length > 0 ? validCtrRows.reduce((sum, row) => sum + row.ctr, 0) / validCtrRows.length : 0;
  const avgRetention = data.length > 0 ? data.reduce((sum, row) => sum + (row.average_view_percentage || 0), 0) / data.length : 0;
  const avgDuration = data.length > 0 ? data.reduce((sum, row) => sum + (row.average_view_duration || 0), 0) / data.length : 0;
  const totalViews = data.reduce((sum, row) => sum + (row.views || 0), 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <KpiCard
            title="CTR"
            value={avgCtr === 0 ? "—" : `${(avgCtr * 100).toFixed(2)}%`}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12c0 7 9 11 9 11s9-4 9-11-4-9-9-9-9 2-9 9z" />
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
      )}
    </div>
  );
}
