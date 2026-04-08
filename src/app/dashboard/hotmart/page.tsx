"use client";

import { useEffect, useRef, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";
import type { Account, HotmartSale } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Vendas"];

const STATUS_APPROVED = ["COMPLETE"];
const STATUS_PENDING = ["WAITING_PAYMENT", "PRINTED_BILLET", "UNDER_ANALISYS", "UNDER_ANALYSIS", "BILLET_PRINTED", "OVERDUE"];
const STATUS_CANCELLED = ["REFUNDED", "CANCELLED", "CHARGEBACK", "BLOCKED", "EXPIRED"];

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  let style: React.CSSProperties;
  if (STATUS_APPROVED.includes(status)) {
    style = { background: "#DCFCE7", color: "#15803D", fontWeight: 600 };
  } else if (STATUS_PENDING.includes(status)) {
    style = { background: "#FEF3C7", color: "#B45309", fontWeight: 600 };
  } else {
    style = { background: "#FEE2E2", color: "#B91C1C", fontWeight: 600 };
  }
  const labels: Record<string, string> = {
    COMPLETE: "Aprovada",
    WAITING_PAYMENT: "Aguardando",
    PRINTED_BILLET: "Boleto emitido",
    UNDER_ANALISYS: "Em análise",
    REFUNDED: "Reembolsada",
    CANCELLED: "Cancelada",
    CHARGEBACK: "Chargeback",
    BLOCKED: "Bloqueada",
    EXPIRED: "Expirada",
  };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs" style={style}>
      {labels[status] ?? status}
    </span>
  );
}

const IconMoney = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconCart = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const IconTag = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconRefund = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4" />
  </svg>
);

