"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import type { FilterRecord } from "@/types/indicadores";
import { resolveDebriefingProducts } from "@/lib/indicadores/debriefing-products";
import type { DebriefingMetrics } from "@/lib/indicadores/service/debriefing";
import { selectDebriefingProducts, toggleProductSelection } from "@/lib/indicadores/debriefing-selection";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DebriefingViewProps {
  filter: FilterRecord | null;
  startDate: string;
  endDate: string;
  onEditFilter?: () => void;
}

function fmtBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// Rótulo de escala do eixo: marca de escala, não dado — fica inteiro.
function fmtBRLAxis(n: number): string {
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

const TICK = { fontSize: 10, fill: "var(--text-3)" };

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-vis)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

export function DebriefingView({ filter, startDate, endDate, onEditFilter }: DebriefingViewProps) {
  const [rawMetrics, setMetrics] = useState<DebriefingMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Vazio = "Todos". Estado local: volta para Todos ao trocar filtro/período.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const products = useMemo(() => (filter ? resolveDebriefingProducts(filter) : []), [filter]);
  const productsKey = JSON.stringify(products);

  useEffect(() => {
    setSelectedIds([]);
    setPanelOpen(false);
  }, [productsKey, startDate, endDate]);

  useEffect(() => {
    if (!panelOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPanelOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [panelOpen]);

  const metrics = useMemo(
    () => (rawMetrics ? selectDebriefingProducts(rawMetrics, selectedIds) : null),
    [rawMetrics, selectedIds]
  );

  const loadDebriefingData = useCallback(async () => {
    if (products.length === 0 || !startDate || !endDate) {
      setMetrics(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        products: JSON.stringify(products),
        start_date: startDate,
        end_date: endDate,
      });

      const res = await fetch(`/api/indicadores/debriefing?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erro ao carregar dados de Debriefing");
      }
      const data: DebriefingMetrics = await res.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsKey, startDate, endDate]);

  useEffect(() => {
    loadDebriefingData();
  }, [loadDebriefingData]);

  if (!filter) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)" }}>
        Nenhum filtro ativado. Selecione um dashboard acima.
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div
        data-testid="debriefing-empty-state"
        style={{
          margin: "24px 0",
          padding: "32px 24px",
          borderRadius: 12,
          border: "1px dashed var(--border-vis)",
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: "color-mix(in srgb, var(--violet) 15%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            color: "var(--violet)",
          }}
        >
          🎯
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            Nenhum Produto Principal Configurado
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-3)", maxWidth: 460 }}>
            Para visualizar as métricas de vendas do Produto Principal nesta aba de Debriefing, configure o produto principal nas opções do filtro deste dashboard.
          </p>
        </div>
        {onEditFilter && (
          <button
            onClick={onEditFilter}
            style={{
              marginTop: 6,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: "none",
              background: "var(--violet)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Configurar Produto Principal
          </button>
        )}
      </div>
    );
  }

  const single = products.length === 1 ? products[0] : null;
  const selectedCount = selectedIds.length === 0 ? products.length : selectedIds.length;
  const filtered = selectedCount < products.length;
  const allIds = products.map((p) => p.product_id);
  const nameOf = (id: string, fallback: string) =>
    rawMetrics?.products.find((p) => p.product_id === id)?.product_name || fallback;

  const chipStyle = (active: boolean): React.CSSProperties => ({
    maxWidth: 260,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 20,
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    border: `1px solid ${active ? "var(--violet)" : "var(--border-vis)"}`,
    background: active ? "color-mix(in srgb, var(--violet) 18%, transparent)" : "var(--surface-2)",
    color: active ? "var(--violet)" : "var(--text-2)",
  });

  return (
    <div data-testid="debriefing-view" style={{ display: "flex", flexDirection: "column", gap: 20, margin: "16px 0" }}>
      {/* Header Info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "16px 20px",
          borderRadius: 12,
          border: "1px solid var(--border-vis)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--violet)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {single ? "Debriefing de Vendas do Produto Principal" : `Debriefing de Vendas de ${products.length} Produtos Principais`}
            </div>
            <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              {single ? (
                metrics?.products[0]?.product_name || single.product_name
              ) : (
                <button
                  type="button"
                  aria-expanded={panelOpen}
                  aria-controls="debriefing-products-panel"
                  onClick={() => setPanelOpen((o) => !o)}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    font: "inherit",
                    color: filtered ? "var(--violet)" : "inherit",
                    cursor: "pointer",
                  }}
                >
                  {`Produtos · ${selectedCount} de ${products.length}`} {panelOpen ? "▴" : "▾"}
                </button>
              )}
            </h2>
          </div>
          {single && (
            <div
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 20,
                background: "var(--surface-2)",
                border: "1px solid var(--border-vis)",
                color: "var(--text-2)",
              }}
            >
              {`ID Hotmart: #${single.product_id}`}
            </div>
          )}
        </div>

        {!single && panelOpen && (
          <div
            id="debriefing-products-panel"
            data-testid="debriefing-products-panel"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--border-vis)",
              background: "var(--surface)",
            }}
          >
            <button
              type="button"
              aria-pressed={selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
              style={chipStyle(selectedIds.length === 0)}
            >
              Todos
            </button>
            {products.map((p) => {
              const name = nameOf(p.product_id, p.product_name);
              const active = selectedIds.includes(p.product_id);
              return (
                <button
                  key={p.product_id}
                  type="button"
                  aria-pressed={active}
                  title={name}
                  onClick={() => setSelectedIds((cur) => toggleProductSelection(cur, p.product_id, allIds))}
                  style={chipStyle(active)}
                >
                  {name}
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Recolher produtos"
              onClick={() => setPanelOpen(false)}
              style={{ marginLeft: "auto", alignSelf: "flex-end", background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14 }}
            >
              ▴
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          Carregando métricas de debriefing...
        </div>
      ) : error ? (
        <div style={{ padding: "20px", color: "var(--red)", fontSize: 13, borderRadius: 8, background: "rgba(239,68,68,0.1)" }}>
          {error}
        </div>
      ) : metrics ? (
        <>
          {/* KPI Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {/* Card 1: Total Vendas */}
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                border: "1px solid var(--border-vis)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total de Vendas
              </span>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>
                {fmtNum(metrics.totals.total_sales)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                {metrics.totals.total_sales_brl} vendas em BRL | {metrics.totals.total_sales_foreign} em moeda estrangeira
              </span>
            </div>

            {/* Card 2: Faturamento R$ */}
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                border: "1px solid var(--border-vis)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Faturamento Total (R$)
              </span>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--green)" }}>
                {fmtBRL(metrics.totals.total_revenue_brl)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                Receita confirmada em reais (BRL)
              </span>
            </div>

            {/* Card 3: Vendas Internacionais */}
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                border: "1px solid var(--border-vis)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Vendas Moeda Estrangeira
              </span>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--blue)" }}>
                {fmtNum(metrics.totals.total_sales_foreign)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                Vendas em EUR/USD ou outras moedas
              </span>
            </div>
          </div>

          {/* Daily Trend Chart */}
          <div
            style={{
              padding: "20px",
              borderRadius: 12,
              border: "1px solid var(--border-vis)",
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Evolução Diária de Vendas e Faturamento
            </div>
            {metrics.daily_series.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Sem dados de vendas no período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart
                  data={metrics.daily_series.map((d) => ({
                    date: fmtDate(d.date),
                    vendas: d.sales_count,
                    receita: d.revenue,
                  }))}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => fmtBRLAxis(v)}
                    width={76}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      if (name === "Faturamento (R$)") return [fmtBRL(Number(value)), String(name)];
                      return [value, String(name)];
                    }}
                  />
                  <Bar yAxisId="left" dataKey="vendas" name="Vendas (Qtd)" fill="var(--violet)" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Line yAxisId="right" dataKey="receita" name="Faturamento (R$)" stroke="var(--green)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Offers Breakdown Table */}
          <div
            style={{
              padding: "20px",
              borderRadius: 12,
              border: "1px solid var(--border-vis)",
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Desdobramento por Ofertas / Origens
            </div>
            {metrics.products.every((p) => p.offers_breakdown.length === 0) ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Nenhuma oferta/origem registrada no período.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border-vis)",
                        color: "var(--text-3)",
                        fontSize: 11,
                        textTransform: "uppercase",
                      }}
                    >
                      <th style={{ padding: "8px 12px" }}>Oferta / Origem</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Vendas (Qtd)</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Faturamento (R$)</th>
                    </tr>
                  </thead>
                  {metrics.products.map((product) => (
                    <tbody key={product.product_id} data-testid={`debriefing-group-${product.product_id}`}>
                      <tr
                        data-testid={`debriefing-subtotal-${product.product_id}`}
                        style={{
                          borderBottom: "1px solid var(--border-vis)",
                          background: "var(--surface-2)",
                          color: "var(--text)",
                        }}
                      >
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                          {product.product_name}
                          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "var(--text-3)" }}>
                            (#{product.product_id})
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>
                          {fmtNum(product.total_sales)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--green)", fontWeight: 700 }}>
                          {fmtBRL(product.total_revenue_brl)}
                        </td>
                      </tr>
                      {product.offers_breakdown.map((row) => (
                        <tr
                          key={row.offer_code}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            color: "var(--text)",
                          }}
                        >
                          <td style={{ padding: "10px 12px 10px 28px" }}>
                            <span style={{ fontWeight: 600 }}>{row.offer_name}</span>
                            {row.offer_code !== row.offer_name && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-3)" }}>
                                ({row.offer_code})
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                            {fmtNum(row.sales_count)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--green)", fontWeight: 600 }}>
                            {fmtBRL(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
