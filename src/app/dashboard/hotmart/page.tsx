"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangeControls } from "@/components/layout/date-range-controls";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Account, HotmartSale } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Vendas"];

const STATUS_APPROVED = ["COMPLETE", "APPROVED"];
const STATUS_PENDING = ["WAITING_PAYMENT", "PRINTED_BILLET", "UNDER_ANALISYS", "UNDER_ANALYSIS", "BILLET_PRINTED", "OVERDUE"];
const STATUS_CANCELLED = ["REFUNDED", "CANCELLED", "CHARGEBACK", "BLOCKED", "EXPIRED"];

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function today(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function HotmartStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    COMPLETE: "Aprovada",
    APPROVED: "Aprovada",
    WAITING_PAYMENT: "Aguardando",
    PRINTED_BILLET: "Boleto emitido",
    BILLET_PRINTED: "Boleto emitido",
    UNDER_ANALISYS: "Em análise",
    UNDER_ANALYSIS: "Em análise",
    REFUNDED: "Reembolsada",
    CANCELLED: "Cancelada",
    CHARGEBACK: "Chargeback",
    BLOCKED: "Bloqueada",
    EXPIRED: "Expirada",
    OVERDUE: "Vencida",
  };

  if (STATUS_APPROVED.includes(status)) return <StatusBadge tone="approved" label={labels[status] ?? status} />;
  if (STATUS_PENDING.includes(status)) return <StatusBadge tone="pending" label={labels[status] ?? status} />;
  if (status === "REFUNDED") return <StatusBadge tone="refunded" label={labels[status]} />;
  if (status === "BLOCKED" || status === "EXPIRED") return <StatusBadge tone="blocked" label={labels[status]} />;
  return <StatusBadge tone="cancelled" label={labels[status] ?? status} />;
}

const IconMoney = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconCart = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
const IconTag = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const IconRefund = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4" />
  </svg>
);

function EmptyState({ message }: { message: string }) {
  return (
    <div className="surface-card rounded-[var(--radius-card)] p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
      {message}
    </div>
  );
}

