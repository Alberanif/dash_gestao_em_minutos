"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { GvDateControls } from "@/components/gv/gv-date-controls";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { NarrLabel } from "@/components/gv/narr-label";
import { CompareCard } from "@/components/gv/compare-card";
import { StatCard } from "@/components/gv/stat-card";
import { AccountSectionHeader } from "@/components/dashboard/account-section-header";
import { calcPresetDates, getActivePreset } from "@/lib/utils/period-presets";
import type { PresetKey } from "@/lib/utils/period-presets";
import type { Account, ChannelDailyRow, ProfileSnapshot } from "@/types/accounts";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
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

function calcPct(prev: number, curr: number): number {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

function calcStatus(pct: number): "green" | "amber" | "red" {
  if (pct >= 5) return "green";
  if (pct >= -5) return "amber";
  return "red";
}

function pulseBannerProps(ytPct: number, igPct: number): {
  status: "green" | "amber" | "red";
  headline: string;
  sub: string;
  chips: { label: string; status: "green" | "amber" | "red" | "muted" }[];
} {
  const ytSt = calcStatus(ytPct);
  const igSt = calcStatus(igPct);

  if (ytSt !== "red" && igSt !== "red") {
    return {
      status: "green",
      headline: "Ambas as plataformas crescendo",
      sub: "YouTube e Instagram com alcance positivo no período.",
      chips: [
        { label: "2 acelerando", status: "green" },
        { label: "vs. período anterior", status: "muted" },
      ],
    };
  }

  if (ytSt !== "red" || igSt !== "red") {
    const ytLabel = ytSt === "red" ? "YouTube esfriando" : "YouTube acelerando";
    const igLabel = igSt === "red" ? "Instagram esfriando" : "Instagram acelerando";
    return {
      status: "amber",
      headline: `${ytLabel}, ${igLabel}`,
      sub: "A audiência está consumindo de formas diferentes nas plataformas. Vale analisar o mix de conteúdo.",
      chips: [
        { label: "1 acelerando", status: "green" },
        { label: "1 esfriando", status: "red" },
        { label: "vs. período anterior", status: "muted" },
      ],
    };
  }

  return {
    status: "red",
    headline: "Alcance caindo nas duas plataformas",
    sub: "YouTube e Instagram com queda de consumo no período. Vale rever estratégia de conteúdo.",
    chips: [
      { label: "2 esfriando", status: "red" },
      { label: "vs. período anterior", status: "muted" },
    ],
  };
}

const VIDEO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h18v4H3z" /><path d="M3 9h12v4H3z" /><path d="M3 15h7v4H3z" />
  </svg>
);

const CLOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const SPARK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 8-6-16-3 8H2" />
  </svg>
);

const PEOPLE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const EYE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

