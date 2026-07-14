"use client";

import "./indicadores.css";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { calcPresetDates, getActivePreset, type PresetKey } from "@/lib/utils/period-presets";
import { calcROAS, calcCPA, calcConversionRate } from "@/lib/utils/cross-metrics";
import { calcFunnelStages, calcConversionRates } from "@/lib/utils/funnel-metrics";
import type { GlobalMetrics, GlobalHotmartMetrics, GlobalLeadsMetrics, DailyPoint, FilterRecord, ConversionSourceRow } from "@/types/indicadores";
import { expandFilter, toSearchParams } from "@/lib/indicadores/filter-expansion";
import { HeroKpiCard } from "@/components/indicadores/hero-kpi-card";
import { HorizontalFunnelFlow } from "@/components/indicadores/horizontal-funnel-flow";
import { PlatformsCard } from "@/components/indicadores/platforms-card";
import { LeadsSection } from "@/components/indicadores/leads-section";
import { ConversionSourcesCard } from "@/components/indicadores/conversion-sources-card";
import { FilterDropdown } from "@/components/indicadores/filter-dropdown";
import { FilterModal } from "@/components/indicadores/filter-modal";
import { IndicadoresEmptyState } from "@/components/indicadores/indicadores-empty-state";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { AgentFAB } from "@/components/agent/AgentFAB";
import { AgentDrawer } from "@/components/agent/AgentDrawer";
import { ChatMessageList } from "@/components/agent/ChatMessageList";
import { ChatInput } from "@/components/agent/ChatInput";

const LS_FILTER_ID = "indicadores_active_filter_id";

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

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function fmtDecimal(n: number | null, digits = 2): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(digits);
}

// ── Section state ─────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

function initialSection<T>(): SectionState<T> {
  return { data: null, loading: true, error: false };
}

// ── Zeroed states for unconfigured sources ────────────────────────────────────

const ZEROED_META: GlobalMetrics = {
  meta_spend: 0,
  meta_cpm: 0,
  meta_ctr: 0,
  meta_leads: 0,
  meta_checkout: 0,
  meta_impressions: 0,
  meta_link_clicks: 0,
  meta_page_views: 0,
  meta_connect_rate: null,
  meta_lp_conversion: null,
  meta_cpl_traffic: null,
};