export default function HotmartPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [products, setProducts] = useState<{ product_id: string; product_name: string }[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    fetch("/api/accounts?platform=hotmart")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccountId(accs[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    fetch(`/api/hotmart/products?account_id=${selectedAccountId}`)
      .then((r) => r.json())
      .then((prods: { product_id: string; product_name: string }[]) => {
        setProducts(prods);
        setSelectedProductIds(new Set());
      });
  }, [selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    async function loadSales() {
      setLoading(true);
      const params = new URLSearchParams({
        account_id: selectedAccountId,
        start_date: new Date(`${appliedStart}T00:00:00`).toISOString(),
        end_date: new Date(`${appliedEnd}T23:59:59`).toISOString(),
        currency: "BRL",
      });
      if (selectedProductIds.size > 0) {
        params.set("product_id", Array.from(selectedProductIds).join(","));
      }

      try {
        const data = await fetch(`/api/hotmart/sales?${params}`).then((r) => r.json());
        setSales(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    }

    void loadSales();
  }, [selectedAccountId, selectedProductIds, appliedStart, appliedEnd]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter((p) => p.product_name.toLowerCase().includes(productSearch.toLowerCase()));

  function toggleProduct(productId: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function selectAll() {
    setSelectedProductIds(new Set(filteredProducts.map((p) => p.product_id)));
  }

  function clearSelection() {
    setSelectedProductIds(new Set());
  }

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  const dropdownLabel =
    selectedProductIds.size === 0
      ? "Todos os produtos"
      : selectedProductIds.size === 1
      ? products.find((p) => selectedProductIds.has(p.product_id))?.product_name ?? "1 produto"
      : `${selectedProductIds.size} produtos selecionados`;

  const approved = sales.filter((s) => STATUS_APPROVED.includes(s.status));
  const revenue = approved.reduce((sum, s) => sum + s.price, 0);
  const salesCount = approved.length;
  const ticketMedio = salesCount > 0 ? revenue / salesCount : 0;
  const pendingCount = sales.filter((s) => STATUS_PENDING.includes(s.status)).length;
  const cancelledCount = sales.filter((s) => STATUS_CANCELLED.includes(s.status)).length;
  const refundedCount = sales.filter((s) => s.status === "REFUNDED").length;
  const refundRate = salesCount + refundedCount > 0 ? (refundedCount / (salesCount + refundedCount)) * 100 : 0;

  const revenueByDay: Record<string, number> = {};
  for (const sale of approved) {
    const day = sale.purchase_date.slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] ?? 0) + sale.price;
  }
  const chartData = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rev]) => ({ date, revenue: rev }));

  function exportCsv() {
    const headers = "Oferta,Status,Valor,Comprador,Data da compra,Data aprovação\n";
    const rows = sales
      .map((s) => `"${s.offer_name ?? s.offer_code ?? "—"}","${s.status}",${s.price},"${s.buyer_email}","${s.purchase_date}","${s.approved_date ?? ""}"`)
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
      <div className="flex h-64 flex-col items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
        <p className="mb-2 text-lg">Nenhuma conta Hotmart cadastrada</p>
        <a href="/dashboard/settings" style={{ color: "var(--color-primary)" }} className="text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  const productFilter = products.length > 0 ? (
    <div ref={productDropdownRef} className="relative min-w-[260px]">
      <button
        type="button"
        onClick={() => {
          setProductDropdownOpen((v) => !v);
          setProductSearch("");
        }}
        className="field-control flex items-center justify-between gap-3 text-left"
      >
        <span className="truncate">{dropdownLabel}</span>
        <div className="flex items-center gap-2">
          {selectedProductIds.size > 0 ? (
            <span
              className="rounded-full px-2 py-0.5 text-[12px] font-medium text-white"
              style={{ background: "var(--color-primary)" }}
            >
              {selectedProductIds.size}
            </span>
          ) : null}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: productDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {productDropdownOpen ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[var(--radius-card)]"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="space-y-3 p-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <input
              autoFocus
              type="text"
              placeholder="Pesquisar produto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="field-control"
            />
            <div className="flex items-center justify-between text-xs font-medium">
              <button type="button" onClick={selectAll} style={{ color: "var(--color-primary)" }}>Selecionar todos</button>
              <button type="button" onClick={clearSelection} style={{ color: "var(--color-text-muted)" }}>Limpar</button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                Nenhum produto encontrado
              </div>
            ) : filteredProducts.map((product) => {
              const checked = selectedProductIds.has(product.product_id);
              return (
                <label
                  key={product.product_id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3"
                  style={{
                    background: checked ? "var(--color-primary-light)" : "transparent",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProduct(product.product_id)}
                    style={{ accentColor: "var(--color-primary)" }}
                  />
                  <span style={{ color: checked ? "var(--color-primary)" : "var(--color-text)", fontSize: 14, fontWeight: checked ? 600 : 400 }}>
                    {product.product_name}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <span>
              {selectedProductIds.size === 0
                ? "Nenhum produto selecionado: exibindo todos"
                : `${selectedProductIds.size} de ${products.length} selecionado${selectedProductIds.size > 1 ? "s" : ""}`}
            </span>
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => setProductDropdownOpen(false)}>
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  const headerActions = (
    <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:flex-nowrap xl:items-center xl:justify-end">
      <div className="min-w-[220px]">
        <AccountTabs
          accounts={accounts}
          selectedId={selectedAccountId}
          onSelect={(id) => {
            setSelectedAccountId(id);
            setSelectedSection("Visão Geral");
          }}
        />
      </div>
      {productFilter}
      <DateRangeControls
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={applyDateFilter}
      />
    </div>
  );

  return (
    <div className="min-h-full">
      <PageHeader title="Hotmart" subtitle="Receita e vendas por produto" actions={headerActions} />

      <div style={{ padding: "24px" }}>
        <SectionTabs sections={SECTIONS} selected={selectedSection} onSelect={setSelectedSection} />

        <div className="mt-6 space-y-6">
          {selectedSection === "Visão Geral" ? (
            loading ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard title="Receita total" value={formatBRL(revenue)} icon={IconMoney} />
                  <KpiCard title="Vendas aprovadas" value={salesCount} icon={IconCart} />
                  <KpiCard title="Ticket médio" value={formatBRL(ticketMedio)} icon={IconTag} />
                  <KpiCard title="Taxa de reembolso" value={`${refundRate.toFixed(1)}%`} icon={IconRefund} />
                </div>

                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  <div className="surface-card p-5">
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>Pendentes</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)" }}>{formatCompact(pendingCount)}</p>
                  </div>
                  <div className="surface-card p-5">
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>Canceladas / bloqueadas</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)" }}>{formatCompact(cancelledCount)}</p>
                  </div>
                  <div className="surface-card p-5">
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>Reembolsadas</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)" }}>{formatCompact(refundedCount)}</p>
                  </div>
                  <div className="surface-card p-5">
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>Total de vendas</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)" }}>{formatCompact(sales.length)}</p>
                  </div>
                </div>

                {chartData.length > 1 ? (
                  <LineChart
                    data={chartData}
                    xKey="date"
                    lines={[{ key: "revenue", color: "var(--color-primary)", label: "Receita (R$)" }]}
                    height={320}
                    title="Receita por dia"
                    subtitle="Vendas aprovadas no período selecionado"
                  />
                ) : (
                  <EmptyState message="Dados insuficientes para o gráfico. Amplie o período ou aguarde novas coletas." />
                )}
              </>
            )
          ) : loading ? (
            <SkeletonTable />
          ) : (
            <DataTable
              data={sales}
              columns={[
                {
                  key: "offer_name",
                  label: "Oferta",
                  render: (v, row) => <span>{(v as string) ?? (row.offer_code as string) ?? "—"}</span>,
                },
                { key: "status", label: "Status", render: (v) => <HotmartStatusBadge status={v as string} /> },
                { key: "price", label: "Valor", render: (v) => <span className="tabular-nums">{formatBRL(v as number)}</span> },
                {
                  key: "buyer_email",
                  label: "Comprador",
                  render: (v) => <span style={{ color: "var(--color-text-muted)" }}>{v as string}</span>,
                },
                {
                  key: "purchase_date",
                  label: "Data da compra",
                  render: (v) => v ? <span>{new Date(v as string).toLocaleDateString("pt-BR")}</span> : "—",
                },
                {
                  key: "approved_date",
                  label: "Data aprovação",
                  render: (v) => v ? <span>{new Date(v as string).toLocaleDateString("pt-BR")}</span> : "—",
                },
              ]}
              onExportCsv={exportCsv}
            />
          )}
        </div>
      </div>
    </div>
  );
}
