"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/types/auth";
import type { UltimatesDailyRow, UltimatesRosterRow } from "@/types/ultimates";
import type { CycleWithProduct } from "./types";
import { aggregateRosterKpis } from "@/lib/ultimates/kpi-aggregation";
import { buildCumulativeSeries } from "@/lib/ultimates/cumulative-chart";
import { KpiRow } from "./kpi-row";
import { GoalProgressBar } from "./goal-progress-bar";
import { CumulativeRenewalsChart } from "./cumulative-renewals-chart";
import { RosterTable } from "./roster-table";
import { RefreshControls } from "./refresh-controls";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";

// Dashboard do ciclo selecionado (PRD issue #114, seções 3.2–3.4/3.6, task
// #123). UMA chamada ao roster + UMA ao daily alimentam KPIs (agregados no
// cliente, src/lib/ultimates/kpi-aggregation.ts), meta, gráfico acumulado e
// tabela — nunca fontes separadas, para que os números batam entre si
// (critério 9). Contrato de props preservado da task #122: não renomeie
// sem avisar quem pegar a #124 (slot "Vincular à base" em RosterTable).
export interface UltimatesDashboardProps {
  cycle: CycleWithProduct;
  role: UserRole;
}

export function UltimatesDashboard({ cycle, role }: UltimatesDashboardProps) {
  const [roster, setRoster] = useState<UltimatesRosterRow[] | null>(null);
  const [daily, setDaily] = useState<UltimatesDailyRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Incrementado ao clicar "Tentar novamente" ou após um refresh bem
  // sucedido — reexecuta o efeito de carga abaixo (mesmo padrão de
  // ultimates-screen.tsx: fetch inline no efeito + flag de cancelamento).
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Reset dentro da função async (não no corpo síncrono do efeito) —
      // react-hooks/set-state-in-effect rejeita setState direto no corpo do
      // efeito (mesmo ajuste que a task #122 precisou fazer em
      // ultimates-screen.tsx).
      setRoster(null);
      setDaily(null);
      setLoadError(false);
      try {
        const [rosterRes, dailyRes] = await Promise.all([
          fetch(`/api/ultimates/cycles/${cycle.id}/roster`),
          fetch(`/api/ultimates/cycles/${cycle.id}/daily`),
        ]);
        if (!rosterRes.ok || !dailyRes.ok) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const rosterData = await rosterRes.json();
        const dailyData = await dailyRes.json();
        if (cancelled) return;
        setRoster(Array.isArray(rosterData?.rows) ? rosterData.rows : []);
        setDaily(Array.isArray(dailyData?.days) ? dailyData.days : []);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cycle.id, reloadToken]);

  function handleRefreshed() {
    setReloadToken((t) => t + 1);
  }

  const loading = roster === null || daily === null;
  const kpis = roster ? aggregateRosterKpis(roster) : null;

  return (
    <div data-testid="ultimates-dashboard-slot" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            data-testid="ultimates-selected-cycle"
            style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: 0 }}
          >
            {cycle.name}
          </h2>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0" }}>
            {cycle.product_name ?? "Produto não identificado"}
          </p>
        </div>
        <RefreshControls
          cycleId={cycle.id}
          cycleStatus={cycle.status}
          lastRefreshAt={cycle.last_refresh_at}
          onRefreshed={handleRefreshed}
        />
      </div>

      {loadError && (
        <div data-testid="ultimates-dashboard-error" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--color-danger)", margin: 0 }}>
            Não foi possível carregar os dados do ciclo.
          </p>
          <button
            type="button"
            onClick={() => setReloadToken((t) => t + 1)}
            className="btn-secondary"
            style={{ alignSelf: "flex-start" }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loadError && loading && (
        <div data-testid="ultimates-dashboard-loading" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonChart />
          <SkeletonTable />
        </div>
      )}

      {!loadError && !loading && kpis && (
        <>
          <KpiRow kpis={kpis} />
          {cycle.goal_percent != null && (
            <GoalProgressBar goalPercent={cycle.goal_percent} currentPercent={kpis.renovadosPercent} />
          )}
          <CumulativeRenewalsChart data={buildCumulativeSeries(daily ?? [])} />
          <RosterTable rows={roster ?? []} role={role} />
        </>
      )}
    </div>
  );
}
