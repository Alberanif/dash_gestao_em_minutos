"use client";

import "../../dash-theme.css";
import "../indicadores.css";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FilterRecord, FilterStatus } from "@/types/indicadores";
import { groupFiltersByStatus, statusSummaryCounts, matchesEventoSearch } from "@/lib/indicadores/eventos";
import type { EventosMetricsMap } from "@/lib/indicadores/service/eventos-metrics";
import { EventoFolder, FOLDER_CONFIGS } from "@/components/indicadores/evento-folder";
import { EventoCard, EventoCardMetrics } from "@/components/indicadores/evento-card";
import { EventoCardMenu } from "@/components/indicadores/evento-card-menu";
import { FilterModal } from "@/components/indicadores/filter-modal";

// Mesma chave que o bootstrap do dashboard Indicadores restaura (page.tsx).
const LS_FILTER_ID = "indicadores_active_filter_id";

export default function EventosPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricsMap, setMetricsMap] = useState<EventosMetricsMap>({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FilterRecord | null>(null);
  // Ativos aberta por padrão; estado session-only (não persistido).
  const [collapsed, setCollapsed] = useState<Record<FilterStatus, boolean>>({
    ativo: false,
    finalizado: true,
    cancelado: true,
  });
  // Dois saves em sequência disparam dois GETs; só a resposta do mais recente
  // pode escrever no mapa, senão a antiga sobrescreve métricas mais novas.
  const metricsRequestSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const accountsRes = await fetch("/api/accounts");
        const accounts = await accountsRes.json();
        if (!Array.isArray(accounts) || accounts.length === 0) return;
        if (!cancelled) setAccountId(accounts[0].id);

        const filtersRes = await fetch(`/api/indicadores/filters?account_id=${accounts[0].id}`);
        const data = await filtersRes.json();
        if (cancelled || !Array.isArray(data)) return;
        setFilters(data);
        setLoading(false);

        // métricas chegam depois, sem bloquear os cards (skeleton enquanto isso)
        await refreshMetrics(accounts[0].id, () => cancelled);
      } catch {
        // rede fora — tela fica no estado vazio
      } finally {
        if (!cancelled) {
          setLoading(false);
          setMetricsLoading(false);
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshMetrics(account: string, isCancelled: () => boolean = () => false) {
    const seq = ++metricsRequestSeq.current;
    const isStale = () => isCancelled() || seq !== metricsRequestSeq.current;
    try {
      const res = await fetch(`/api/indicadores/eventos-metrics?account_id=${account}`);
      // Erro do servidor devolve {"error": ...} — não pode apagar métricas já exibidas.
      if (!res.ok) return;
      const metrics = await res.json();
      if (!isStale() && metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
        setMetricsMap(metrics);
      }
    } catch {
      // métricas indisponíveis — células ficam em "—"
    } finally {
      if (!isStale()) setMetricsLoading(false);
    }
  }

  function handleOpenDashboard(filter: FilterRecord) {
    localStorage.setItem(LS_FILTER_ID, filter.id);
    router.push("/indicadores");
  }

  function handleSaved(saved: FilterRecord) {
    setFilters((prev) =>
      prev.some((f) => f.id === saved.id)
        ? prev.map((f) => (f.id === saved.id ? saved : f))
        : [...prev, saved]
    );
    setModalOpen(false);
    setEditTarget(null);
    if (accountId) refreshMetrics(accountId);
  }

  async function handleDelete(filter: FilterRecord) {
    if (!window.confirm(`Excluir o evento "${filter.name}"? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/indicadores/filters/${filter.id}`, { method: "DELETE" });
    if (res.ok) {
      setFilters((prev) => prev.filter((f) => f.id !== filter.id));
    }
  }

  const searching = search.trim() !== "";
  const visibleFilters = filters.filter((f) => matchesEventoSearch(f, search));
  const groups = groupFiltersByStatus(visibleFilters);
  const counts = statusSummaryCounts(filters);

  return (
    <div className="dash-dark ind-dark" style={{ maxWidth: 1220, margin: "0 auto", padding: "0 28px 72px" }}>
      {modalOpen && accountId && (
        <FilterModal
          accountId={accountId}
          editTarget={editTarget}
          onSave={handleSaved}
          onCancel={() => { setModalOpen(false); setEditTarget(null); }}
        />
      )}

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          padding: "22px 0 18px",
          borderBottom: "1px solid var(--border)",
          marginBottom: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Módulos
          </Link>
          <div style={{ width: 1, height: 18, background: "#262b33" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-strong)", margin: 0 }}>
            Eventos
          </h1>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Organizados por pastas</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar evento"
              data-testid="eventos-search"
              style={{
                fontFamily: "inherit",
                fontSize: 12,
                padding: "8px 12px 8px 32px",
                width: 200,
                background: "var(--surface)",
                border: "1px solid var(--border-vis)",
                borderRadius: 8,
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>
          <button
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
            data-testid="eventos-novo"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              background: "var(--text-strong)",
              border: "1px solid var(--text-strong)",
              borderRadius: 8,
              color: "var(--bg)",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo evento
          </button>
        </div>
      </header>

      {/* Faixa de resumo */}
      <div style={{ display: "flex", gap: 10, marginBottom: 30, flexWrap: "wrap" }}>
        {FOLDER_CONFIGS.map((config) => (
          <div
            key={config.status}
            style={{
              flex: 1,
              minWidth: 180,
              background: "var(--surface)",
              border: "1px solid var(--border-vis)",
              borderRadius: 11,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: config.accent, flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 23, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1 }}>
                {counts[config.status]}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{config.summaryLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pastas */}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Carregando eventos...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {FOLDER_CONFIGS.map((config) => {
            const eventos = groups[config.status];
            return (
              <EventoFolder
                key={config.status}
                config={config}
                count={eventos.length}
                collapsed={searching ? false : collapsed[config.status]}
                onToggle={() =>
                  setCollapsed((prev) => ({ ...prev, [config.status]: !prev[config.status] }))
                }
              >
                {eventos.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-4)", margin: "4px 0" }}>
                    {searching ? "Nenhum evento encontrado nesta pasta." : "Nenhum evento nesta pasta."}
                  </p>
                ) : (
                  eventos.map((filter) => (
                    <EventoCard
                      key={filter.id}
                      filter={filter}
                      accent={config}
                      onOpenDashboard={handleOpenDashboard}
                      menu={
                        <EventoCardMenu
                          onEdit={() => { setEditTarget(filter); setModalOpen(true); }}
                          onDelete={() => handleDelete(filter)}
                        />
                      }
                      metrics={
                        <EventoCardMetrics metrics={metricsMap[filter.id]} loading={metricsLoading} />
                      }
                    />
                  ))
                )}
              </EventoFolder>
            );
          })}
        </div>
      )}
    </div>
  );
}
