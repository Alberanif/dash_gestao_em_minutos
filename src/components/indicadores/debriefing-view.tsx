"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { FilterRecord } from "@/types/indicadores";
import type { DebriefingMetrics } from "@/lib/indicadores/service/debriefing";
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
  onFilterUpdated?: (updatedFilter: FilterRecord) => void;
}

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

export function DebriefingView({ filter, startDate, endDate, onEditFilter, onFilterUpdated }: DebriefingViewProps) {
  const [metrics, setMetrics] = useState<DebriefingMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected offer codes persisted in DB
  const [selectedOfferCodes, setSelectedOfferCodes] = useState<string[]>(
    filter?.debriefing_offer_codes ?? []
  );
  const [savingFilter, setSavingFilter] = useState(false);
  const [offerSearchTerm, setOfferSearchTerm] = useState("");
  const [offerDropOpen, setOfferDropOpen] = useState(false);

  const offerCodesPropStr = (filter?.debriefing_offer_codes ?? []).join(",");

  useEffect(() => {
    setSelectedOfferCodes(filter?.debriefing_offer_codes ?? []);
  }, [filter?.id, offerCodesPropStr]);

  const mainProduct = filter?.main_hotmart_product ?? null;
  const selectedCodesStr = selectedOfferCodes.join(",");

  const loadDebriefingData = useCallback(async () => {
    if (!mainProduct?.product_id || !startDate || !endDate) {
      setMetrics(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        product_id: mainProduct.product_id,
        start_date: startDate,
        end_date: endDate,
      });
      if (selectedOfferCodes.length > 0) {
        params.set("offer_codes", selectedOfferCodes.join(","));
      }

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
  }, [mainProduct?.product_id, startDate, endDate, selectedCodesStr]);

  useEffect(() => {
    loadDebriefingData();
  }, [loadDebriefingData]);

  // Persist selected offer codes to DB on toggle
  const handleToggleOfferCode = async (code: string) => {
    if (!filter) return;

    let nextCodes: string[];
    if (selectedOfferCodes.includes(code)) {
      nextCodes = selectedOfferCodes.filter((c) => c !== code);
    } else {
      nextCodes = [...selectedOfferCodes, code];
    }

    setSelectedOfferCodes(nextCodes);
    setSavingFilter(true);

    try {
      const res = await fetch(`/api/indicadores/filters/${filter.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          debriefing_offer_codes: nextCodes,
        }),
      });

      if (res.ok) {
        const updated: FilterRecord = await res.json();
        onFilterUpdated?.(updated);
      }
    } catch {
      // silently handle or fallback
    } finally {
      setSavingFilter(false);
    }
  };

  const handleClearOfferFilter = async () => {
    if (!filter) return;
    setSelectedOfferCodes([]);
    setSavingFilter(true);

    try {
      const res = await fetch(`/api/indicadores/filters/${filter.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          debriefing_offer_codes: [],
        }),
      });

      if (res.ok) {
        const updated: FilterRecord = await res.json();
        onFilterUpdated?.(updated);
      }
    } catch {
      // ignore
    } finally {
      setSavingFilter(false);
    }
  };

  if (!filter) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)" }}>
        Nenhum filtro ativado. Selecione um dashboard acima.
      </div>
    );
  }

  if (!mainProduct) {
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

  const productName = metrics?.product_name || mainProduct.product_name;
  const availableOffers = metrics?.available_offers ?? [];

  return (
    <div data-testid="debriefing-view" style={{ display: "flex", flexDirection: "column", gap: 20, margin: "16px 0" }}>
      {/* Header Info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "16px 20px",
          borderRadius: 12,
          border: "1px solid var(--border-vis)",
          background: "var(--surface)",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--violet)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Debriefing de Vendas do Produto Principal
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
            {productName}
          </h2>
        </div>
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
          ID Hotmart: #{mainProduct.product_id}
        </div>
      </div>

      {/* Offer Filter Control Bar */}
      {availableOffers.length > 0 && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            border: "1px solid var(--border-vis)",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Filtro de Ofertas
              </span>
              {selectedOfferCodes.length > 0 ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--violet)", background: "color-mix(in srgb, var(--violet) 12%, transparent)", padding: "2px 8px", borderRadius: 12 }}>
                  {selectedOfferCodes.length} {selectedOfferCodes.length === 1 ? "oferta selecionada" : "ofertas selecionadas"}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  (Exibindo todas as ofertas)
                </span>
              )}
            </div>
            {selectedOfferCodes.length > 0 && (
              <button
                type="button"
                onClick={handleClearOfferFilter}
                disabled={savingFilter}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Limpar filtro (Exibir todas)
              </button>
            )}
          </div>

          {/* Search Input with Dropdown */}
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              value={offerSearchTerm}
              onChange={(e) => setOfferSearchTerm(e.target.value)}
              onFocus={() => setOfferDropOpen(true)}
              onBlur={() => setTimeout(() => setOfferDropOpen(false), 200)}
              placeholder="Digite o código ou nome da oferta..."
              style={{
                width: "100%",
                padding: "9px 14px",
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid var(--border-vis)",
                background: "var(--surface-2)",
                color: "var(--text)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {offerDropOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--border-vis)",
                  borderRadius: 8,
                  maxHeight: 220,
                  overflowY: "auto",
                  zIndex: 300,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                {(() => {
                  const term = offerSearchTerm.trim().toLowerCase();
                  const filtered = availableOffers.filter(
                    (off) =>
                      !term ||
                      off.offer_code.toLowerCase().includes(term) ||
                      off.offer_name.toLowerCase().includes(term)
                  );

                  if (filtered.length === 0) {
                    return (
                      <div style={{ padding: "12px", fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                        Nenhuma oferta encontrada para "{offerSearchTerm}".
                      </div>
                    );
                  }

                  return filtered.map((off) => {
                    const isSelected = selectedOfferCodes.includes(off.offer_code);
                    return (
                      <button
                        key={off.offer_code}
                        type="button"
                        onMouseDown={() => handleToggleOfferCode(off.offer_code)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "9px 14px",
                          fontSize: 12,
                          color: "var(--text)",
                          background: isSelected
                            ? "color-mix(in srgb, var(--violet) 12%, transparent)"
                            : "transparent",
                          border: "none",
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ accentColor: "var(--violet)", pointerEvents: "none" }}
                          />
                          <span>
                            <strong>{off.offer_name}</strong>{" "}
                            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                              ({off.offer_code})
                            </span>
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>
                          {off.sales_count} {off.sales_count === 1 ? "venda" : "vendas"}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Active Offer Filter Tags */}
          {selectedOfferCodes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {selectedOfferCodes.map((code) => {
                const found = availableOffers.find((o) => o.offer_code === code);
                const label = found ? found.offer_name : code;
                return (
                  <span
                    key={code}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 16,
                      border: "1px solid color-mix(in srgb, var(--violet) 40%, transparent)",
                      background: "color-mix(in srgb, var(--violet) 12%, transparent)",
                      color: "var(--violet)",
                    }}
                  >
                    {label} {found && found.offer_code !== label && `(${found.offer_code})`}
                    <button
                      type="button"
                      onClick={() => handleToggleOfferCode(code)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--violet)",
                        padding: 0,
                        fontSize: 12,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {savingFilter && (
            <span style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>
              Salvando preferências no banco...
            </span>
          )}
        </div>
      )}

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
                {fmtNum(metrics.total_sales)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                {metrics.total_sales_brl} vendas em BRL | {metrics.total_sales_foreign} em moeda estrangeira
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
                {fmtBRL(metrics.total_revenue_brl)}
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
                {fmtNum(metrics.total_sales_foreign)}
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
                    tickFormatter={(v) => fmtBRL(v)}
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
            {metrics.offers_breakdown.length === 0 ? (
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
                  <tbody>
                    {metrics.offers_breakdown.map((row) => (
                      <tr
                        key={row.offer_code}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          color: "var(--text)",
                        }}
                      >
                        <td style={{ padding: "10px 12px" }}>
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
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
