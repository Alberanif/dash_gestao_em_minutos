"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  VendasViewDailyRow,
  VendasViewHourlyRow,
  VendasViewKpis,
  VendasViewOfferRow,
  VendasViewRecord,
} from "@/types/vendas";
import type { UserRole } from "@/types/auth";
import type { ChartGranularity } from "@/lib/vendas/cumulative-chart";
import { viewRangeFrom, type DateRange } from "@/lib/vendas/date-range";
import { interpretRefreshResponse } from "@/lib/vendas/refresh";
import {
  describeBackfill,
  incompleteBadge,
  sumSales,
  totalsMismatch,
} from "@/lib/vendas/views";
import { DateRangeFilter } from "./date-range-filter";
import { RefreshControls } from "./refresh-controls";
import { SectionHeader } from "./section-header";
import { SalesBarChart, ViewCumulativeChart } from "./view-charts";

interface VendasViewDashboardProps {
  view: VendasViewRecord;
  productName: string;
  role: UserRole;
  // Grava o período na visualização (só o gestor chega a chamar). Devolve se deu certo.
  onRangeChange: (range: DateRange | null) => Promise<boolean>;
  // Pede à tela que releia a visualização (estado de backfill, last_refresh_at).
  onViewChanged: () => void;
}

interface ViewData {
  kpis: VendasViewKpis;
  daily: VendasViewDailyRow[];
  hourly: VendasViewHourlyRow[] | null;
  offers: VendasViewOfferRow[];
}

// Inteiros sem símbolo: o Intl pt-BR não põe NBSP aqui (só em moeda), então o
// KPI quebra normalmente no mobile — ver PR #162. O overflowWrap abaixo é só
// rede de segurança.
const fmtInt = (n: number) => Intl.NumberFormat("pt-BR").format(n);

function qs(range: DateRange | null): string {
  return range ? `?start=${range.start}&end=${range.end}` : "";
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return (await res.json()) as T;
}

function KpiTile({
  label,
  value,
  sub,
  dotColor,
  testId,
  action,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  dotColor: string;
  testId: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={{ background: "var(--surface)", border: "1px solid var(--border-vis)", borderRadius: 11, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-label)" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        {label}
        {action}
      </span>
      <span
        data-testid={`${testId}-value`}
        style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-strong)", lineHeight: 1.1, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4 }}>{sub}</span>}
    </div>
  );
}