const ZEROED_HOTMART: GlobalHotmartMetrics = {
  products: [],
  total_sales: 0,
  total_sales_brl: 0,
  total_sales_foreign: 0,
  total_revenue: 0,
};

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
  const dateInputStyle: React.CSSProperties = {
    fontFamily: "inherit",
    fontSize: 12,
    padding: "6px 9px",
    background: "var(--surface)",
    border: "1px solid var(--border-vis)",
    borderRadius: 7,
    color: "var(--text)",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "var(--surface)",
          border: "1px solid var(--border-vis)",
          borderRadius: 9,
          padding: 3,
        }}
      >
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onPreset(key)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              background: activePreset === key ? "#2a2f38" : "transparent",
              color: activePreset === key ? "var(--text-strong)" : "var(--text-muted)",
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDate(e.target.value)}
          style={dateInputStyle}
        />
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>até</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDate(e.target.value)}
          style={dateInputStyle}
        />
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 11, marginBottom: 15 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-4)" }}>{index}</span>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", margin: 0, letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <span style={{ fontSize: 12, color: "var(--text-3)" }}>{desc}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IndicadoresPage() {
  const today = todayStr();
  const defaultDates = calcPresetDates("28d", today);

  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [endDate, setEndDate] = useState(defaultDates.endDate);
  const [activePreset, setActivePreset] = useState<PresetKey | null>("28d");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const { messages, isStreaming, activeQuery, sendMessage, clearHistory } = useAgentChat();

  const [metaState, setMetaState] = useState<SectionState<GlobalMetrics>>(initialSection());
  const [hotmartState, setHotmartState] = useState<SectionState<GlobalHotmartMetrics>>(initialSection());
  const [leadsState, setLeadsState] = useState<SectionState<GlobalLeadsMetrics>>(initialSection());
  const [dailyState, setDailyState] = useState<SectionState<DailyPoint[]>>(initialSection());
  const [conversionSourcesState, setConversionSourcesState] = useState<SectionState<ConversionSourceRow[]>>(initialSection());

  const [accountId, setAccountId] = useState<string>("");
  const [filters, setFilters] = useState<FilterRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterRecord | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterEditTarget, setFilterEditTarget] = useState<FilterRecord | null>(null);

  // Offer filter — live, not persisted
  const [activeOfferCode, setActiveOfferCode] = useState<string | null>(null);
  const [activeProductForOffer, setActiveProductForOffer] = useState<string | null>(null);

  // Bootstrap: fetch account_id + filters, restore active filter from localStorage
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((accounts: { id: string }[]) => {
        if (!Array.isArray(accounts) || accounts.length === 0) return;
        const id = accounts[0].id;
        setAccountId(id);
        return fetch(`/api/indicadores/filters?account_id=${id}`)
          .then((r) => r.json())
          .then((data: FilterRecord[]) => {
            if (!Array.isArray(data)) return;
            setFilters(data);
            const savedId = localStorage.getItem(LS_FILTER_ID);
            if (savedId) {
              const match = data.find((f) => f.id === savedId);
              if (match) setActiveFilter(match);
              else localStorage.removeItem(LS_FILTER_ID); // deleted by another user
            }
          });
      })
      .catch(() => {});
  }, []);

  const fetchAll = useCallback(async (
    start: string,
    end: string,
    filter: FilterRecord | null,
    offerCode: string | null = null,
  ) => {
    // O que este filtro significa — definido em um único lugar, compartilhado
    // com o agente. Enquanto houver duas cópias dessa lógica, elas divergem.
    const expanded = expandFilter(filter, offerCode);
    const { meta: hasMetaFilter, hotmart: hasHotmartFilter, leads: hasLeadsFilter } = expanded.sources;

    const ZEROED_LEADS: GlobalLeadsMetrics = { total: 0, by_event: [], by_source: [] };

    const ZEROED_SOURCES: ConversionSourceRow[] = [];

    // Immediately zero out states for unconfigured sources (no loading spinner)
    setMetaState(hasMetaFilter ? initialSection() : { data: ZEROED_META, loading: false, error: false });
    setHotmartState(hasHotmartFilter ? initialSection() : { data: ZEROED_HOTMART, loading: false, error: false });
    setLeadsState(hasLeadsFilter ? initialSection() : { data: ZEROED_LEADS, loading: false, error: false });
    setConversionSourcesState(hasHotmartFilter ? initialSection() : { data: ZEROED_SOURCES, loading: false, error: false });
    setDailyState(initialSection());

    const period = { startDate: start, endDate: end };
    const params = `?${toSearchParams(expanded, period)}`;

    // O endpoint de leads só filtra por evento: mandar produto, termo de Meta
    // ou oferta para ele não restringe nada — é escopo, não ruído.
    const leadsParams = `?${toSearchParams(
      { ...expanded, metaTerms: [], productIds: [], offerCode: null },
      period,
    )}`;

    // Fetch all four sources in parallel; skip unconfigured sources with Promise.resolve(null)
    const jsonOrThrow = (r: Response) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    };

    const [leadsRes, dailyRes, metaRes, hotmartRes, sourcesRes] = await Promise.allSettled([
      hasLeadsFilter
        ? fetch(`/api/indicadores/leads${leadsParams}`).then(jsonOrThrow)
        : Promise.resolve(null),
      fetch(`/api/indicadores/daily${params}`).then(jsonOrThrow),
      hasMetaFilter
        ? fetch(`/api/indicadores/metrics${params}`).then(jsonOrThrow)
        : Promise.resolve(null),
      hasHotmartFilter
        ? fetch(`/api/indicadores/hotmart${params}`).then(jsonOrThrow)
        : Promise.resolve(null),
      hasHotmartFilter
        ? fetch(`/api/indicadores/conversion-sources${params}`).then(jsonOrThrow)
        : Promise.resolve(null),
    ]);

    setLeadsState({
      data: leadsRes.status === "fulfilled" && leadsRes.value !== null ? leadsRes.value : ZEROED_LEADS,
      loading: false,
      error: leadsRes.status === "rejected",
    });
    setDailyState({
      data: dailyRes.status === "fulfilled" ? dailyRes.value : null,
      loading: false,
      error: dailyRes.status === "rejected",
    });
    setMetaState({
      data: metaRes.status === "fulfilled" && metaRes.value !== null ? metaRes.value : ZEROED_META,
      loading: false,
      error: metaRes.status === "rejected",
    });
    setHotmartState({
      data: hotmartRes.status === "fulfilled" && hotmartRes.value !== null ? hotmartRes.value : ZEROED_HOTMART,
      loading: false,
      error: hotmartRes.status === "rejected",
    });
    setConversionSourcesState({
      data: sourcesRes.status === "fulfilled" && sourcesRes.value !== null ? sourcesRes.value : ZEROED_SOURCES,
      loading: false,
      error: sourcesRes.status === "rejected",
    });
  }, []);

  useEffect(() => {
    if (!activeFilter) return;
    fetchAll(startDate, endDate, activeFilter, activeOfferCode);
  }, [startDate, endDate, activeFilter, activeOfferCode, fetchAll]);

  function handleSelectFilter(filter: FilterRecord | null) {
    setActiveFilter(filter);
    if (filter) localStorage.setItem(LS_FILTER_ID, filter.id);
    else localStorage.removeItem(LS_FILTER_ID);
  }

  function handleFilterSaved(saved: FilterRecord) {
    setFilters((prev) => {
      const idx = prev.findIndex((f) => f.id === saved.id);
      return idx >= 0 ? prev.map((f) => (f.id === saved.id ? saved : f)) : [...prev, saved];
    });
    handleSelectFilter(saved);
    setFilterModalOpen(false);
    setFilterEditTarget(null);
  }

  async function handleDeleteFilter(filter: FilterRecord) {
    await fetch(`/api/indicadores/filters/${filter.id}`, { method: "DELETE" });
    setFilters((prev) => prev.filter((f) => f.id !== filter.id));
    if (activeFilter?.id === filter.id) handleSelectFilter(null);
  }

  function handleOfferCodeChange(offerCode: string | null, productId: string | null) {
    setActiveOfferCode(offerCode);
    setActiveProductForOffer(productId);
  }

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

  function handleCloseDrawer() {
    setDrawerOpen(false);
    clearHistory();
  }

  function handleSend(text: string) {
    if (!activeFilter) return;
    sendMessage(text, {
      filterId: activeFilter.id,
      offerCode: activeOfferCode,
      startDate,
      endDate,
    });
  }

  // ── Derived source flags ──────────────────────────────────────────────────

  const { meta: hasMetaFilter, hotmart: hasHotmartFilter } = expandFilter(activeFilter).sources;

  // ── Derived data for Z-1 and Z-2 ──────────────────────────────────────────

  const metaData = metaState.data;
  const hotmartData = hotmartState.data;

  // Guard metric inputs by source flags: when a source is not configured, pass
  // null instead of the zeroed placeholder so cross-source metrics display '--'
  // rather than 0, Infinity, or any other misleading value.
  const roas = calcROAS({
    metaSpend: hasMetaFilter ? (metaData?.meta_spend ?? null) : null,
    hotmartTotalRevenue: hasHotmartFilter ? (hotmartData?.total_revenue ?? null) : null,
  });
  const cpa = calcCPA({
    metaSpend: hasMetaFilter ? (metaData?.meta_spend ?? null) : null,
    hotmartTotalSales: hasHotmartFilter ? (hotmartData?.total_sales ?? null) : null,
  });
  const convRate = calcConversionRate({
    metaLeads: hasMetaFilter ? (metaData?.meta_leads ?? null) : null,
    hotmartTotalSales: hasHotmartFilter ? (hotmartData?.total_sales ?? null) : null,
  });

  const funnelStages = calcFunnelStages(
    hasMetaFilter ? metaData : null,
    hasHotmartFilter ? hotmartData : null,
  );
  const funnelRates = funnelStages ? calcConversionRates(funnelStages) : null;

  const heroLoading = metaState.loading || hotmartState.loading;

  return (
    <div className="ind-dark" style={{ maxWidth: 1220, margin: "0 auto", padding: "0 28px 64px" }}>
      {/* Header / control bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          padding: "22px 0 18px",
          borderBottom: "1px solid var(--border)",
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Módulos
          </Link>
          <div style={{ width: 1, height: 18, background: "#262b33" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-strong)", margin: 0 }}>
            Indicadores
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <PeriodControls
            startDate={startDate}
            endDate={endDate}
            activePreset={activePreset}
            onPreset={handlePreset}
            onStartDate={handleStartDate}
            onEndDate={handleEndDate}
          />
          {accountId && (
            <FilterDropdown
              filters={filters}
              activeFilter={activeFilter}
              onSelect={handleSelectFilter}
              onNew={() => { setFilterEditTarget(null); setFilterModalOpen(true); }}
              onEdit={(f) => { setFilterEditTarget(f); setFilterModalOpen(true); }}
              onDelete={handleDeleteFilter}
            />
          )}
        </div>
      </header>

      {filterModalOpen && accountId && (
        <FilterModal
          accountId={accountId}
          editTarget={filterEditTarget}
          onSave={handleFilterSaved}
          onCancel={() => { setFilterModalOpen(false); setFilterEditTarget(null); }}
        />
      )}

      {/* Dashboard content or empty state */}
      {activeFilter === null ? (
        <IndicadoresEmptyState
          onOpenFilter={() => { setFilterEditTarget(null); setFilterModalOpen(true); }}
        />
      ) : (
        <div className="z-layout">

          {/* 01 · Resultado — 3 hero KPIs */}
          <section>
            <SectionHeader index="01" title="Resultado" desc="Desempenho consolidado do período" />
            <div className="z-row-3col">
              <HeroKpiCard
                label="ROAS"
                value={roas !== null ? `${fmtDecimal(roas, 2)}×` : "—"}
                subtitle="Receita ÷ Investimento"
                dotColor="var(--violet)"
                loading={heroLoading}
              />
              <HeroKpiCard
                label="Receita BRL"
                value={hotmartData ? fmtBRL(hotmartData.total_revenue) : "—"}
                subtitle="via Hotmart"
                dotColor="var(--orange)"
                loading={heroLoading}
              />
              <HeroKpiCard
                label="Total de Vendas"
                value={hotmartData ? fmtNum(hotmartData.total_sales) : "—"}
                subtitle="total de conversões"
                dotColor="var(--orange)"
                loading={heroLoading}
              />
            </div>
          </section>

          {/* 02 · Jornada de Conversão — full width */}
          {funnelStages && funnelRates && (
            <section>
              <SectionHeader index="02" title="Jornada de Conversão" desc="Do investimento até a venda" />
              <div className="z-row">
                <HorizontalFunnelFlow
                  stages={funnelStages}
                  rates={funnelRates}
                  metaSpend={hasMetaFilter ? (metaData?.meta_spend ?? null) : null}
                  metaCpl={hasMetaFilter ? (metaData?.meta_cpl_traffic ?? null) : null}
                  metaCpm={hasMetaFilter ? (metaData?.meta_cpm ?? null) : null}
                  metaConvRate={convRate}
                  cpa={cpa}
                />
              </div>
            </section>
          )}

          {/* 03 · Plataformas — card com abas + origens de conversão */}
          <section>
            <SectionHeader index="03" title="Plataformas" desc="Detalhe por fonte de dados" />
            <div className="z-row">
              <PlatformsCard
                metaState={metaState}
                hotmartState={hotmartState}
                dailyState={dailyState}
                accountId={accountId}
                selectedProductId={activeProductForOffer}
                onOfferCodeChange={handleOfferCodeChange}
                hasMetaFilter={hasMetaFilter}
                hasHotmartFilter={hasHotmartFilter}
              />
            </div>
            {hasHotmartFilter && (
              <div className="z-row" style={{ marginTop: 14 }}>
                <ConversionSourcesCard state={conversionSourcesState} />
              </div>
            )}
          </section>

          {/* 04 · Captação de Leads — full width */}
          <section>
            <SectionHeader
              index="04"
              title="Captação de Leads"
              desc="Novos leads que entraram no funil · dados não filtrados"
            />
            <div className="z-row">
              <LeadsSection leadsState={leadsState} dailyState={dailyState} />
            </div>
          </section>

        </div>
      )}

      {/* Agent FAB + Drawer — position: fixed, fora do fluxo do layout */}
      <AgentFAB onClick={() => setDrawerOpen(true)} />
      <AgentDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        filterName={activeFilter?.name ?? null}
        startDate={startDate}
        endDate={endDate}
        offerCode={activeOfferCode}
      >
        <ChatMessageList messages={messages} activeQuery={activeQuery} />
        <ChatInput onSend={handleSend} isStreaming={isStreaming} />
      </AgentDrawer>
    </div>
  );
}
