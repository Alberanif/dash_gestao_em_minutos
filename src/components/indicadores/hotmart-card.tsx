"use client";

import { useState } from "react";
import { HotmartVendasChart } from "./trend-charts";
import { KpiCell } from "./kpi-cell";
import type { GlobalHotmartMetrics, DailyPoint } from "@/types/indicadores";

const PAGE_SIZE = 5;

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

interface HotmartCardProps {
  hotmartState: SectionState<GlobalHotmartMetrics>;
  dailyState: SectionState<DailyPoint[]>;
}

function fmtBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}


function CardHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--border-vis)" }}>
      <div style={{ width: 32, height: 32, background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ color: "var(--orange)", fontSize: 14, fontWeight: 700 }}>H</span>
      </div>
      <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 600 }}>Hotmart</span>
      <span style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", color: "var(--orange)", fontSize: 10, borderRadius: 4, padding: "2px 7px" }}>Vendas</span>
    </div>
  );
}

function SkeletonBox({ height, width = "100%" }: { height: number; width?: string }) {
  return (
    <div style={{ height, width, background: "var(--surface-2)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

export function HotmartCard({ hotmartState, dailyState }: HotmartCardProps) {
  const [page, setPage] = useState(0);

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border-vis)",
    borderRadius: 10,
    overflow: "hidden" as const,
  };

  if (hotmartState.loading) {
    return (
      <div style={cardStyle}>
        <CardHeader />
        <div style={{ padding: 20, display: "flex", flexDirection: "column" as const, gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <SkeletonBox height={72} />
            <SkeletonBox height={72} />
          </div>
          <SkeletonBox height={180} />
        </div>
      </div>
    );
  }

  if (hotmartState.error || !hotmartState.data) {
    return (
      <div style={cardStyle}>
        <CardHeader />
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: "var(--red)" }}>Erro ao carregar dados do Hotmart.</p>
        </div>
      </div>
    );
  }

  const d = hotmartState.data;
  const sortedProducts = [...d.products].sort((a, b) => b.sales_count - a.sales_count);
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedProducts = sortedProducts.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const hasMultipleProducts = d.products.length > 1;
  const isPaginated = sortedProducts.length > PAGE_SIZE;

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 8px",
    color: "var(--text-3)",
    fontWeight: 600,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "1px solid var(--border-vis)",
  };

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "1px solid var(--border-vis)",
    background: disabled ? "transparent" : "var(--surface-2)",
    color: disabled ? "var(--text-3)" : "var(--text-2)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    padding: 0,
  });

  return (
    <div style={cardStyle}>
      <CardHeader />
      <div style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <KpiCell label="Receita BRL" value={fmtBRL(d.total_revenue)} accent="var(--emerald)" large />
          <KpiCell label="Vendas BRL" value={fmtNum(d.total_sales_brl)} accent="var(--orange)" large />
          <KpiCell label="Vendas Ext." value={fmtNum(d.total_sales_foreign)} accent="var(--text-2)" />
        </div>

        {d.products.length > 0 && (
          <div style={{ marginTop: 20, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Produto</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Vendas</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Receita (BRL)</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((p) => (
                  <tr key={p.product_id} style={{ borderBottom: "1px solid var(--border-vis)" }}>
                    <td style={{ padding: 8, color: "var(--text)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.product_name}
                      {p.is_foreign_currency && (
                        <span style={{ marginLeft: 6, fontSize: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-vis)", color: "var(--text-3)", borderRadius: 4, padding: "1px 5px" }}>moeda ext.</span>
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: "right", fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>{fmtNum(p.sales_count)}</td>
                    <td style={{ padding: 8, textAlign: "right", fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>
                      {p.is_foreign_currency ? "—" : fmtBRL(p.revenue)}
                    </td>
                  </tr>
                ))}
                {hasMultipleProducts && (
                  <tr style={{ borderTop: "2px solid var(--border-vis)", background: "var(--surface)" }}>
                    <td style={{ padding: 8, color: "var(--text)", fontWeight: 700 }}>Total</td>
                    <td style={{ padding: 8, textAlign: "right", fontFamily: "'DM Mono', monospace", color: "var(--text)", fontWeight: 700 }}>{fmtNum(d.total_sales)}</td>
                    <td style={{ padding: 8, textAlign: "right", fontFamily: "'DM Mono', monospace", color: "var(--text)", fontWeight: 700 }}>{fmtBRL(d.total_revenue)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {isPaginated && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sortedProducts.length)} de {sortedProducts.length} produtos
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                    style={btnStyle(safePage === 0)}
                    aria-label="Página anterior"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M7.5 2.5L4.5 6L7.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "'DM Mono', monospace", minWidth: 40, textAlign: "center" }}>
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    disabled={safePage === totalPages - 1}
                    onClick={() => setPage(safePage + 1)}
                    style={btnStyle(safePage === totalPages - 1)}
                    aria-label="Próxima página"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <HotmartVendasChart data={dailyState.data ?? []} loading={dailyState.loading} />
      </div>
    </div>
  );
}
