"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangeControls } from "@/components/layout/date-range-controls";
import { PositioningCard } from "@/components/dashboard/positioning-card";
import type { Account, ChannelDailyRow, ProfileSnapshot } from "@/types/accounts";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function shiftDateBack(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Compara soma dos últimos 7 pontos com os 7 anteriores */
function calcWeekDeltaFromSeries(series: number[]): number | null {
  if (series.length < 2) return null;
  const recent = series.slice(-7);
  const previous = series.slice(-14, -7);
  if (previous.length === 0) return null;
  const recentSum = recent.reduce((a, b) => a + b, 0);
  const prevSum = previous.reduce((a, b) => a + b, 0);
  return recentSum - prevSum;
}

/** Compara o reach do snapshot mais recente com o snap mais próximo de 7 dias atrás */
function calcIgReachWeekDelta(snapshots: ProfileSnapshot[]): number | null {
  if (snapshots.length < 2) return null;
  const latest = snapshots[snapshots.length - 1];
  const latestTs = new Date(latest.collected_at).getTime();
  const targetTs = latestTs - 7 * 24 * 60 * 60 * 1000;

  let closest = snapshots[0];
  let closestDiff = Math.abs(new Date(snapshots[0].collected_at).getTime() - targetTs);
  for (const snap of snapshots) {
    const diff = Math.abs(new Date(snap.collected_at).getTime() - targetTs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = snap;
    }
  }

  if (closest.id === latest.id) return null;
  return latest.reach - closest.reach;
}

export default function RelacionamentoPage() {
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [appliedStart, setAppliedStart] = useState(daysAgo(30));
  const [appliedEnd, setAppliedEnd] = useState(today());

  // Contas disponíveis
  const [ytAccounts, setYtAccounts] = useState<Account[]>([]);
  const [igAccounts, setIgAccounts] = useState<Account[]>([]);

  // Conta selecionada por plataforma
  const [ytSelectedId, setYtSelectedId] = useState("");
  const [igSelectedId, setIgSelectedId] = useState("");

  // Estados de loading por plataforma
  const [ytLoading, setYtLoading] = useState(true);
  const [igLoading, setIgLoading] = useState(true);

  // Toggle de tipo de views do YouTube
  const [ytViewsMode, setYtViewsMode] = useState<"videos" | "shorts">("videos");

  // Dados
  const [ytDailyRows, setYtDailyRows] = useState<ChannelDailyRow[]>([]);
  const [igSnapshots, setIgSnapshots] = useState<ProfileSnapshot[]>([]);

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  // Carrega contas uma única vez ao montar
  useEffect(() => {
    Promise.all([
      fetch("/api/accounts?platform=youtube").then((r) => r.json()).catch(() => []),
      fetch("/api/accounts?platform=instagram").then((r) => r.json()).catch(() => []),
    ]).then(([yt, ig]: [Account[], Account[]]) => {
      const ytList = Array.isArray(yt) ? yt : [];
      const igList = Array.isArray(ig) ? ig : [];
      setYtAccounts(ytList);
      setIgAccounts(igList);
      if (ytList.length > 0) setYtSelectedId(ytList[0].id);
      if (igList.length > 0) setIgSelectedId(igList[0].id);
    });
  }, []);

  // Busca dados do YouTube quando conta ou período mudar
  useEffect(() => {
    if (!ytSelectedId) {
      setYtLoading(false);
      return;
    }
    let cancelled = false;
    setYtLoading(true);
    setYtViewsMode("videos");

    const extendedStart = shiftDateBack(appliedStart, 14);
    fetch(
      `/api/youtube/channel?account_id=${ytSelectedId}&start_date=${extendedStart}&end_date=${appliedEnd}`
    )
      .then((r) => r.json())
      .catch(() => [])
      .then((daily) => {
        if (cancelled) return;
        setYtDailyRows(Array.isArray(daily) ? daily : []);
        setYtLoading(false);
      });

    return () => { cancelled = true; };
  }, [ytSelectedId, appliedStart, appliedEnd]);

  // Busca dados do Instagram quando conta ou período mudar
  useEffect(() => {
    if (!igSelectedId) {
      setIgLoading(false);
      return;
    }
    let cancelled = false;
    setIgLoading(true);

    const extendedStart = shiftDateBack(appliedStart, 14);
    fetch(
      `/api/instagram/profile?account_id=${igSelectedId}&start_date=${extendedStart}&end_date=${appliedEnd}`
    )
      .then((r) => r.json())
      .catch(() => [])
      .then((snaps) => {
        if (cancelled) return;
        setIgSnapshots(Array.isArray(snaps) ? snaps : []);
        setIgLoading(false);
      });

    return () => { cancelled = true; };
  }, [igSelectedId, appliedStart, appliedEnd]);

  // Derivados YouTube — views condicionais por tipo selecionado
  // ytPeriodRows: apenas o período selecionado — usado para totais e sparkline
  const ytPeriodRows = ytDailyRows.filter(
    (r) => r.date >= appliedStart && r.date <= appliedEnd
  );
  const ytViewsSeries = ytPeriodRows.map((r) =>
    ytViewsMode === "videos" ? r.views_videos : r.views_shorts
  );
  const ytTotalViews = ytViewsSeries.reduce((s, v) => s + v, 0);
  const ytSparkline = ytPeriodRows.map((r) => ({
    date: r.date,
    value: ytViewsMode === "videos" ? r.views_videos : r.views_shorts,
  }));

  // ytFullViewsSeries: range estendido (+14 dias) — apenas para cálculo de variação semanal
  const ytFullViewsSeries = ytDailyRows.map((r) =>
    ytViewsMode === "videos" ? r.views_videos : r.views_shorts
  );
  const ytWeekDelta = calcWeekDeltaFromSeries(ytFullViewsSeries);

  // Derivados Instagram — reach total do período
  const igTotalReach = igSnapshots.reduce((s, snap) => s + snap.reach, 0);
  const igSparkline = igSnapshots.map((s) => ({
    date: s.collected_at.slice(0, 10),
    value: s.reach,
  }));
  const igWeekDelta = calcIgReachWeekDelta(igSnapshots);

  const headerActions = (
    <DateRangeControls
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      onApply={applyDateFilter}
    />
  );

  return (
    <div className="min-h-full">
      <PageHeader
        title="Relacionamento"
        subtitle="Métricas de engajamento e alcance nas redes sociais"
        actions={headerActions}
      />

      <div style={{ padding: "24px" }}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <PositioningCard
            platform="youtube"
            label={ytViewsMode === "videos" ? "Views de Vídeos (Período)" : "Views de Shorts (Período)"}
            value={ytTotalViews}
            weekDelta={ytWeekDelta}
            sparklineData={ytSparkline}
            seriesLabel={ytViewsMode === "videos" ? "Views de Vídeos" : "Views de Shorts"}
            loading={ytLoading}
            accounts={ytAccounts}
            selectedAccountId={ytSelectedId}
            onAccountChange={setYtSelectedId}
            toggleMode={ytViewsMode}
            onToggleMode={setYtViewsMode}
          />

          <PositioningCard
            platform="instagram"
            label="Alcance (Total do Período)"
            value={igTotalReach}
            weekDelta={igWeekDelta}
            sparklineData={igSparkline}
            seriesLabel="Alcance"
            loading={igLoading}
            accounts={igAccounts}
            selectedAccountId={igSelectedId}
            onAccountChange={setIgSelectedId}
          />

          <PositioningCard
            platform="spotify"
            label="Seguidores e Retenção (Posição Geral)"
            value={0}
            weekDelta={null}
            sparklineData={[]}
            seriesLabel="Seguidores"
            loading={false}
            noData
          />
        </div>
      </div>
    </div>
  );
}
