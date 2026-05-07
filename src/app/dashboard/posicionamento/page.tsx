"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangeControls } from "@/components/layout/date-range-controls";
import { PeriodComparisonSection } from "@/components/dashboard/period-comparison-section";
import type { Account, ChannelDailyRow, ProfileSnapshot } from "@/types/accounts";

const YT_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
  </svg>
);

const IG_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
  </svg>
);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function shiftDateBack(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const d1 = new Date(start + "T00:00:00");
  const d2 = new Date(end + "T00:00:00");
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatPeriodLabel(start: string, end: string): string {
  const fmt = (s: string) => {
    const [, mm, dd] = s.split("-");
    return `${dd}/${mm}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function PosicionamentoPage() {
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [appliedStart, setAppliedStart] = useState(daysAgo(30));
  const [appliedEnd, setAppliedEnd] = useState(today());

  const [ytAccounts, setYtAccounts] = useState<Account[]>([]);
  const [igAccounts, setIgAccounts] = useState<Account[]>([]);
  const [ytSelectedId, setYtSelectedId] = useState("");
  const [igSelectedId, setIgSelectedId] = useState("");
  const [ytLoading, setYtLoading] = useState(true);
  const [igLoading, setIgLoading] = useState(true);
  const [ytDailyRows, setYtDailyRows] = useState<ChannelDailyRow[]>([]);
  const [igSnapshots, setIgSnapshots] = useState<ProfileSnapshot[]>([]);

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

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

  useEffect(() => {
    if (!ytSelectedId) { setYtLoading(false); return; }
    let cancelled = false;
    setYtLoading(true);
    const periodDays = daysBetween(appliedStart, appliedEnd);
    const fetchStart = shiftDateBack(appliedStart, periodDays);
    fetch(`/api/youtube/channel?account_id=${ytSelectedId}&start_date=${fetchStart}&end_date=${appliedEnd}`)
      .then((r) => r.json()).catch(() => [])
      .then((daily) => {
        if (cancelled) return;
        setYtDailyRows(Array.isArray(daily) ? daily : []);
        setYtLoading(false);
      });
    return () => { cancelled = true; };
  }, [ytSelectedId, appliedStart, appliedEnd]);

  useEffect(() => {
    if (!igSelectedId) { setIgLoading(false); return; }
    let cancelled = false;
    setIgLoading(true);
    const periodDays = daysBetween(appliedStart, appliedEnd);
    const fetchStart = shiftDateBack(appliedStart, periodDays);
    fetch(`/api/instagram/profile?account_id=${igSelectedId}&start_date=${fetchStart}&end_date=${appliedEnd}`)
      .then((r) => r.json()).catch(() => [])
      .then((snaps) => {
        if (cancelled) return;
        setIgSnapshots(Array.isArray(snaps) ? snaps : []);
        setIgLoading(false);
      });
    return () => { cancelled = true; };
  }, [igSelectedId, appliedStart, appliedEnd]);

  // Period boundaries
  const periodDays = daysBetween(appliedStart, appliedEnd);
  const previousStart = shiftDateBack(appliedStart, periodDays);
  const previousEnd = shiftDateBack(appliedStart, 1);
  const previousLabel = formatPeriodLabel(previousStart, previousEnd);
  const currentLabel = formatPeriodLabel(appliedStart, appliedEnd);

  // YouTube derivados
  const ytPrevRows = ytDailyRows.filter((r) => r.date >= previousStart && r.date <= previousEnd);
  const ytCurrRows = ytDailyRows.filter((r) => r.date >= appliedStart && r.date <= appliedEnd);
  const ytPrevValue = ytPrevRows.length > 0 ? (ytPrevRows[ytPrevRows.length - 1].subscriber_count ?? 0) : 0;
  const ytCurrValue = ytCurrRows.length > 0 ? (ytCurrRows[ytCurrRows.length - 1].subscriber_count ?? 0) : 0;
  const ytPrevSparkline = ytPrevRows.map((r) => ({ date: r.date, value: r.subscribers_gained - r.subscribers_lost }));
  const ytCurrSparkline = ytCurrRows.map((r) => ({ date: r.date, value: r.subscribers_gained - r.subscribers_lost }));

  // Instagram derivados
  const igPrevSnaps = igSnapshots.filter((s) => s.collected_at.slice(0, 10) < appliedStart);
  const igCurrSnaps = igSnapshots.filter((s) => s.collected_at.slice(0, 10) >= appliedStart);
  const igPrevValue = igPrevSnaps.length > 0 ? igPrevSnaps[igPrevSnaps.length - 1].followers_count : 0;
  const igCurrValue = igCurrSnaps.length > 0 ? igCurrSnaps[igCurrSnaps.length - 1].followers_count : 0;
  const igPrevSparkline = igPrevSnaps.map((s) => ({ date: s.collected_at.slice(0, 10), value: s.followers_count }));
  const igCurrSparkline = igCurrSnaps.map((s) => ({ date: s.collected_at.slice(0, 10), value: s.followers_count }));

  return (
    <div className="min-h-full">
      <PageHeader
        title="Posicionamento"
        subtitle="Métricas de alcance nas redes sociais"
        actions={
          <DateRangeControls
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onApply={applyDateFilter}
          />
        }
      />

      <div style={{ padding: "24px" }}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <PeriodComparisonSection
            platformName="YouTube"
            platformColor="#FF0000"
            platformIcon={YT_ICON}
            exploreHref="/dashboard/youtube"
            metricLabel="Inscritos (Total)"
            loading={ytLoading}
            accounts={ytAccounts}
            selectedAccountId={ytSelectedId}
            onAccountChange={setYtSelectedId}
            previousPeriod={{ label: previousLabel, value: ytPrevValue, sparklineData: ytPrevSparkline }}
            currentPeriod={{ label: currentLabel, value: ytCurrValue, sparklineData: ytCurrSparkline }}
          />

          <PeriodComparisonSection
            platformName="Instagram"
            platformColor="#E1306C"
            platformIcon={IG_ICON}
            exploreHref="/dashboard/instagram"
            metricLabel="Seguidores (Total)"
            loading={igLoading}
            accounts={igAccounts}
            selectedAccountId={igSelectedId}
            onAccountChange={setIgSelectedId}
            previousPeriod={{ label: previousLabel, value: igPrevValue, sparklineData: igPrevSparkline }}
            currentPeriod={{ label: currentLabel, value: igCurrValue, sparklineData: igCurrSparkline }}
          />
        </div>
      </div>
    </div>
  );
}
