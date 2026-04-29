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

function netSubsPerDay(rows: ChannelDailyRow[]): number[] {
  return rows.map((r) => r.subscribers_gained - r.subscribers_lost);
}

function calcWeekDeltaFromSeries(series: number[]): number | null {
  if (series.length < 2) return null;
  const recent = series.slice(-7);
  const previous = series.slice(-14, -7);
  if (previous.length === 0) return null;
  const recentSum = recent.reduce((a, b) => a + b, 0);
  const prevSum = previous.reduce((a, b) => a + b, 0);
  return recentSum - prevSum;
}

function calcInstagramWeekDelta(snapshots: ProfileSnapshot[]): number | null {
  if (snapshots.length < 2) return null;
  const latest = snapshots[snapshots.length - 1].followers_count;
  const latestDate = new Date(snapshots[snapshots.length - 1].collected_at).getTime();
  const targetDate = latestDate - 7 * 24 * 60 * 60 * 1000;
  let closest = snapshots[0];
  let closestDiff = Math.abs(new Date(snapshots[0].collected_at).getTime() - targetDate);
  for (const snap of snapshots) {
    const diff = Math.abs(new Date(snap.collected_at).getTime() - targetDate);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = snap;
    }
  }
  if (closest.id === snapshots[snapshots.length - 1].id) return null;
  return latest - closest.followers_count;
}

export default function PosicionamentoPage() {
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

  // Dados
  const [ytDailyRows, setYtDailyRows] = useState<ChannelDailyRow[]>([]);
  const [igSnapshots, setIgSnapshots] = useState<ProfileSnapshot[]>([]);

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  // Carrega as contas uma única vez ao montar
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

  // Derivados YouTube
  // subscriber_count do último dia do período selecionado
  const ytSubscriberCount = ytDailyRows.length > 0
    ? ytDailyRows[ytDailyRows.length - 1].subscriber_count ?? 0
    : 0;
  const ytNetSubs = netSubsPerDay(ytDailyRows);
  const ytSparkline = ytDailyRows.map((r, i) => ({
    date: r.date,
    value: ytNetSubs[i],
  }));
  const ytWeekDelta = calcWeekDeltaFromSeries(ytNetSubs);

  // Derivados Instagram
  const igFollowers =
    igSnapshots.length > 0 ? igSnapshots[igSnapshots.length - 1].followers_count : 0;
  const igSparkline = igSnapshots.map((s) => ({
    date: s.collected_at.slice(0, 10),
    value: s.followers_count,
  }));
  const igWeekDelta = calcInstagramWeekDelta(igSnapshots);

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
        title="Posicionamento"
        subtitle="Métricas de alcance nas redes sociais"
        actions={headerActions}
      />

      <div style={{ padding: "24px" }}>
        <div className="grid grid-cols-1 gap-6">
          <PositioningCard
            platform="youtube"
            label="Inscritos (Total)"
            value={ytSubscriberCount}
            weekDelta={ytWeekDelta}
            sparklineData={ytSparkline}
            seriesLabel="Variação de inscritos"
            loading={ytLoading}
            accounts={ytAccounts}
            selectedAccountId={ytSelectedId}
            onAccountChange={setYtSelectedId}
            explorePath="/dashboard/youtube"
          />

          <PositioningCard
            platform="instagram"
            label="Seguidores (Total)"
            value={igFollowers}
            weekDelta={igWeekDelta}
            sparklineData={igSparkline}
            seriesLabel="Seguidores"
            loading={igLoading}
            accounts={igAccounts}
            selectedAccountId={igSelectedId}
            onAccountChange={setIgSelectedId}
            explorePath="/dashboard/instagram"
          />
        </div>
      </div>
    </div>
  );
}
