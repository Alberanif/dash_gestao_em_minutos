"use client";

import { useEffect, useState, useCallback } from "react";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { GvDateControls } from "@/components/gv/gv-date-controls";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { NarrLabel } from "@/components/gv/narr-label";
import { LtvCard } from "@/components/gv/ltv-card";
import { StatCard } from "@/components/gv/stat-card";
import { calcPresetDates, getActivePreset } from "@/lib/utils/period-presets";
import type { PresetKey } from "@/lib/utils/period-presets";
import type { LtvMetrics } from "@/types/ltv";

const MOCK_MRR_MATRIZ = 12800;
const MOCK_MRR_SOLIDES = 9000;
const MOCK_CHURN_MATRIZ = 2.5;
const MOCK_CHURN_SOLIDES = 3.1;
const MOCK_LTV_CAC = 3.2;

const SPARK_MOCK: number[] = [
  90, 92, 89, 94, 97, 95, 98, 100, 103, 101,
  105, 108, 106, 110, 113, 112, 115, 118, 116, 119,
  122, 120, 124, 127, 125, 129, 132, 130, 134, 138,
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultPeriod(): { startDate: string; endDate: string } {
  return calcPresetDates("mes-atual", todayStr());
}

function deriveBannerStatus(
  matrizMetrics: LtvMetrics | null,
  solidesMetrics: LtvMetrics | null
): "green" | "amber" | "red" {
  const bothLoaded = matrizMetrics !== null && solidesMetrics !== null;
  if (bothLoaded) return "green";
  if (matrizMetrics !== null || solidesMetrics !== null) return "amber";
  return "red";
}

function sourceStatus(metrics: LtvMetrics | null): "green" | "amber" | "muted" {
  if (metrics === null) return "muted";
  return "green";
}

const ICONS = {
  users: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  mrr: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  churn: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  ratio: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  ),
};

export default function LtvPage() {
  const defaults = getDefaultPeriod();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const [matrizMetrics, setMatrizMetrics] = useState<LtvMetrics | null>(null);
  const [solidesMetrics, setSolidesMetrics] = useState<LtvMetrics | null>(null);
  const [loadingMatriz, setLoadingMatriz] = useState(true);
  const [loadingSolides, setLoadingSolides] = useState(true);

  const fetchMetrics = useCallback(async (s: string, e: string) => {
    setLoadingMatriz(true);
    setLoadingSolides(true);

    try {
      const [matrizRes, solidesRes] = await Promise.all([
        fetch(`/api/ltv/matriz-humana/metrics?start=${s}&end=${e}`),
        fetch(`/api/ltv/solides/metrics?start=${s}&end=${e}`),
      ]);

      const matrizData = matrizRes.ok ? await matrizRes.json() : null;
      const solidesData = solidesRes.ok ? await solidesRes.json() : null;

      setMatrizMetrics(matrizData?.error ? null : matrizData);
      setSolidesMetrics(solidesData?.error ? null : solidesData);
    } catch (err) {
      console.error("Erro ao carregar métricas LTV:", err);
      setMatrizMetrics(null);
      setSolidesMetrics(null);
    } finally {
      setLoadingMatriz(false);
      setLoadingSolides(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(startDate, endDate);
  }, [fetchMetrics, startDate, endDate]);

  function handlePreset(key: PresetKey) {
    const { startDate: s, endDate: e } = calcPresetDates(key, todayStr());
    setStartDate(s);
    setEndDate(e);
  }

  const activePreset = getActivePreset(startDate, endDate, todayStr());

  const bannerStatus = deriveBannerStatus(matrizMetrics, solidesMetrics);

  const bannerHeadline =
    bannerStatus === "green"
      ? "Assinaturas estáveis"
      : bannerStatus === "amber"
      ? "Dados parciais disponíveis"
      : "Sem dados no período";

  const bannerSub =
    bannerStatus === "green"
      ? "Ambas as fontes com dados disponíveis"
      : bannerStatus === "amber"
      ? "Uma das fontes sem dados no período selecionado"
      : "Verifique a sincronização das fontes";

  const novasTotal =
    (matrizMetrics?.novas_assinaturas ?? 0) + (solidesMetrics?.novas_assinaturas ?? 0);

  const mrrTotal = MOCK_MRR_MATRIZ + MOCK_MRR_SOLIDES;

  const churnMedio = ((MOCK_CHURN_MATRIZ + MOCK_CHURN_SOLIDES) / 2).toFixed(1);

  const periodLabel = (() => {
    const fmt = (s: string) => {
      const [, mm, dd] = s.split("-");
      return `${dd}/${mm}`;
    };
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  })();

  return (
    <div className="main">
      <GvPageHeader
        title="LTV"
        sub="Quanto cada cliente vale ao longo do tempo, por fonte"
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
        <PulseBanner
          status={bannerStatus}
          headline={bannerHeadline}
          sub={bannerSub}
          chips={[
            { label: "Matriz Humana", status: sourceStatus(matrizMetrics) },
            { label: "Solides", status: sourceStatus(solidesMetrics) },
          ]}
        />

        <div>
          <NarrLabel step="01" label="Por Fonte" desc="Comparativo entre as duas bases" />
          <div className="grid g2">
            <LtvCard
              name="Matriz Humana"
              subtitle={loadingMatriz ? "carregando…" : periodLabel}
              active={matrizMetrics?.assinaturas_ativas ?? 0}
              mrr={MOCK_MRR_MATRIZ}
              ltv={MOCK_MRR_MATRIZ * 12}
              churn={MOCK_CHURN_MATRIZ}
              status={matrizMetrics ? "green" : "amber"}
              sparkData={SPARK_MOCK}
            />
            <LtvCard
              name="Solides"
              subtitle={loadingSolides ? "carregando…" : periodLabel}
              active={solidesMetrics?.assinaturas_ativas ?? 0}
              mrr={MOCK_MRR_SOLIDES}
              ltv={MOCK_MRR_SOLIDES * 12}
              churn={MOCK_CHURN_SOLIDES}
              status={solidesMetrics ? "green" : "amber"}
              sparkData={SPARK_MOCK}
            />
          </div>
        </div>

        <div>
          <NarrLabel step="02" label="Movimento do Mês" />
          <div className="grid g4">
            <StatCard
              icon={ICONS.users}
              title="Novos Clientes"
              value={novasTotal.toLocaleString("pt-BR")}
              status="green"
              foot={`no período selecionado`}
            />
            <StatCard
              icon={ICONS.mrr}
              title="Receita Recorrente"
              value={`R$ ${mrrTotal.toLocaleString("pt-BR")}`}
              status="green"
              foot="MRR combinado"
            />
            <StatCard
              icon={ICONS.churn}
              title="Churn Médio"
              value={`${churnMedio}%`}
              status={parseFloat(churnMedio) > 3 ? "amber" : "green"}
              foot="média das fontes"
            />
            <StatCard
              icon={ICONS.ratio}
              title="LTV/CAC"
              value={`${MOCK_LTV_CAC}×`}
              status={MOCK_LTV_CAC >= 3 ? "green" : "amber"}
              foot="meta &gt; 3×"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
