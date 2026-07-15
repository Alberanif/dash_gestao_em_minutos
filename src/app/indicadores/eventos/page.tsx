"use client";

import "../indicadores.css";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FilterRecord, FilterStatus } from "@/types/indicadores";
import { groupFiltersByStatus, statusSummaryCounts } from "@/lib/indicadores/eventos";
import type { EventosMetricsMap } from "@/lib/indicadores/service/eventos-metrics";
import { EventoFolder, FOLDER_CONFIGS } from "@/components/indicadores/evento-folder";
import { EventoCard, EventoCardMetrics } from "@/components/indicadores/evento-card";

// Mesma chave que o bootstrap do dashboard Indicadores restaura (page.tsx).
const LS_FILTER_ID = "indicadores_active_filter_id";

export default function EventosPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricsMap, setMetricsMap] = useState<EventosMetricsMap>({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  // Ativos aberta por padrão; estado session-only (não persistido).
  const [collapsed, setCollapsed] = useState<Record<FilterStatus, boolean>>({
    ativo: false,
    finalizado: true,
    cancelado: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const accountsRes = await fetch("/api/accounts");
        const accounts = await accountsRes.json();
        if (!Array.isArray(accounts) || accounts.length === 0) return;

        const filtersRes = await fetch(`/api/indicadores/filters?account_id=${accounts[0].id}`);
        const data = await filtersRes.json();
        if (cancelled || !Array.isArray(data)) return;
        setFilters(data);
        setLoading(false);

        // métricas chegam depois, sem bloquear os cards (skeleton enquanto isso)
        const metricsRes = await fetch(`/api/indicadores/eventos-metrics?account_id=${accounts[0].id}`);
        const metrics = await metricsRes.json();
        if (!cancelled && metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
          setMetricsMap(metrics);
        }
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

  function handleOpenDashboard(filter: FilterRecord) {
    localStorage.setItem(LS_FILTER_ID, filter.id);
    router.push("/indicadores");
  }

  const groups = groupFiltersByStatus(filters);
  const counts = statusSummaryCounts(filters);

  return (
    <div className="ind-dark" style={{ maxWidth: 1220, margin: "0 auto", padding: "0 28px 72px" }}>
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

        {/* Busca e "Novo evento" chegam na slice de ações */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} />
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
                collapsed={collapsed[config.status]}
                onToggle={() =>
                  setCollapsed((prev) => ({ ...prev, [config.status]: !prev[config.status] }))
                }
              >
                {eventos.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-4)", margin: "4px 0" }}>
                    Nenhum evento nesta pasta.
                  </p>
                ) : (
                  eventos.map((filter) => (
                    <EventoCard
                      key={filter.id}
                      filter={filter}
                      accent={config}
                      onOpenDashboard={handleOpenDashboard}
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
