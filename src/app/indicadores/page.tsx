"use client";

import "./indicadores.css";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { calcPresetDates, getActivePreset, type PresetKey } from "@/lib/utils/period-presets";
import { calcROAS, calcCPA, calcConversionRate } from "@/lib/utils/cross-metrics";
import { calcFunnelStages, calcConversionRates } from "@/lib/utils/funnel-metrics";
import type { GlobalMetrics, GlobalHotmartMetrics, GlobalLeadsMetrics, DailyPoint, FilterRecord } from "@/types/indicadores";
import { deriveSourceFlags } from "./source-flags";
import { HeroKpiCard } from "@/components/indicadores/hero-kpi-card";
import { HorizontalFunnelFlow } from "@/components/indicadores/horizontal-funnel-flow";
import { MetaAdsCard } from "@/components/indicadores/meta-ads-card";
import { HotmartCard } from "@/components/indicadores/hotmart-card";
import { LeadsSection } from "@/components/indicadores/leads-section";
import { FilterDropdown } from "@/components/indicadores/filter-dropdown";
import { FilterModal } from "@/components/indicadores/filter-modal";
import { IndicadoresEmptyState } from "@/components/indicadores/indicadores-empty-state";

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
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "var(--surface)",
          border: "1px solid var(--border-vis)",
          borderRadius: 8,
          padding: 3,
        }}
      >
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onPreset(key)}
            style={{
              padding: "4px 11px",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: activePreset === key ? "var(--blue)" : "transparent",
              color: activePreset === key ? "#fff" : "var(--text-3)",
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDate(e.target.value)}
          style={{
            fontSize: 12,
            padding: "5px 8px",
            width: 130,
            background: "var(--surface)",
            border: "1px solid var(--border-vis)",
            borderRadius: 6,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>até</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDate(e.target.value)}
          style={{
            fontSize: 12,
            padding: "5px 8px",
            width: 130,
            background: "var(--surface)",
            border: "1px solid var(--border-vis)",
            borderRadius: 6,
            color: "var(--text)",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Section narrative ─────────────────────────────────────────────────────────

function SectionNarrative({ step, label, desc }: { step: string; label: string; desc: string | React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.05em" }}>
          {step}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-2)" }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{desc}</span>
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

  const [metaState, setMetaState] = useState<SectionState<GlobalMetrics>>(initialSection());
  const [hotmartState, setHotmartState] = useState<SectionState<GlobalHotmartMetrics>>(initialSection());
  const [leadsState, setLeadsState] = useState<SectionState<GlobalLeadsMetrics>>(initialSection());
  const [dailyState, setDailyState] = useState<SectionState<DailyPoint[]>>(initialSection());

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
    // Derive which sources are actually configured in this filter
    const { hasMetaFilter, hasHotmartFilter, hasLeadsFilter } = filter
      ? deriveSourceFlags(filter)
      : { hasMetaFilter: false, hasHotmartFilter: false, hasLeadsFilter: false };

    const ZEROED_LEADS: GlobalLeadsMetrics = { total: 0, by_event: [], by_source: [] };

    // Immediately zero out states for unconfigured sources (no loading spinner)
    setMetaState(hasMetaFilter ? initialSection() : { data: ZEROED_META, loading: false, error: false });
    setHotmartState(hasHotmartFilter ? initialSection() : { data: ZEROED_HOTMART, loading: false, error: false });
    setLeadsState(hasLeadsFilter ? initialSection() : { data: ZEROED_LEADS, loading: false, error: false });
    setDailyState(initialSection());

    let params = `?start_date=${start}&end_date=${end}`;
    if (filter) {
      filter.meta_ads_terms.forEach((t) => { params += `&meta_terms[]=${encodeURIComponent(t)}`; });
      filter.hotmart_products.forEach((p) => { params += `&product_ids[]=${encodeURIComponent(p.product_id)}`; });
      (filter.captacao_leads_eventos ?? []).forEach((e) => { params += `&eventos[]=${encodeURIComponent(e)}`; });
    }
    if (offerCode) {
      params += `&offer_code=${encodeURIComponent(offerCode)}`;
    }

    let leadsParams = `?start_date=${start}&end_date=${end}`;
    if (filter) {
      (filter.captacao_leads_eventos ?? []).forEach((e) => { leadsParams += `&eventos[]=${encodeURIComponent(e)}`; });
    }

    // Fetch all four sources in parallel; skip unconfigured sources with Promise.resolve(null)
    const jsonOrThrow = (r: Response) => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    };

    const [leadsRes, dailyRes, metaRes, hotmartRes] = await Promise.allSettled([
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

  // ── Derived source flags ──────────────────────────────────────────────────

  const { hasMetaFilter, hasHotmartFilter } = activeFilter
    ? deriveSourceFlags(activeFilter)
    : { hasMetaFilter: false, hasHotmartFilter: false };

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
    <div className="ind-dark" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 48px" }}>
      {/* Dark header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "20px 0",
          borderBottom: "1px solid var(--border-vis)",
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: "var(--text-3)",
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
          <div style={{ width: 1, height: 16, background: "var(--border-vis)" }} />
          <h1 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text)", margin: 0 }}>
            Indicadores
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

          {/* Z-1: Hero KPIs — 3 columns */}
          <div>
            <SectionNarrative step="01" label="Resultado" desc="Desempenho consolidado do período selecionado" />
            <div className="z-row-3col">
              <HeroKpiCard
                label="ROAS"
                value={roas !== null ? `${fmtDecimal(roas, 2)}×` : "—"}
                subtitle="Receita ÷ Investimento"
                accent="var(--violet)"
                loading={heroLoading}
              />
              <HeroKpiCard
                label="Receita BRL"
                value={hotmartData ? fmtBRL(hotmartData.total_revenue) : "—"}
                subtitle="via Hotmart"
                accent="var(--emerald)"
                loading={heroLoading}
              />
              <HeroKpiCard
                label="Total de Vendas"
                value={hotmartData ? fmtNum(hotmartData.total_sales) : "—"}
                subtitle="total de conversões"
                accent="var(--orange)"
                loading={heroLoading}
              />
            </div>
          </div>

          {/* Z-2: Horizontal funnel — full width */}
          {funnelStages && funnelRates && (
            <div>
              <SectionNarrative step="02" label="Jornada de Conversão" desc="Do investimento até a venda" />
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
            </div>
          )}

          {/* Z-3: Meta Ads + Hotmart — 2 columns */}
          <div>
            <SectionNarrative step="03" label="Plataformas" desc="Detalhe por fonte de dados" />
            <div className="z-row-2col">
              <MetaAdsCard metaState={metaState} dailyState={dailyState} hasMetaFilter={hasMetaFilter} />
              <HotmartCard
                hotmartState={hotmartState}
                dailyState={dailyState}
                accountId={accountId}
                selectedProductId={activeProductForOffer}
                onOfferCodeChange={handleOfferCodeChange}
                hasHotmartFilter={hasHotmartFilter}
              />
            </div>
          </div>

          {/* Z-4: Captação de Leads — full width */}
          <div>
            <SectionNarrative
              step="04"
              label="Captação de Leads"
              desc="Novos leads que entraram no funil · Dados não filtrados"
            />
            <div className="z-row">
              <LeadsSection leadsState={leadsState} dailyState={dailyState} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
