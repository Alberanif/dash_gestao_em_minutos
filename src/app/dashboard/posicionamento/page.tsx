"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { GvDateControls } from "@/components/gv/gv-date-controls";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { NarrLabel } from "@/components/gv/narr-label";
import { CompareCard } from "@/components/gv/compare-card";
import { AccountSectionHeader } from "@/components/dashboard/account-section-header";
import { calcPulseBanner, calcVerdict, calcPlatformStatus } from "./logic";
import { calcPresetDates, getActivePreset } from "@/lib/utils/period-presets";
import type { PresetKey } from "@/lib/utils/period-presets";
import type { Account, ChannelDailyRow, ProfileSnapshot } from "@/types/accounts";

function todayStr(): string {
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(todayStr());

  const [ytAccounts, setYtAccounts] = useState<Account[] | null>(null);
  const [igAccounts, setIgAccounts] = useState<Account[] | null>(null);
  const [ytSelectedId, setYtSelectedId] = useState("");
  const [igSelectedId, setIgSelectedId] = useState("");
  const [ytLoading, setYtLoading] = useState(true);
  const [igLoading, setIgLoading] = useState(true);
  const [ytDailyRows, setYtDailyRows] = useState<ChannelDailyRow[]>([]);
  const [igSnapshots, setIgSnapshots] = useState<ProfileSnapshot[]>([]);

  const activePreset = getActivePreset(startDate, endDate, todayStr());

  function handlePreset(key: PresetKey) {
    const { startDate: s, endDate: e } = calcPresetDates(key, todayStr());
    setStartDate(s);
    setEndDate(e);
  }

  function selectYt(id: string) {
    setYtSelectedId(id);
    const p = new URLSearchParams(searchParams.toString());
    p.set("yt", id);
    router.replace(`?${p.toString()}`);
  }

  function selectIg(id: string) {
    setIgSelectedId(id);
    const p = new URLSearchParams(searchParams.toString());
    p.set("ig", id);
    router.replace(`?${p.toString()}`);
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
      const ytParam = searchParams.get("yt");
      const igParam = searchParams.get("ig");
      const ytId = ytList.find((a) => a.id === ytParam)?.id ?? ytList[0]?.id ?? "";
      const igId = igList.find((a) => a.id === igParam)?.id ?? igList[0]?.id ?? "";
      if (ytId) {
        setYtSelectedId(ytId);
        if (!ytParam || ytParam !== ytId) {
          const p = new URLSearchParams(searchParams.toString());
          p.set("yt", ytId);
          if (igId) p.set("ig", igId);
          router.replace(`?${p.toString()}`);
        }
      }
      if (igId) setIgSelectedId(igId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ytSelectedId) { setYtLoading(false); return; }
    let cancelled = false;
    setYtLoading(true);
    const periodDays = daysBetween(startDate, endDate);
    const fetchStart = shiftDateBack(startDate, periodDays);
    fetch(`/api/youtube/channel?account_id=${ytSelectedId}&start_date=${fetchStart}&end_date=${endDate}`)
      .then((r) => r.json()).catch(() => [])
      .then((daily) => {
        if (cancelled) return;
        setYtDailyRows(Array.isArray(daily) ? daily : []);
        setYtLoading(false);
      });
    return () => { cancelled = true; };
  }, [ytSelectedId, startDate, endDate]);

  useEffect(() => {
    if (!igSelectedId) { setIgLoading(false); return; }
    let cancelled = false;
    setIgLoading(true);
    const periodDays = daysBetween(startDate, endDate);
    const fetchStart = shiftDateBack(startDate, periodDays);
    fetch(`/api/instagram/profile?account_id=${igSelectedId}&start_date=${fetchStart}&end_date=${endDate}`)
      .then((r) => r.json()).catch(() => [])
      .then((snaps) => {
        if (cancelled) return;
        setIgSnapshots(Array.isArray(snaps) ? snaps : []);
        setIgLoading(false);
      });
    return () => { cancelled = true; };
  }, [igSelectedId, startDate, endDate]);

  const periodDays = daysBetween(startDate, endDate);
  const previousStart = shiftDateBack(startDate, periodDays);
  const previousEnd = shiftDateBack(startDate, 1);
  const previousLabel = formatPeriodLabel(previousStart, previousEnd);
  const currentLabel = formatPeriodLabel(startDate, endDate);

  const ytPrevRows = ytDailyRows.filter((r) => r.date >= previousStart && r.date <= previousEnd);
  const ytCurrRows = ytDailyRows.filter((r) => r.date >= startDate && r.date <= endDate);
  const ytPrevValue = ytPrevRows.length > 0 ? (ytPrevRows[ytPrevRows.length - 1].subscriber_count ?? 0) : 0;
  const ytCurrValue = ytCurrRows.length > 0 ? (ytCurrRows[ytCurrRows.length - 1].subscriber_count ?? 0) : 0;
  const ytPrevSpark = ytPrevRows.map((r) => r.subscribers_gained - r.subscribers_lost);
  const ytCurrSpark = ytCurrRows.map((r) => r.subscribers_gained - r.subscribers_lost);

  const igPrevSnaps = igSnapshots.filter((s) => s.collected_at.slice(0, 10) < startDate);
  const igCurrSnaps = igSnapshots.filter((s) => s.collected_at.slice(0, 10) >= startDate);
  const igPrevValue = igPrevSnaps.length > 0 ? igPrevSnaps[igPrevSnaps.length - 1].followers_count : 0;
  const igCurrValue = igCurrSnaps.length > 0 ? igCurrSnaps[igCurrSnaps.length - 1].followers_count : 0;
  const igPrevSpark = igPrevSnaps.map((s) => s.followers_count);
  const igCurrSpark = igCurrSnaps.map((s) => s.followers_count);

  const ytPct = ytPrevValue > 0 ? ((ytCurrValue - ytPrevValue) / ytPrevValue) * 100 : 0;
  const igPct = igPrevValue > 0 ? ((igCurrValue - igPrevValue) / igPrevValue) * 100 : 0;

  const { status: bannerStatus, headline: bannerHeadline, chips } = calcPulseBanner({ ytPct, igPct });

  const ytStatus = calcPlatformStatus(ytPct);
  const igStatus = calcPlatformStatus(igPct);

  const ytVerdict = calcVerdict(ytStatus, ytPrevValue, ytCurrValue);
  const igVerdict = calcVerdict(igStatus, igPrevValue, igCurrValue);

  const ytAccountName = (ytAccounts ?? []).find((a) => a.id === ytSelectedId)?.name ?? "YouTube";
  const igAccountName = (igAccounts ?? []).find((a) => a.id === igSelectedId)?.name ?? "Instagram";

  const isLoading = ytLoading || igLoading;

  const pctLabel = (pct: number) => {
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}% vs período anterior`;
  };

  const showYt = ytAccounts === null || ytAccounts.length > 0;
  const showIg = igAccounts === null || igAccounts.length > 0;

  return (
    <div className="main">
      <GvPageHeader
        eyebrow="Gestão à Vista · Gestão em 4 Minutos"
        title="Posicionamento"
        sub="O quanto a marca está sendo encontrada nas redes sociais"
      >
        <GvDateControls
          startDate={startDate}
          endDate={endDate}
          activePreset={activePreset}
          onPreset={handlePreset}
          onStartDate={setStartDate}
          onEndDate={setEndDate}
        />
      </GvPageHeader>

      <div className="section">
        <NarrLabel step="01" label="Status do Período" desc="Audiência acumulada vs. período anterior" />
        <PulseBanner
          status={isLoading ? "amber" : bannerStatus}
          headline={isLoading ? "Carregando dados…" : bannerHeadline}
          sub={isLoading ? "Aguardando resposta das APIs." : pctLabel((ytPct + igPct) / 2)}
          chips={isLoading ? [{ label: "carregando", status: "muted" }] : chips}
        />

        <NarrLabel step="02" label="Comparativo por Canal" desc="Período atual vs. período anterior" />
        <div className="grid g2">
          {showYt && (
            <div>
              <AccountSectionHeader
                title="YouTube"
                accounts={ytAccounts}
                selectedId={ytSelectedId}
                onSelect={selectYt}
              />
              <CompareCard
                platform="yt"
                name={ytAccountName}
                metric="Inscritos no canal"
                prevLabel={previousLabel}
                currLabel={currentLabel}
                prevValue={ytPrevValue}
                currValue={ytCurrValue}
                prevSpark={ytPrevSpark}
                currSpark={ytCurrSpark}
                status={ytStatus}
                verdict={ytVerdict}
              />
            </div>
          )}
          {showIg && (
            <div>
              <AccountSectionHeader
                title="Instagram"
                accounts={igAccounts}
                selectedId={igSelectedId}
                onSelect={selectIg}
              />
              <CompareCard
                platform="ig"
                name={igAccountName}
                metric="Seguidores do perfil"
                prevLabel={previousLabel}
                currLabel={currentLabel}
                prevValue={igPrevValue}
                currValue={igCurrValue}
                prevSpark={igPrevSpark}
                currSpark={igCurrSpark}
                status={igStatus}
                verdict={igVerdict}
              />
            </div>
          )}
        </div>

        <p className="tip">
          Leia os números de cima para baixo: primeiro o status geral, depois cada canal. Compare sempre o período atual com o anterior de mesmo tamanho.
        </p>
      </div>
    </div>
  );
}
