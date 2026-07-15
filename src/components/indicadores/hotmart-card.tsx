"use client";

import { useState, useEffect } from "react";
import { HotmartVendasChart } from "./trend-charts";
import { KpiCell } from "./kpi-cell";
import type { GlobalHotmartMetrics, DailyPoint } from "@/types/indicadores";
import { sortOffers } from "@/lib/utils/hotmart-offers";
import type { HotmartOffer } from "@/lib/utils/hotmart-offers";
import { NotConfiguredBadge } from "./not-configured-badge";

export { NotConfiguredBadge } from "./not-configured-badge";

const PAGE_SIZE = 5;

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

interface HotmartPanelProps {
  hotmartState: SectionState<GlobalHotmartMetrics>;
  dailyState: SectionState<DailyPoint[]>;
  accountId?: string;
  selectedProductId?: string | null;
  onOfferCodeChange?: (offerCode: string | null, productId: string | null) => void;
  hasHotmartFilter?: boolean;
}

function fmtBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

function SkeletonBox({ height, width = "100%" }: { height: number; width?: string }) {
  return (
    <div style={{ height, width, background: "var(--surface-2)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

function SelectChevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-3)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function HotmartPanel({
  hotmartState,
  dailyState,
  accountId,
  selectedProductId,
  onOfferCodeChange,
  hasHotmartFilter = true,
}: HotmartPanelProps) {
  const [page, setPage] = useState(0);

  // Offer filter state
  const [offerProductId, setOfferProductId] = useState<string | null>(null);
  const [offerCode, setOfferCode] = useState<string | null>(null);
  const [offers, setOffers] = useState<HotmartOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  // When selectedProductId changes externally, sync internal state
  useEffect(() => {
    if (selectedProductId !== undefined && selectedProductId !== offerProductId) {
      setOfferProductId(selectedProductId ?? null);
      setOfferCode(null);
      setOffers([]);
    }
  }, [selectedProductId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch offers whenever offerProductId changes
  useEffect(() => {
    if (!offerProductId || !accountId) {
      setOffers([]);
      setOfferCode(null);
      return;
    }
    setOffersLoading(true);
    fetch(`/api/hotmart/offers?account_id=${encodeURIComponent(accountId)}&product_id=${encodeURIComponent(offerProductId)}`)
      .then((r) => r.json())
      .then((data: HotmartOffer[]) => {
        if (Array.isArray(data)) setOffers(sortOffers(data));
        else setOffers([]);
      })
      .catch(() => setOffers([]))
      .finally(() => setOffersLoading(false));
  }, [offerProductId, accountId]);

  function handleProductSelect(productId: string) {
    const newProductId = productId || null;
    setOfferProductId(newProductId);
    setOfferCode(null);
    onOfferCodeChange?.(null, newProductId);
  }

  function handleOfferSelect(code: string) {
    const newCode = code || null;
    setOfferCode(newCode);
    onOfferCodeChange?.(newCode, offerProductId);
  }

  function handleClearOfferFilter() {
    setOfferProductId(null);
    setOfferCode(null);
    setOffers([]);
    onOfferCodeChange?.(null, null);
  }

  if (hotmartState.loading) {
    return (
      <>
        {!hasHotmartFilter && <NotConfiguredBadge text="Hotmart não configurado neste filtro — dados zerados" />}
        <div style={{ padding: 22, display: "flex", flexDirection: "column" as const, gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            <SkeletonBox height={44} />
            <SkeletonBox height={44} />
            <SkeletonBox height={44} />
          </div>
          <SkeletonBox height={180} />
        </div>
      </>
    );
  }

  if (hotmartState.error || !hotmartState.data) {
    return (
      <>
        {!hasHotmartFilter && <NotConfiguredBadge text="Hotmart não configurado neste filtro — dados zerados" />}
        <div style={{ padding: 22 }}>
          <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>Erro ao carregar dados do Hotmart.</p>
        </div>
      </>
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

  // Products available for the offer filter (from hotmart data)
  const availableProducts = d.products;

  const selectStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "inherit",
    fontSize: 12,
    padding: "8px 32px 8px 11px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-vis)",
    borderRadius: 7,
    color: "var(--text)",
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
  };

  const clearBtnStyle: React.CSSProperties = {
    fontSize: 11,
    fontFamily: "inherit",
    padding: "5px 8px",
    background: "transparent",
    border: "1px solid var(--border-vis)",
    borderRadius: 6,
    color: "var(--text-3)",
    cursor: "pointer",
  };

  return (
    <>
      {!hasHotmartFilter && <NotConfiguredBadge text="Hotmart não configurado neste filtro — dados zerados" />}
      <div style={{ padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 22 }}>
          <KpiCell label="Receita BRL" value={fmtBRL(d.total_revenue)} large />
          <KpiCell label="Vendas BRL" value={fmtNum(d.total_sales_brl)} large />
          <KpiCell label="Vendas Ext." value={fmtNum(d.total_sales_foreign)} large muted />
        </div>

        {/* Offer filter — only shown when there are products */}
        {availableProducts.length > 0 && (
          <div style={{ marginBottom: 18, maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)" }}>
                Filtrar por oferta
              </span>
              {offerProductId && (
                <button onClick={handleClearOfferFilter} style={clearBtnStyle}>
                  Limpar
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <select
                  value={offerProductId ?? ""}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Todos os produtos</option>
                  {availableProducts.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>

              {offerProductId && (
                <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                  <select
                    value={offerCode ?? ""}
                    onChange={(e) => handleOfferSelect(e.target.value)}
                    style={{ ...selectStyle, opacity: offersLoading ? 0.6 : 1 }}
                    disabled={offersLoading || offers.length === 0}
                  >
                    <option value="">
                      {offersLoading ? "Carregando..." : offers.length === 0 ? "Sem ofertas" : "Todas as ofertas"}
                    </option>
                    {offers.map((o) => (
                      <option key={o.offer_code} value={o.offer_code}>
                        {o.offer_name}{o.is_main_offer ? " (principal)" : ""}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="hotmart-grid">
          {d.products.length > 0 && (
            <div style={{ overflowX: "auto" }}>
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
                      <td style={{ padding: "9px 8px", color: "var(--text)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.product_name}
                        {p.is_foreign_currency && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-vis)", color: "var(--text-3)", borderRadius: 4, padding: "1px 5px" }}>moeda ext.</span>
                        )}
                      </td>
                      <td style={{ padding: "9px 8px", textAlign: "right", color: "var(--text)" }}>{fmtNum(p.sales_count)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", color: "var(--text)" }}>
                        {p.is_foreign_currency ? "—" : fmtBRL(p.revenue)}
                      </td>
                    </tr>
                  ))}
                  {hasMultipleProducts && (
                    <tr style={{ borderTop: "1px solid var(--border-strong)" }}>
                      <td style={{ padding: "9px 8px", color: "var(--text-strong)", fontWeight: 700 }}>Total</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", color: "var(--text-strong)", fontWeight: 700 }}>{fmtNum(d.total_sales)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", color: "var(--text-strong)", fontWeight: 700 }}>{fmtBRL(d.total_revenue)}</td>
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
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", minWidth: 40, textAlign: "center" }}>
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

          {hasHotmartFilter && (
            <div>
              <HotmartVendasChart data={dailyState.data ?? []} loading={dailyState.loading} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