export default function HotmartPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [products, setProducts] = useState<{ product_id: string; product_name: string }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [appliedStart, setAppliedStart] = useState(daysAgo(30));
  const [appliedEnd, setAppliedEnd] = useState(today());
  const [sales, setSales] = useState<HotmartSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState("Visão Geral");

  // Load accounts
  useEffect(() => {
    fetch("/api/accounts?platform=hotmart")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccountId(accs[0].id);
      });
  }, []);

  // Load products when account changes
  useEffect(() => {
    if (!selectedAccountId) return;
    fetch(`/api/hotmart/products?account_id=${selectedAccountId}`)
      .then((r) => r.json())
      .then((prods: { product_id: string; product_name: string }[]) => {
        setProducts(prods);
        if (prods.length > 0) setSelectedProductId(prods[0].product_id);
        else setSelectedProductId("");
      });
  }, [selectedAccountId]);

  // Load sales when account, product, or applied date range changes
  useEffect(() => {
    if (!selectedAccountId) return;
    setLoading(true);
    const params = new URLSearchParams({
      account_id: selectedAccountId,
      start_date: `${appliedStart}T00:00:00`,
      end_date: `${appliedEnd}T23:59:59`,
    });
    if (selectedProductId) params.set("product_id", selectedProductId);

    fetch(`/api/hotmart/sales?${params}`)
      .then((r) => r.json())
      .then((data: HotmartSale[]) => setSales(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedAccountId, selectedProductId, appliedStart, appliedEnd]);

  // Close product dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter((p) =>
    p.product_name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectedProduct = products.find((p) => p.product_id === selectedProductId);

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  // KPI computations
  const approved = sales.filter((s) => STATUS_APPROVED.includes(s.status));
  const revenue = approved.reduce((sum, s) => sum + s.price, 0);
  const salesCount = approved.length;
  const ticketMedio = salesCount > 0 ? revenue / salesCount : 0;
  const pendingCount = sales.filter((s) => STATUS_PENDING.includes(s.status)).length;
  const cancelledCount = sales.filter((s) => STATUS_CANCELLED.includes(s.status)).length;
  const otherCount = sales.filter(
    (s) => !STATUS_APPROVED.includes(s.status) && !STATUS_PENDING.includes(s.status) && !STATUS_CANCELLED.includes(s.status)
  ).length;
  const refundedCount = sales.filter((s) => s.status === "REFUNDED").length;
  const refundRate = salesCount + refundedCount > 0
    ? (refundedCount / (salesCount + refundedCount)) * 100
    : 0;

  // Chart data: group approved sales by day
  const revenueByDay: Record<string, number> = {};
  for (const s of approved) {
    const day = s.purchase_date.slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] ?? 0) + s.price;
  }
  const chartData = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rev]) => ({ date, revenue: rev }));

  function exportCsv() {
    const headers = "Oferta,Status,Valor,Comprador,Data da compra,Data aprovação\n";
    const rows = sales
      .map((s) =>
        `"${s.offer_name ?? s.offer_code ?? "—"}","${s.status}",${s.price},"${s.buyer_email}","${s.purchase_date}","${s.approved_date ?? ""}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hotmart_vendas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--color-text-muted)" }}>
        <p className="text-lg mb-2">Nenhuma conta Hotmart cadastrada</p>
        <a href="/dashboard/settings" style={{ color: "var(--color-primary)" }} className="text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-8 pt-8 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--color-text)" }}>Hotmart</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Vendas e receita de produtos</p>
      </div>

      {/* Account tabs */}
      <div className="px-8 pt-4">
        <AccountTabs
          accounts={accounts}
          selectedId={selectedAccountId}
          onSelect={(id) => {
            setSelectedAccountId(id);
            setSelectedSection("Visão Geral");
          }}
        />
      </div>

      {/* Product dropdown */}
      {products.length > 0 && (
        <div className="px-8 pt-3">
          <div ref={productDropdownRef} style={{ position: "relative", maxWidth: 400 }}>
            <button
              onClick={() => {
                setProductDropdownOpen((v) => !v);
                setProductSearch("");
              }}
              className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--color-border)",
                background: "white",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              <span className="truncate" style={{ maxWidth: "calc(100% - 24px)" }}>
                {selectedProduct ? selectedProduct.product_name : "Selecione um produto"}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  flexShrink: 0,
                  transform: productDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {productDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: "white",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  overflow: "hidden",
                }}
              >
                {/* Search input */}
                <div style={{ padding: "8px 8px 4px", borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ position: "relative" }}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }}
                    >
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Pesquisar produto..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        paddingLeft: 28,
                        paddingRight: 8,
                        paddingTop: 6,
                        paddingBottom: 6,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-bg, #f9fafb)",
                        color: "var(--color-text)",
                      }}
                    />
                  </div>
                </div>

                {/* Options list */}
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {filteredProducts.length === 0 ? (
                    <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
                      Nenhum produto encontrado
                    </div>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.product_id}
                        onClick={() => {
                          setSelectedProductId(p.product_id);
                          setProductDropdownOpen(false);
                          setProductSearch("");
                        }}
                        className="w-full text-left px-4 py-2 text-sm transition-colors"
                        style={{
                          display: "block",
                          background: selectedProductId === p.product_id ? "var(--color-primary)" : "transparent",
                          color: selectedProductId === p.product_id ? "#fff" : "var(--color-text)",
                          cursor: "pointer",
                          border: "none",
                        }}
                        onMouseEnter={(e) => {
                          if (selectedProductId !== p.product_id) {
                            (e.currentTarget as HTMLButtonElement).style.background = "var(--color-border)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedProductId !== p.product_id) {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          }
                        }}
                      >
                        {p.product_name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date range filter */}
      <div className="px-8 pt-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>De:</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Até:</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={applyDateFilter}
          className="px-4 py-1.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          Aplicar
        </button>
      </div>

      {/* Section tabs */}
      <div className="px-8 pt-4">
        <SectionTabs
          sections={SECTIONS}
          selected={selectedSection}
          onSelect={setSelectedSection}
        />
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* === VISÃO GERAL === */}
        {selectedSection === "Visão Geral" && (
          <>
            {loading ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <KpiCard
                    title="Receita Total"
                    value={formatBRL(revenue)}
                    icon={IconMoney}
                    accentColor="#F97316"
                  />
                  <KpiCard
                    title="Vendas Aprovadas"
                    value={salesCount}
                    format="number"
                    icon={IconCart}
                    accentColor="#22C55E"
                  />
                  <KpiCard
                    title="Ticket Médio"
                    value={formatBRL(ticketMedio)}
                    icon={IconTag}
                    accentColor="#8B5CF6"
                  />
                  <KpiCard
                    title="Taxa de Reembolso"
                    value={`${refundRate.toFixed(1)}%`}
                    icon={IconRefund}
                    accentColor="#EF4444"
                  />
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "Aprovadas", count: salesCount, color: "#15803D", bg: "#DCFCE7" },
                    { label: "Pendentes", count: pendingCount, color: "#B45309", bg: "#FEF3C7" },
                    { label: "Canceladas/Reemb.", count: cancelledCount, color: "#B91C1C", bg: "#FEE2E2" },
                    { label: "Outros", count: otherCount, color: "#6B7280", bg: "#F3F4F6" },
                    { label: "Total", count: sales.length, color: "var(--color-text)", bg: "white" },
                  ].map(({ label, count, color, bg }) => (
                    <div
                      key={label}
                      className="rounded-[10px] p-4"
                      style={{ background: bg, border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}
                    >
                      <p className="text-xs font-medium mb-1" style={{ color }}>{label}</p>
                      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{formatCompact(count)}</p>
                    </div>
                  ))}
                </div>

                {/* Revenue chart */}
                {chartData.length > 1 ? (
                  <LineChart
                    data={chartData}
                    xKey="date"
                    lines={[{ key: "revenue", color: "#F97316", label: "Receita (R$)" }]}
                    height={280}
                    title="Receita por dia"
                    subtitle="Vendas aprovadas no período selecionado"
                  />
                ) : (
                  <div
                    className="rounded-[10px] p-8 text-center text-sm"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", boxShadow: "var(--shadow-card)", background: "white" }}
                  >
                    Dados insuficientes para o gráfico. Amplie o período ou aguarde o cron coletar dados.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === VENDAS === */}
        {selectedSection === "Vendas" && (
          <>
            {loading ? (
              <SkeletonTable />
            ) : (
              <DataTable
                data={sales}
                columns={[
                  {
                    key: "offer_name",
                    label: "Oferta",
                    render: (v, row) => (
                      <span className="text-sm" style={{ color: "var(--color-text)" }}>
                        {(v as string) ?? (row.offer_code as string) ?? "—"}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (v) => <StatusBadge status={v as string} />,
                  },
                  {
                    key: "price",
                    label: "Valor",
                    render: (v) => (
                      <span className="text-sm tabular-nums font-medium">{formatBRL(v as number)}</span>
                    ),
                  },
                  {
                    key: "buyer_email",
                    label: "Comprador",
                    render: (v) => (
                      <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>{v as string}</span>
                    ),
                  },
                  {
                    key: "purchase_date",
                    label: "Data da compra",
                    render: (v) =>
                      v ? (
                        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                          {new Date(v as string).toLocaleDateString("pt-BR")}
                        </span>
                      ) : "—",
                  },
                  {
                    key: "approved_date",
                    label: "Data aprovação",
                    render: (v) =>
                      v ? (
                        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                          {new Date(v as string).toLocaleDateString("pt-BR")}
                        </span>
                      ) : <span style={{ color: "var(--color-text-muted)" }}>—</span>,
                  },
                ]}
                onExportCsv={exportCsv}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