export default function RelacionamentoPage() {
  const today = todayStr();
  const defaultStart = subtractDays(today, 28);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);

  const activePreset = useMemo(
    () => getActivePreset(startDate, endDate, today),
    [startDate, endDate, today]
  );

  function handlePreset(key: PresetKey) {
    const { startDate: s, endDate: e } = calcPresetDates(key, today);
    setStartDate(s);
    setEndDate(e);
  }

  const [ytAccounts, setYtAccounts] = useState<Account[] | null>(null);
  const [igAccounts, setIgAccounts] = useState<Account[] | null>(null);
  const [ytSelectedId, setYtSelectedId] = useState("");
  const [igSelectedId, setIgSelectedId] = useState("");
  const [ytLoading, setYtLoading] = useState(true);
  const [igLoading, setIgLoading] = useState(true);
  const [ytDailyRows, setYtDailyRows] = useState<ChannelDailyRow[]>([]);
  const [igSnapshots, setIgSnapshots] = useState<ProfileSnapshot[]>([]);

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
      } else {
        setYtLoading(false);
      }
      if (igId) setIgSelectedId(igId);
      else setIgLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodDays = daysBetween(startDate, endDate);
  const previousStart = subtractDays(startDate, periodDays);
  const previousEnd = subtractDays(startDate, 1);

  useEffect(() => {
    if (!ytSelectedId) return;
    let cancelled = false;
    setYtLoading(true);
    const fetchStart = subtractDays(startDate, periodDays);
    fetch(`/api/youtube/channel?account_id=${ytSelectedId}&start_date=${fetchStart}&end_date=${endDate}`)
      .then((r) => r.json()).catch(() => [])
      .then((daily) => {
        if (cancelled) return;
        setYtDailyRows(Array.isArray(daily) ? daily : []);
        setYtLoading(false);
      });
    return () => { cancelled = true; };
  }, [ytSelectedId, startDate, endDate, periodDays]);

  useEffect(() => {
    if (!igSelectedId) return;
    let cancelled = false;
    setIgLoading(true);
    const fetchStart = subtractDays(startDate, periodDays);
    fetch(`/api/instagram/profile?account_id=${igSelectedId}&start_date=${fetchStart}&end_date=${endDate}`)
      .then((r) => r.json()).catch(() => [])
      .then((snaps) => {
        if (cancelled) return;
        setIgSnapshots(Array.isArray(snaps) ? snaps : []);
        setIgLoading(false);
      });
    return () => { cancelled = true; };
  }, [igSelectedId, startDate, endDate, periodDays]);

  const prevLabel = formatPeriodLabel(previousStart, previousEnd);
  const currLabel = formatPeriodLabel(startDate, endDate);

  const ytPrevRows = ytDailyRows.filter((r) => r.date >= previousStart && r.date <= previousEnd);
  const ytCurrRows = ytDailyRows.filter((r) => r.date >= startDate && r.date <= endDate);
  const ytPrevValue = ytPrevRows.reduce((s, r) => s + r.views, 0);
  const ytCurrValue = ytCurrRows.reduce((s, r) => s + r.views, 0);
  const ytPrevSpark = ytPrevRows.map((r) => r.views);
  const ytCurrSpark = ytCurrRows.map((r) => r.views);
  const ytPct = calcPct(ytPrevValue, ytCurrValue);
  const ytStatus = calcStatus(ytPct);

  const igPrevSnaps = igSnapshots.filter((s) => s.collected_at.slice(0, 10) < startDate);
  const igCurrSnaps = igSnapshots.filter((s) => s.collected_at.slice(0, 10) >= startDate);
  const igPrevValue = igPrevSnaps.reduce((s, snap) => s + snap.reach, 0);
  const igCurrValue = igCurrSnaps.reduce((s, snap) => s + snap.reach, 0);
  const igPrevSpark = igPrevSnaps.map((s) => s.reach);
  const igCurrSpark = igCurrSnaps.map((s) => s.reach);
  const igPct = calcPct(igPrevValue, igCurrValue);
  const igStatus = calcStatus(igPct);

  const pulse = pulseBannerProps(ytPct, igPct);

  const ytVideosPublished = ytCurrRows.length;
  const ytVideosPrev = ytPrevRows.length;
  const ytVideosDelta = ytVideosPrev > 0
    ? Math.round(((ytVideosPublished - ytVideosPrev) / ytVideosPrev) * 100)
    : 0;
  const ytVideosStatus = calcStatus(ytVideosDelta);

  const ytAvgWatchTime = ytCurrRows.length > 0
    ? ytCurrRows.reduce((s, r) => s + r.average_view_duration, 0) / ytCurrRows.length
    : 0;
  const ytAvgWatchPrev = ytPrevRows.length > 0
    ? ytPrevRows.reduce((s, r) => s + r.average_view_duration, 0) / ytPrevRows.length
    : 0;
  const ytWatchDelta = ytAvgWatchPrev > 0
    ? Math.round(((ytAvgWatchTime - ytAvgWatchPrev) / ytAvgWatchPrev) * 100)
    : 0;
  const ytWatchStatus = calcStatus(ytWatchDelta);

  function formatDuration(secs: number): string {
    if (secs <= 0) return "—";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const loading = ytLoading || igLoading;

  const showYt = ytAccounts === null || ytAccounts.length > 0;
  const showIg = igAccounts === null || igAccounts.length > 0;

  const ytAccountName = (ytAccounts ?? []).find((a) => a.id === ytSelectedId)?.name ?? "YouTube";
  const igAccountName = (igAccounts ?? []).find((a) => a.id === igSelectedId)?.name ?? "Instagram";

  return (
    <div className="main">
      <GvPageHeader
        title="Relacionamento"
        sub="Quanto a audiência está consumindo nosso conteúdo"
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
        <NarrLabel step="01" label="Pulso do Período" desc="Consumo vs. período anterior" />
        <PulseBanner
          status={loading ? "amber" : pulse.status}
          headline={loading ? "Carregando dados…" : pulse.headline}
          sub={loading ? "Aguardando resposta das APIs." : pulse.sub}
          chips={loading ? [{ label: "carregando", status: "muted" }] : pulse.chips}
        />

        <NarrLabel step="02" label="Alcance por Plataforma" />
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
                metric="Views no período"
                prevLabel={prevLabel}
                currLabel={currLabel}
                prevValue={ytPrevValue}
                currValue={ytCurrValue}
                prevSpark={ytPrevSpark}
                currSpark={ytCurrSpark}
                status={ytStatus}
                verdict={
                  ytCurrValue >= ytPrevValue
                    ? `<b>+${(ytCurrValue - ytPrevValue).toLocaleString("pt-BR")} views</b> vs. período anterior. Conteúdo acelerou.`
                    : `<b>−${(ytPrevValue - ytCurrValue).toLocaleString("pt-BR")} views</b> vs. período anterior. Distribuição caiu.`
                }
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
                metric="Alcance no período"
                prevLabel={prevLabel}
                currLabel={currLabel}
                prevValue={igPrevValue}
                currValue={igCurrValue}
                prevSpark={igPrevSpark}
                currSpark={igCurrSpark}
                status={igStatus}
                verdict={
                  igCurrValue >= igPrevValue
                    ? `<b>+${(igCurrValue - igPrevValue).toLocaleString("pt-BR")} pessoas</b> alcançadas vs. período anterior.`
                    : `<b>−${(igPrevValue - igCurrValue).toLocaleString("pt-BR")} pessoas</b> vs. período anterior. Distribuição orgânica caiu.`
                }
              />
            </div>
          )}
        </div>

        <NarrLabel step="03" label="Detalhe do Período" desc="Como o consumo se distribui" />
        <div className="grid g4">
          {showYt && (
            <>
              <StatCard
                icon={VIDEO_ICON}
                title="Vídeos Publicados"
                subtitle={ytAccountName}
                value={ytVideosPublished > 0 ? String(ytVideosPublished) : "—"}
                delta={ytVideosDelta}
                status={ytVideosStatus}
                foot={
                  ytVideosPrev > 0
                    ? `<strong>${ytVideosPublished > ytVideosPrev ? "+" : ""}${ytVideosPublished - ytVideosPrev}</strong> vs. período anterior`
                    : "sem dados do período anterior"
                }
                sparkData={ytCurrSpark.length >= 2 ? ytCurrSpark : undefined}
              />
              <StatCard
                icon={CLOCK_ICON}
                title="Tempo Médio Assistido"
                subtitle={ytAccountName}
                value={formatDuration(ytAvgWatchTime)}
                unit={ytAvgWatchTime > 0 ? "min" : undefined}
                delta={ytWatchDelta}
                status={ytWatchStatus}
                foot={
                  ytAvgWatchPrev > 0
                    ? `<strong>${formatDuration(ytAvgWatchTime)}</strong> de retenção média`
                    : "sem dados do período anterior"
                }
              />
            </>
          )}
          {showIg && (
            <>
              <StatCard
                icon={SPARK_ICON}
                title="Engajamento Reels"
                subtitle={igAccountName}
                value="—"
                delta={0}
                status="amber"
                foot="Meta: <strong>≥ 5,5%</strong> (estimativa)"
              />
              <StatCard
                icon={PEOPLE_ICON}
                title="Comentários Respondidos"
                subtitle={igAccountName}
                value="—"
                delta={0}
                status="amber"
                foot="(estimativa)"
              />
            </>
          )}
        </div>

        <div className="tip">
          {EYE_ICON}
          <div>
            <b>Atenção rápida:</b> os dados do Instagram de engajamento e respostas são estimativas — a API de insights do Instagram não está integrada. Os dados de alcance são coletados via snapshot de perfil.
          </div>
        </div>
      </div>
    </div>
  );
}
