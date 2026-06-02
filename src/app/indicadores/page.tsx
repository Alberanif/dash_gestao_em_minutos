"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { calcPresetDates, getActivePreset, type PresetKey } from "@/lib/utils/period-presets";
import type { GlobalMetrics, GlobalHotmartMetrics, GlobalLeadsMetrics, DailyPoint } from "@/types/indicadores";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "28d", label: "28d" },
  { key: "90d", label: "90d" },
  { key: "mes-atual", label: "Mês atual" },
  { key: "mes-anterior", label: "Mês anterior" },
];

// ── Section skeleton ──────────────────────────────────────────────────────────

function SectionSkeleton({ title, accent }: { title: string; accent: string }) {
  return (
    <section
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
          borderLeft: `3px solid ${accent}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>{title}</span>
      </div>
      <div style={{ padding: "24px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 72,
              borderRadius: "var(--radius-card)",
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    </section>
  );
}

// ── Period controls ───────────────────────────────────────────────────────────

interface PeriodControlsProps {
  startDate: string;
  endDate: string;
  activePreset: PresetKey | null;
  onPreset: (key: PresetKey) => void;
  onStartDate: (v: string) => void;
  onEndDate: (v: string) => void;
}

function PeriodControls({ startDate, endDate, activePreset, onPreset, onStartDate, onEndDate }: PeriodControlsProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onPreset(key)}
            style={{
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid",
              cursor: "pointer",
              background: activePreset === key ? "var(--color-primary)" : "var(--color-surface)",
              color: activePreset === key ? "#fff" : "var(--color-text-muted)",
              borderColor: activePreset === key ? "var(--color-primary)" : "var(--color-border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDate(e.target.value)}
          className="field-control"
          style={{ fontSize: 12, padding: "4px 8px", width: 130 }}
        />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>até</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDate(e.target.value)}
          className="field-control"
          style={{ fontSize: 12, padding: "4px 8px", width: 130 }}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

function initialSection<T>(): SectionState<T> {
  return { data: null, loading: true, error: false };
}

export default function IndicadoresPage() {
  const today = todayStr();
  const defaultDates = calcPresetDates("28d", today);

  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [endDate, setEndDate] = useState(defaultDates.endDate);
  const [activePreset, setActivePreset] = useState<PresetKey | null>("28d");

  const [metaState, setMetaState] = useState<SectionState<GlobalMetrics>>(initialSection());
  const [hotmartState, setHotmartState] = useState<SectionState<GlobalHotmartMetrics>>(initialSection());
  const [leadsState, setLeadsState] = useState<SectionState<GlobalLeadsMetrics>>(initialSection());
  const [dailyState, setDailyState] = useState<SectionState<DailyPoint[]>>(initialSection());

  const fetchAll = useCallback(async (start: string, end: string) => {
    setMetaState(initialSection());
    setHotmartState(initialSection());
    setLeadsState(initialSection());
    setDailyState(initialSection());

    const params = `?start_date=${start}&end_date=${end}`;

    const [metaRes, hotmartRes, leadsRes, dailyRes] = await Promise.allSettled([
      fetch(`/api/indicadores/metrics${params}`).then((r) => r.json()),
      fetch(`/api/indicadores/hotmart${params}`).then((r) => r.json()),
      fetch(`/api/indicadores/leads${params}`).then((r) => r.json()),
      fetch(`/api/indicadores/daily${params}`).then((r) => r.json()),
    ]);

    setMetaState({
      data: metaRes.status === "fulfilled" ? metaRes.value : null,
      loading: false,
      error: metaRes.status === "rejected",
    });
    setHotmartState({
      data: hotmartRes.status === "fulfilled" ? hotmartRes.value : null,
      loading: false,
      error: hotmartRes.status === "rejected",
    });
    setLeadsState({
      data: leadsRes.status === "fulfilled" ? leadsRes.value : null,
      loading: false,
      error: leadsRes.status === "rejected",
    });
    setDailyState({
      data: dailyRes.status === "fulfilled" ? dailyRes.value : null,
      loading: false,
      error: dailyRes.status === "rejected",
    });
  }, []);

  useEffect(() => {
    fetchAll(startDate, endDate);
  }, [startDate, endDate, fetchAll]);

  function handlePreset(key: PresetKey) {
    const dates = calcPresetDates(key, today);
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
    setActivePreset(key);
  }

  function handleStartDate(v: string) {
    setStartDate(v);
    setActivePreset(getActivePreset(v, endDate, today));
  }

  function handleEndDate(v: string) {
    setEndDate(v);
    setActivePreset(getActivePreset(startDate, v, today));
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 48px" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "20px 0",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Módulos
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            Indicadores
          </h1>
        </div>

        <PeriodControls
          startDate={startDate}
          endDate={endDate}
          activePreset={activePreset}
          onPreset={handlePreset}
          onStartDate={handleStartDate}
          onEndDate={handleEndDate}
        />
      </header>

      {/* Dashboard sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* 1. Desempenho Geral */}
        {(metaState.loading || hotmartState.loading) ? (
          <SectionSkeleton title="Desempenho Geral" accent="#7c3aed" />
        ) : (
          <section
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", borderLeft: "3px solid #7c3aed" }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>Desempenho Geral</span>
            </div>
            <div style={{ padding: "24px 20px", color: "var(--color-text-muted)", fontSize: 13 }}>
              {metaState.error && hotmartState.error ? "Erro ao carregar dados." : "KPIs e funil de conversão disponíveis em breve."}
            </div>
          </section>
        )}

        {/* 2. Meta Ads */}
        {metaState.loading ? (
          <SectionSkeleton title="Meta Ads" accent="#2563eb" />
        ) : (
          <section
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", borderLeft: "3px solid #2563eb" }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>Meta Ads</span>
            </div>
            <div style={{ padding: "24px 20px", color: "var(--color-text-muted)", fontSize: 13 }}>
              {metaState.error ? "Erro ao carregar dados de Meta Ads." : "Métricas e gráfico de investimento disponíveis em breve."}
            </div>
          </section>
        )}

        {/* 3. Hotmart */}
        {hotmartState.loading ? (
          <SectionSkeleton title="Hotmart" accent="#ea580c" />
        ) : (
          <section
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", borderLeft: "3px solid #ea580c" }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>Hotmart</span>
            </div>
            <div style={{ padding: "24px 20px", color: "var(--color-text-muted)", fontSize: 13 }}>
              {hotmartState.error ? "Erro ao carregar dados Hotmart." : "Vendas e gráfico diário disponíveis em breve."}
            </div>
          </section>
        )}

        {/* 4. Coleta de Leads */}
        {leadsState.loading ? (
          <SectionSkeleton title="Coleta de Leads" accent="#0891b2" />
        ) : (
          <section
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", borderLeft: "3px solid #0891b2" }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>Coleta de Leads</span>
            </div>
            <div style={{ padding: "24px 20px", color: "var(--color-text-muted)", fontSize: 13 }}>
              {leadsState.error ? "Erro ao carregar dados de captação de leads." : "Total de captações e breakdown por evento disponíveis em breve."}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
