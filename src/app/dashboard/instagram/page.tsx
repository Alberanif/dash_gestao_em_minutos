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
import { StatusBadge } from "@/components/ui/status-badge";
import type { Account, MediaSnapshot, ProfileSnapshot } from "@/types/accounts";

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
  const tones: Record<string, { tone: "analysis" | "active" | "approved" | "pending" | "blocked"; label: string }> = {
    REEL: { tone: "analysis", label: "Reel" },
    IMAGE: { tone: "active", label: "Imagem" },
    VIDEO: { tone: "approved", label: "Vídeo" },
    CAROUSEL: { tone: "pending", label: "Carrossel" },
    STORY: { tone: "blocked", label: "Story" },
  };
  const config = tones[type] ?? { tone: "blocked" as const, label: type };
  return <StatusBadge tone={config.tone} label={config.label} />;
}

function EngRateBadge({ likes, comments, reach }: { likes: number; comments: number; reach: number }) {
  if (!reach) return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
  const rate = ((likes + comments) / reach) * 100;
  if (rate >= 5) return <StatusBadge tone="approved" label={`${rate.toFixed(1)}%`} />;
  if (rate >= 2) return <StatusBadge tone="pending" label={`${rate.toFixed(1)}%`} />;
  return <StatusBadge tone="cancelled" label={`${rate.toFixed(1)}%`} />;
}

const IconUsers = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconTrending = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconEye = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconHeart = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

function EmptyState({ message }: { message: string }) {
  return (
    <div className="surface-card rounded-[var(--radius-card)] p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
      {message}
    </div>
  );
}

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
    async function loadInstagram() {
      setLoading(true);

      const params = new URLSearchParams({
        account_id: selectedId,
        start_date: `${appliedStart}T00:00:00`,
        end_date: `${appliedEnd}T23:59:59`,
      });

      try {
        const [profile, med] = await Promise.all([
          fetch(`/api/instagram/profile?${params}`).then((r) => r.json()),
          fetch(`/api/instagram/media?account_id=${selectedId}&limit=100`).then((r) => r.json()),
        ]);
        setProfileData(Array.isArray(profile) ? profile : []);
        setMedia(Array.isArray(med) ? med : []);
      } finally {
        setLoading(false);
      }
    }

    void loadInstagram();
  }, [selectedId, appliedStart, appliedEnd]);

  const latest = profileData[profileData.length - 1];
  const previous = profileData[0];

  const filteredMedia = media.filter((m) => {
    if (!m.published_at) return true;
    const pub = new Date(m.published_at);
    return pub >= new Date(`${appliedStart}T00:00:00`) && pub <= new Date(`${appliedEnd}T23:59:59`);
  });

  const totalInteractions = filteredMedia.reduce((sum, item) => sum + item.like_count + item.comments_count, 0);

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
      <div className="flex h-64 flex-col items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
        <p className="mb-2 text-lg">Nenhuma conta Instagram cadastrada</p>
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
      <PageHeader title="Instagram" subtitle="Análise de perfil" actions={headerActions} />

      <div style={{ padding: "24px" }}>
        <SectionTabs sections={SECTIONS} selected={selectedSection} onSelect={setSelectedSection} />

        <div className="mt-6 space-y-6">
          {selectedSection === "Visão Geral" ? (
            loading ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard title="Seguidores" value={latest?.followers_count ?? 0} format="compact" previousValue={previous?.followers_count} currentValue={latest?.followers_count} icon={IconUsers} sparklineData={profileData.map((d) => d.followers_count)} />
                  <KpiCard title="Alcance" value={latest?.reach ?? 0} format="compact" previousValue={previous?.reach} currentValue={latest?.reach} icon={IconTrending} sparklineData={profileData.map((d) => d.reach)} />
                  <KpiCard title="Impressões" value={latest?.impressions ?? 0} format="compact" previousValue={previous?.impressions} currentValue={latest?.impressions} icon={IconEye} sparklineData={profileData.map((d) => d.impressions)} />
                  <KpiCard title="Interações" value={formatCompact(totalInteractions)} icon={IconHeart} />
                </div>

                {profileData.length > 1 ? (
                  <LineChart
                    data={profileData}
                    xKey="collected_at"
                    lines={[
                      { key: "followers_count", color: "var(--color-primary)", label: "Seguidores" },
                      { key: "reach", color: "#F5A623", label: "Alcance" },
                      { key: "impressions", color: "#16A34A", label: "Impressões" },
                    ]}
                    height={320}
                    title="Evolução do perfil"
                    subtitle="Seguidores, alcance e impressões ao longo do período"
                    hideRangeSelector
                  />
                ) : (
                  <EmptyState message="Dados insuficientes para o gráfico. Execute o cron pelo menos duas vezes." />
                )}
              </>
            )
          ) : loading ? (
            <SkeletonTable />
          ) : (
            <DataTable
              data={filteredMedia}
              columns={[
                { key: "media_type", label: "Tipo", render: (v) => <MediaTypeBadge type={v as string} /> },
                {
                  key: "caption",
                  label: "Legenda",
                  render: (v) => (
                    <span className="line-clamp-2 block max-w-[260px]" style={{ color: "var(--color-text-muted)" }}>
                      {(v as string) || "—"}
                    </span>
                  ),
                },
                { key: "like_count", label: "Curtidas", render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span> },
                { key: "comments_count", label: "Comentários", render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span> },
                { key: "reach", label: "Alcance", render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span> },
                { key: "plays", label: "Plays", render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span> },
                {
                  key: "impressions",
                  label: "Eng. Rate",
                  render: (_, row) => (
                    <EngRateBadge likes={row.like_count as number} comments={row.comments_count as number} reach={row.reach as number} />
                  ),
                },
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
