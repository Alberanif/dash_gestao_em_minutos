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
import type { Account, MetaAdsDailyRow, MetaAdsCampaign } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Campanhas"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(n);
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function CampaignStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <StatusBadge tone="success" label="Ativa" />;
  if (status === "PAUSED") return <StatusBadge tone="pending" label="Pausada" />;
  if (status === "ARCHIVED") return <StatusBadge tone="blocked" label="Arquivada" />;
  return <StatusBadge tone="blocked" label={status || "—"} />;
}

const IconMoney = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconEye = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconClick = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const IconTrending = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

function EmptyState({ message }: { message: string }) {
  return (
    <div className="surface-card rounded-[var(--radius-card)] p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
      {message}
    </div>
  );
}

export default function MetaAdsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [daily, setDaily] = useState<MetaAdsDailyRow[]>([]);
  const [campaigns, setCampaigns] = useState<MetaAdsCampaign[]>([]);
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
    fetch("/api/accounts?platform=meta-ads")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        const list = Array.isArray(accs) ? accs : [];
        setAccounts(list);
        if (list.length > 0) setSelectedId(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    async function loadData() {
      setLoading(true);
      const params = new URLSearchParams({
        account_id: selectedId,
        start_date: appliedStart,
        end_date: appliedEnd,
      });

      try {
        const [dailyRes, campaignsRes] = await Promise.all([
          fetch(`/api/meta-ads/insights?${params}`).then((r) => r.json()),
          fetch(`/api/meta-ads/campaigns?${params}`).then((r) => r.json()),
        ]);
        setDaily(Array.isArray(dailyRes) ? dailyRes : []);
        setCampaigns(Array.isArray(campaignsRes) ? campaignsRes : []);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [selectedId, appliedStart, appliedEnd]);

  // KPIs agregados do período
  const totalSpend = daily.reduce((s, d) => s + d.spend, 0);
  const totalImpressions = daily.reduce((s, d) => s + d.impressions, 0);
  const totalClicks = daily.reduce((s, d) => s + d.clicks, 0);
  const totalConversionValue = daily.reduce((s, d) => s + d.conversion_value, 0);

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const roas = totalSpend > 0 ? totalConversionValue / totalSpend : 0;

  // Delta: compara primeira metade vs segunda metade do período
  const mid = Math.floor(daily.length / 2);
  const firstHalf = daily.slice(0, mid);
  const secondHalf = daily.slice(mid);

  const prevSpend = firstHalf.reduce((s, d) => s + d.spend, 0);
  const prevImpressions = firstHalf.reduce((s, d) => s + d.impressions, 0);
  const prevClicks = firstHalf.reduce((s, d) => s + d.clicks, 0);
  const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;

  const currSpend = secondHalf.reduce((s, d) => s + d.spend, 0);
  const currImpressions = secondHalf.reduce((s, d) => s + d.impressions, 0);
  const currClicks = secondHalf.reduce((s, d) => s + d.clicks, 0);
  const currCtr = currImpressions > 0 ? (currClicks / currImpressions) * 100 : 0;

  function exportCsv() {
    const headers = "Campanha,Status,Gasto,Impressoes,Alcance,Cliques,CTR,CPC,Conversoes\n";
    const rows = campaigns
      .map((c) =>
        `"${c.campaign_name}","${c.status}",${c.spend.toFixed(2)},${c.impressions},${c.reach},${c.clicks},${c.ctr.toFixed(2)},${c.cpc.toFixed(2)},${c.conversions}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meta_ads_campanhas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
        <p className="mb-2 text-lg">Nenhuma conta Meta Ads cadastrada</p>
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
      <PageHeader title="Meta Ads" subtitle="Performance de campanhas e anúncios" actions={headerActions} />

      <div style={{ padding: "24px" }}>
        <SectionTabs sections={SECTIONS} selected={selectedSection} onSelect={setSelectedSection} />

        <div className="mt-6 space-y-6">
          {selectedSection === "Visão Geral" ? (
            loading ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                {/* KPIs principais */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    title="Gasto Total"
                    value={formatBRL(totalSpend)}
                    previousValue={prevSpend}
                    currentValue={currSpend}
                    icon={IconMoney}
                    sparklineData={daily.map((d) => d.spend)}
                  />
                  <KpiCard
                    title="Impressões"
                    value={totalImpressions}
                    format="compact"
                    previousValue={prevImpressions}
                    currentValue={currImpressions}
                    icon={IconEye}
                    sparklineData={daily.map((d) => d.impressions)}
                  />
                  <KpiCard
                    title="Cliques"
                    value={totalClicks}
                    format="compact"
                    previousValue={prevClicks}
                    currentValue={currClicks}
                    icon={IconClick}
                    sparklineData={daily.map((d) => d.clicks)}
                  />
                  <KpiCard
                    title="CTR"
                    value={`${avgCtr.toFixed(2)}%`}
                    previousValue={prevCtr}
                    currentValue={currCtr}
                    icon={IconTrending}
                    sparklineData={daily.map((d) => d.ctr)}
                  />
                </div>

                {/* KPIs secundários */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <KpiCard title="CPC" value={formatBRL(avgCpc)} icon={IconMoney} />
                  <KpiCard title="CPM" value={formatBRL(avgCpm)} icon={IconEye} />
                  <KpiCard
                    title="ROAS"
                    value={roas > 0 ? `${roas.toFixed(2)}x` : "—"}
                    icon={IconTrending}
                  />
                </div>

                {/* Gráfico de gasto diário */}
                {daily.length > 1 ? (
                  <LineChart
                    data={daily}
                    xKey="date"
                    lines={[
                      { key: "spend", color: "var(--color-primary)", label: "Gasto (R$)" },
                      { key: "clicks", color: "#F5A623", label: "Cliques" },
                    ]}
                    height={320}
                    title="Gasto diário"
                    subtitle="Investimento e cliques ao longo do período"
                    hideRangeSelector
                  />
                ) : (
                  <EmptyState message="Dados insuficientes para o gráfico. Execute a coleta de dados para este período." />
                )}
              </>
            )
          ) : loading ? (
            <SkeletonTable />
          ) : campaigns.length === 0 ? (
            <EmptyState message="Nenhuma campanha encontrada para o período selecionado." />
          ) : (
            <DataTable
              data={campaigns}
              columns={[
                {
                  key: "campaign_name",
                  label: "Campanha",
                  render: (v) => (
                    <span className="line-clamp-2 block max-w-[260px] font-medium" style={{ color: "var(--color-text)" }}>
                      {v as string}
                    </span>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (v) => <CampaignStatusBadge status={v as string} />,
                },
                {
                  key: "spend",
                  label: "Gasto",
                  render: (v) => <span className="tabular-nums">{formatBRL(v as number)}</span>,
                },
                {
                  key: "impressions",
                  label: "Impressões",
                  render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span>,
                },
                {
                  key: "clicks",
                  label: "Cliques",
                  render: (v) => <span className="tabular-nums">{formatCompact(v as number)}</span>,
                },
                {
                  key: "ctr",
                  label: "CTR",
                  render: (v) => <span className="tabular-nums">{(v as number).toFixed(2)}%</span>,
                },
                {
                  key: "cpc",
                  label: "CPC",
                  render: (v) => <span className="tabular-nums">{formatBRL(v as number)}</span>,
                },
                {
                  key: "conversions",
                  label: "Conversões",
                  render: (v) => <span className="tabular-nums">{(v as number).toLocaleString("pt-BR")}</span>,
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