export function VendasViewDashboard({ view, productName, role, onRangeChange, onViewChanged }: VendasViewDashboardProps) {
  const isGestor = role === "gestor";
  const range = viewRangeFrom(view.view_start_date, view.view_end_date);
  const rangeKey = range ? `${range.start}|${range.end}` : "";

  const [data, setData] = useState<ViewData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [granularity, setGranularity] = useState<ChartGranularity>("dia");
  const [helpOpen, setHelpOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Os números dependem da visualização (id, ofertas, período) e do que o
  // servidor coletou desde então (last_refresh_at, estado do backfill).
  const dataKey = [view.id, rangeKey, view.offer_codes.join(","), view.last_refresh_at ?? "", view.backfill_status, reloadToken].join("#");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(false);
      const base = `/api/vendas/views/${view.id}`;
      const q = qs(range);
      try {
        const [kpis, daily, offers, hourly] = await Promise.all([
          getJson<VendasViewKpis>(`${base}/kpis${q}`),
          getJson<{ rows: VendasViewDailyRow[] }>(`${base}/daily${q}`),
          getJson<{ rows: VendasViewOfferRow[] }>(`${base}/offers${q}`),
          // A série horária é opcional: sem ela só some o switch Dia/Hora.
          getJson<{ rows: VendasViewHourlyRow[] }>(`${base}/hourly${q}`).catch(() => null),
        ]);
        if (cancelled) return;
        setData({
          kpis,
          daily: daily.rows ?? [],
          offers: offers.rows ?? [],
          hourly: hourly ? hourly.rows ?? [] : null,
        });
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // `range` é derivado de rangeKey; a chave inteira já cobre as dependências.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  const notice = describeBackfill(view);
  const badge = incompleteBadge(notice);
  const mismatch = useMemo(
    () => (data ? totalsMismatch(data.kpis.sales, data.daily, data.offers) : null),
    [data]
  );

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/vendas/views/${view.id}/refresh`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      const outcome = interpretRefreshResponse(res.status, body);
      if (outcome.kind !== "success") setRetryError(outcome.message);
    } catch {
      setRetryError("Erro de conexão ao tentar novamente.");
    } finally {
      setRetrying(false);
      onViewChanged();
    }
  }

  const noticeColor =
    notice.status === "failed" ? "#ef4444" : notice.status === "done" ? "var(--text-muted)" : "var(--color-warning, #f59e0b)";

  return (
    <div data-testid="view-dashboard" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="ult-cycle-head">
        <div style={{ minWidth: 0 }}>
          <h2 data-testid="view-selected-name" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)", margin: 0, overflowWrap: "anywhere" }}>
            {view.name}
          </h2>
          <p data-testid="view-product" style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", overflowWrap: "anywhere" }}>
            {productName} · {view.offer_codes.length} {view.offer_codes.length === 1 ? "oferta" : "ofertas"}
          </p>
        </div>
        <div className="ult-cycle-actions">
          <RefreshControls
            viewId={view.id}
            refreshUrl={`/api/vendas/views/${view.id}/refresh`}
            lastRefreshAt={view.last_refresh_at}
            onRefreshed={() => {
              setReloadToken((t) => t + 1);
              onViewChanged();
            }}
          />
        </div>
      </div>

      <div
        role="status"
        data-testid="view-backfill-notice"
        data-backfill-status={notice.status}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12, lineHeight: 1.5, color: noticeColor, padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-vis)", background: "var(--surface)" }}
      >
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{notice.message}</span>
        {notice.canRetry && (
          <button type="button" className="btn-secondary" onClick={handleRetry} disabled={retrying} data-testid="view-backfill-retry">
            {retrying ? "Tentando..." : "Tentar novamente"}
          </button>
        )}
        {retryError && (
          <span data-testid="view-backfill-retry-error" style={{ width: "100%", color: "#ef4444" }}>
            {retryError}
          </span>
        )}
      </div>

      <DateRangeFilter value={range} canEdit={isGestor} onSave={onRangeChange} />

      {loadError && (
        <div data-testid="view-load-error" style={{ textAlign: "center", padding: 32, color: "#ef4444" }}>
          <p style={{ margin: 0, fontSize: 14 }}>Falha ao carregar os números.</p>
          <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={() => setReloadToken((t) => t + 1)}>
            Tentar novamente
          </button>
        </div>
      )}

      {!data && !loadError && (
        <p data-testid="view-loading" style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          Carregando...
        </p>
      )}

      {data && !loadError && (
        <>
          {mismatch && (
            <div role="alert" data-testid="view-totals-mismatch" style={{ fontSize: 12, color: "#ef4444", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)" }}>
              Os totais não batem entre si (KPI {fmtInt(mismatch.kpi)}, gráfico por dia {fmtInt(mismatch.daily)}, quebra por oferta {fmtInt(mismatch.offers)}). Use Atualizar agora; se persistir, avise o time.
            </div>
          )}

          <div className="ult-kpi-grid">
            <KpiTile
              testId="view-kpi-sales"
              label="Vendas"
              dotColor="var(--orange)"
              value={fmtInt(data.kpis.sales)}
              sub={badge ?? undefined}
            />
            <KpiTile
              testId="view-kpi-refunded"
              label="Reembolsadas"
              dotColor="#ef4444"
              value={fmtInt(data.kpis.refunded)}
              sub={
                <>
                  {helpOpen && (
                    <span data-testid="view-refunded-help" style={{ display: "block" }}>
                      Reembolso é retroativo: a venda reembolsada sai da contagem de vendas e do dia em que foi aprovada, não do dia do reembolso.
                    </span>
                  )}
                </>
              }
              action={
                <button
                  type="button"
                  data-testid="view-refunded-help-btn"
                  aria-label="Sobre reembolsos"
                  aria-expanded={helpOpen}
                  title="Reembolso retroativo: a venda sai do dia em que foi aprovada"
                  onClick={() => setHelpOpen((o) => !o)}
                  style={{ width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 10, lineHeight: 1, cursor: "pointer", padding: 0 }}
                >
                  ?
                </button>
              }
            />
          </div>

          <section>
            <SectionHeader index="01" title="Vendas ao longo do tempo" desc={`Total no gráfico: ${fmtInt(sumSales(data.daily))}`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SalesBarChart daily={data.daily} hourly={data.hourly} granularity={granularity} onGranularityChange={setGranularity} />
              <ViewCumulativeChart daily={data.daily} hourly={data.hourly} granularity={granularity} onGranularityChange={setGranularity} />
            </div>
          </section>

          <section>
            <SectionHeader index="02" title="Por oferta" desc={`Total nas ofertas: ${fmtInt(sumSales(data.offers))}`} />
            <ul data-testid="view-offers-list" style={{ listStyle: "none", margin: 0, padding: 0, background: "var(--surface)", border: "1px solid var(--border-vis)", borderRadius: 11 }}>
              {data.offers.map((o) => {
                const none = o.sales === 0 && o.refunded === 0;
                return (
                  <li
                    key={o.offer_code}
                    data-testid={`view-offer-${o.offer_code}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}
                  >
                    <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 13, color: "var(--text)" }}>
                      {o.offer_name ? `${o.offer_name} · ` : ""}
                      <code>{o.offer_code}</code>
                      {none && (
                        <span data-testid={`view-offer-${o.offer_code}-empty`} style={{ marginLeft: 8, fontSize: 11, color: "var(--text-3)" }}>
                          0 vendas coletadas
                        </span>
                      )}
                    </span>
                    <span style={{ textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      <strong data-testid={`view-offer-${o.offer_code}-sales`} style={{ fontSize: 15, color: "var(--text-strong)" }}>
                        {fmtInt(o.sales)}
                      </strong>
                      {o.refunded > 0 && (
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-3)" }}>
                          {fmtInt(o.refunded)} reembolsada{o.refunded === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
