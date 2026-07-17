"use client";

import React from "react";
import { calcROAS } from "@/lib/utils/cross-metrics";
import type {
  ConversionSourcesWithWeeks,
  GlobalHotmartMetricsWithWeeks,
  GlobalLeadsMetricsWithWeeks,
  GlobalMetricsWithWeeks,
  WeekWindow,
} from "@/types/indicadores";

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

export interface PlanilhaViewProps {
  weeks: WeekWindow[];
  metaState: SectionState<GlobalMetricsWithWeeks>;
  hotmartState: SectionState<GlobalHotmartMetricsWithWeeks>;
  leadsState: SectionState<GlobalLeadsMetricsWithWeeks>;
  sourcesState: SectionState<ConversionSourcesWithWeeks>;
  hasMetaFilter: boolean;
  hasHotmartFilter: boolean;
  hasLeadsFilter: boolean;
}

// ── Formatters — mesmas convenções dos cards do Dashboard ────────────────────

function fmtBRL(n: number | null): string {
  if (n === null) return "—";
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number | null): string {
  if (n === null) return "—";
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtRoas(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(2)}×`;
}

/** "2026-07-06" → "06/07" para os cabeçalhos de coluna. */
function fmtDay(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

// ── Modelo de linha ───────────────────────────────────────────────────────────

type Fmt = (n: number | null) => string;

interface RowSpec {
  label: string;
  unit: string;
  /** [Total, Semana 1..N] — null renderiza como "—". */
  values: Array<number | null>;
  fmt: Fmt;
  testid?: string;
  isTotal?: boolean;
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const STICKY_CELL: React.CSSProperties = {
  position: "sticky",
  left: 0,
  background: "var(--surface)",
  textAlign: "left",
  padding: "9px 16px",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
  zIndex: 1,
};

const VALUE_CELL: React.CSSProperties = {
  padding: "9px 16px",
  borderBottom: "1px solid var(--border)",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  fontSize: 13,
  color: "var(--text)",
};

function BlockHeaderRow({
  title,
  columns,
  notConfigured,
}: {
  title: string;
  columns: number;
  notConfigured?: boolean;
}) {
  return (
    <tr>
      <th
        colSpan={columns}
        style={{
          ...STICKY_CELL,
          position: "static",
          background: "var(--surface-2)",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-vis)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            data-testid="planilha-block-title"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}
          >
            {title}
          </span>
          {notConfigured && (
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-3)" }}>
              não configurado neste filtro — dados zerados
            </span>
          )}
        </div>
      </th>
    </tr>
  );
}

function SkeletonRows({ rows, columns }: { rows: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} style={c === 0 ? STICKY_CELL : VALUE_CELL}>
              <div
                data-testid="planilha-skeleton"
                style={{
                  height: 14,
                  borderRadius: 6,
                  background: "var(--surface-2)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function ErrorRow({ message, columns }: { message: string; columns: number }) {
  return (
    <tr>
      <td colSpan={columns} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ color: "var(--red)", fontSize: 13 }}>{message}</span>
      </td>
    </tr>
  );
}

function DataRow({ row }: { row: RowSpec }) {
  return (
    <tr data-testid={row.testid}>
      <td
        style={{
          ...STICKY_CELL,
          fontSize: 13,
          fontWeight: row.isTotal ? 600 : 400,
          color: row.isTotal ? "var(--text-strong)" : "var(--text-2)",
        }}
      >
        {row.label}
        <span style={{ marginLeft: 7, fontSize: 11, color: "var(--text-4)" }}>{row.unit}</span>
      </td>
      {row.values.map((value, i) => (
        <td
          key={i}
          style={{
            ...VALUE_CELL,
            fontWeight: i === 0 || row.isTotal ? 600 : 400,
            color: i === 0 ? "var(--text-strong)" : VALUE_CELL.color,
          }}
        >
          {row.fmt(value)}
        </td>
      ))}
    </tr>
  );
}

function Block({
  title,
  state,
  rows,
  columns,
  errorMessage,
  notConfigured,
  skeletonRows,
}: {
  title: string;
  state: { loading: boolean; error: boolean };
  rows: RowSpec[];
  columns: number;
  errorMessage: string;
  notConfigured?: boolean;
  skeletonRows: number;
}) {
  return (
    <tbody>
      <BlockHeaderRow title={title} columns={columns} notConfigured={notConfigured} />
      {state.loading ? (
        <SkeletonRows rows={skeletonRows} columns={columns} />
      ) : state.error ? (
        <ErrorRow message={errorMessage} columns={columns} />
      ) : (
        rows.map((row) => <DataRow key={row.label} row={row} />)
      )}
    </tbody>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function PlanilhaView({
  weeks,
  metaState,
  hotmartState,
  leadsState,
  sourcesState,
  hasMetaFilter,
  hasHotmartFilter,
  hasLeadsFilter,
}: PlanilhaViewProps) {
  const columns = 2 + weeks.length; // Métrica + Total + semanas
  const meta = metaState.data;
  const hotmart = hotmartState.data;
  const leads = leadsState.data;
  const sources = sourcesState.data;

  // Uma célula por coluna: índice 0 é o Total do período, depois uma por semana.
  const perColumn = <T,>(total: T, byWeek: (weekIndex: number) => T): T[] => [
    total,
    ...weeks.map((_, i) => byWeek(i)),
  ];

  // ── Bloco 1 · Resumo — ROAS recalculado por coluna a partir dos brutos ──────
  const roasAt = (spend: number | null, revenue: number | null) =>
    calcROAS({
      metaSpend: hasMetaFilter ? spend : null,
      hotmartTotalRevenue: hasHotmartFilter ? revenue : null,
    });

  const resumoRows: RowSpec[] = [
    {
      label: "ROAS",
      unit: "×",
      fmt: fmtRoas,
      values: perColumn(
        roasAt(meta?.meta_spend ?? null, hotmart?.total_revenue ?? null),
        (i) => roasAt(meta?.weeks[i]?.meta_spend ?? null, hotmart?.weeks[i]?.total_revenue ?? null)
      ),
    },
    {
      label: "Receita BRL",
      unit: "R$",
      fmt: fmtBRL,
      values: perColumn(hotmart?.total_revenue ?? null, (i) => hotmart?.weeks[i]?.total_revenue ?? null),
    },
    {
      label: "Total de Vendas",
      unit: "n°",
      fmt: fmtNum,
      values: perColumn(hotmart?.total_sales ?? null, (i) => hotmart?.weeks[i]?.total_sales ?? null),
    },
  ];

  // ── Bloco 2 · Meta Ads — os 8 KPIs do card ──────────────────────────────────
  const metaRow = (
    label: string,
    unit: string,
    fmt: Fmt,
    pick: (m: NonNullable<typeof meta> | NonNullable<typeof meta>["weeks"][number]) => number | null
  ): RowSpec => ({
    label,
    unit,
    fmt,
    values: perColumn(meta ? pick(meta) : null, (i) => (meta?.weeks[i] ? pick(meta.weeks[i]) : null)),
  });

  const metaRows: RowSpec[] = [
    metaRow("Investimento", "R$", fmtBRL, (m) => m.meta_spend),
    metaRow("Leads Gerados", "n°", fmtNum, (m) => m.meta_leads),
    metaRow("CPM", "R$", fmtBRL, (m) => m.meta_cpm),
    metaRow("CTR", "%", fmtPct, (m) => m.meta_ctr),
    metaRow("CPL Tráfego", "R$", fmtBRL, (m) => m.meta_cpl_traffic),
    metaRow("Connect Rate", "%", fmtPct, (m) => m.meta_connect_rate),
    metaRow("Conv. LP", "%", fmtPct, (m) => m.meta_lp_conversion),
    metaRow("Checkout", "n°", fmtNum, (m) => m.meta_checkout),
  ];

  // ── Bloco 3 · Leads por origem — todas as origens, desc pelo Total ──────────
  const leadOrigins = [...(leads?.by_source ?? [])].sort((a, b) => b.count - a.count);
  const leadsRows: RowSpec[] = [
    ...leadOrigins.map(
      ({ source, count }): RowSpec => ({
        label: source,
        unit: "n°",
        fmt: fmtNum,
        testid: "planilha-leads-row",
        values: perColumn(
          count,
          (i) => leads?.weeks[i]?.by_source.find((s) => s.source === source)?.count ?? 0
        ),
      })
    ),
    {
      label: "Total de Leads",
      unit: "n°",
      fmt: fmtNum,
      isTotal: true,
      values: perColumn(leads?.total ?? null, (i) => leads?.weeks[i]?.total ?? null),
    },
  ];

  // ── Bloco 4 · Vendas por origem — todas as origens, desc pelo Total ─────────
  const saleOrigins = [...(sources?.sources ?? [])].sort((a, b) => b.count - a.count);
  const sumCounts = (rows: Array<{ count: number }>) => rows.reduce((sum, r) => sum + r.count, 0);
  const vendasRows: RowSpec[] = [
    ...saleOrigins.map(
      ({ source, count }): RowSpec => ({
        label: source,
        unit: "n°",
        fmt: fmtNum,
        testid: "planilha-vendas-row",
        values: perColumn(
          count,
          (i) => sources?.weeks[i]?.sources.find((s) => s.source === source)?.count ?? 0
        ),
      })
    ),
    {
      label: "Total de Vendas",
      unit: "n°",
      fmt: fmtNum,
      isTotal: true,
      testid: "planilha-vendas-total",
      values: perColumn(sources ? sumCounts(sources.sources) : null, (i) =>
        sources?.weeks[i] ? sumCounts(sources.weeks[i].sources) : null
      ),
    },
  ];

  const resumoState = {
    loading: metaState.loading || hotmartState.loading,
    error: hotmartState.error,
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 12,
        overflowX: "auto",
      }}
    >
      <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...STICKY_CELL, fontSize: 11, fontWeight: 600, color: "var(--text-label)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Métrica
            </th>
            <th style={{ ...VALUE_CELL, fontSize: 11, fontWeight: 600, color: "var(--text-label)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Total
            </th>
            {weeks.map((week) => (
              <th
                key={week.index}
                style={{ ...VALUE_CELL, fontSize: 11, fontWeight: 600, color: "var(--text-label)" }}
              >
                {`Semana ${week.index} · ${fmtDay(week.startDate)} – ${fmtDay(week.endDate)}`}
              </th>
            ))}
          </tr>
        </thead>

        <Block
          title="Resumo"
          state={resumoState}
          rows={resumoRows}
          columns={columns}
          errorMessage="Erro ao carregar dados da Hotmart."
          notConfigured={!hasHotmartFilter}
          skeletonRows={3}
        />
        <Block
          title="Meta Ads"
          state={metaState}
          rows={metaRows}
          columns={columns}
          errorMessage="Erro ao carregar dados do Meta Ads."
          notConfigured={!hasMetaFilter}
          skeletonRows={8}
        />
        <Block
          title="Leads por origem"
          state={leadsState}
          rows={leadsRows}
          columns={columns}
          errorMessage="Erro ao carregar dados de captação de leads."
          notConfigured={!hasLeadsFilter}
          skeletonRows={4}
        />
        <Block
          title="Vendas por origem"
          state={sourcesState}
          rows={vendasRows}
          columns={columns}
          errorMessage="Erro ao carregar origens de conversão."
          notConfigured={!hasHotmartFilter}
          skeletonRows={4}
        />
      </table>
    </div>
  );
}
