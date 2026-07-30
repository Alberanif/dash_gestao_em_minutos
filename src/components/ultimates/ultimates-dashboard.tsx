"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/types/auth";
import type { UltimatesDailyRow, UltimatesRosterRow } from "@/types/ultimates";
import type { CycleWithProduct } from "./types";
import { aggregateRosterKpis } from "@/lib/ultimates/kpi-aggregation";
import { buildCumulativeSeries, type UltimatesSeries } from "@/lib/ultimates/cumulative-chart";
import { KpiRow } from "./kpi-row";
import { GoalProgressBar } from "./goal-progress-bar";
import { CumulativeChart } from "./cumulative-chart";
import { RosterTable } from "./roster-table";
import { RefreshControls } from "./refresh-controls";
import { SectionHeader } from "./section-header";
import { UploadBuyersModal } from "./upload-buyers-modal";
import { LinkBuyerModal } from "./link-buyer-modal";
import { UnlinkBuyerModal } from "./unlink-buyer-modal";
import { ExcludedOffersModal } from "./excluded-offers-modal";

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

// Bloco de pulso do skeleton no tema escuro (o skeleton compartilhado de
// src/components/ui/skeleton.tsx tem cores claras fixas — não serve aqui).
function SkeletonBlock({ height, radius = 11 }: { height: number; radius?: number }) {
  return (
    <div
      style={{
        height,
        background: "var(--surface-2)",
        borderRadius: radius,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

export function UltimatesDashboard({ cycle, role }: UltimatesDashboardProps) {
  const [roster, setRoster] = useState<UltimatesRosterRow[] | null>(null);
  const [daily, setDaily] = useState<UltimatesDailyRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Incrementado ao clicar "Tentar novamente" ou após um refresh bem
  // sucedido — reexecuta o efeito de carga abaixo (mesmo padrão de
  // ultimates-screen.tsx: fetch inline no efeito + flag de cancelamento).
  const [reloadToken, setReloadToken] = useState(0);
  // Fluxos de escrita (task #124) — só montados para gestor em ciclo ativo.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<UltimatesRosterRow | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<UltimatesRosterRow | null>(null);
  // Ofertas excluídas da contabilidade (PRD 2026-07-30). Só o CONTADOR mora
  // aqui — a lista completa é do modal. Serve para sinalizar que os números
  // exibidos passaram por um filtro; sem isso o dashboard mentiria por omissão
  // para quem não configurou a exclusão.
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [excludedCount, setExcludedCount] = useState(0);
  // Série exibida no card "Evolução". Mora aqui (e não dentro do gráfico)
  // para sobreviver à troca de ciclo — ultimates-screen.tsx renderiza este
  // componente sem key, então quem compara a mesma métrica entre ciclos não
  // precisa reclicar o switch a cada troca.
  const [series, setSeries] = useState<UltimatesSeries>("renovacoes");

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

  // Carga do contador em efeito PRÓPRIO e tolerante a falha: é informação
  // acessória, não pode derrubar o dashboard para o estado de erro nem
  // atrasar KPIs/gráfico/tabela se a rota estiver lenta.
  useEffect(() => {
    let cancelled = false;

    async function loadExcludedCount() {
      try {
        const res = await fetch(`/api/ultimates/cycles/${cycle.id}/excluded-offers`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setExcludedCount(Array.isArray(data?.offers) ? data.offers.length : 0);
      } catch {
        // Silencioso de propósito — ver comentário acima.
      }
    }

    loadExcludedCount();
    return () => {
      cancelled = true;
    };
  }, [cycle.id, reloadToken]);

  function handleRefreshed() {
    setReloadToken((t) => t + 1);
  }

  const loading = roster === null || daily === null;
  const kpis = roster ? aggregateRosterKpis(roster) : null;
  // Escrita só para gestor e ciclo ativo (critério 11: ciclo encerrado tem
  // dashboard acessível, mas upload/vínculo/atualização bloqueados).
  const canWrite = role === "gestor" && cycle.status !== "encerrado";
  const baseRows = roster ? roster.filter((r) => r.buyer_id !== null) : [];

  function handleWriteDone() {
    setUploadOpen(false);
    setLinkTarget(null);
    setUnlinkTarget(null);
    setReloadToken((t) => t + 1);
  }

  return (
    <div data-testid="ultimates-dashboard-slot" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="ult-cycle-head">
        <div>
          <h2
            data-testid="ultimates-selected-cycle"
            style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)", margin: 0 }}
          >
            {cycle.name}
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
            {cycle.product_name ?? "Produto não identificado"}
          </p>
        </div>
        <div className="ult-cycle-actions">
          {canWrite && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setUploadOpen(true)}
              data-testid="ultimates-upload-btn"
            >
              Carregar base
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setExcludedOpen(true)}
            data-testid="ultimates-excluded-offers-btn"
          >
            {excludedCount > 0 ? `Ofertas excluídas (${excludedCount})` : "Ofertas excluídas"}
          </button>
          <RefreshControls
            cycleId={cycle.id}
            cycleStatus={cycle.status}
            lastRefreshAt={cycle.last_refresh_at}
            onRefreshed={handleRefreshed}
          />
        </div>
      </div>

      {loadError && (
        <div
          data-testid="ultimates-dashboard-error"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "56px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>
            Não foi possível carregar os dados do ciclo.
          </p>
          <button type="button" onClick={() => setReloadToken((t) => t + 1)} className="btn-secondary">
            Tentar novamente
          </button>
        </div>
      )}

      {!loadError && loading && (
        <div data-testid="ultimates-dashboard-loading" className="z-layout">
          <div className="ult-kpi-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} height={104} />
            ))}
          </div>
          <SkeletonBlock height={252} />
          <SkeletonBlock height={320} />
        </div>
      )}

      {!loadError && !loading && kpis && (
        <div className="z-layout">
          <section>
            <SectionHeader index="01" title="Visão do ciclo" desc="Base, renovações e novos compradores" />
            {excludedCount > 0 && (
              <p
                data-testid="ultimates-excluded-offers-note"
                style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 12px" }}
              >
                {excludedCount === 1
                  ? "1 oferta excluída da contabilidade"
                  : `${excludedCount} ofertas excluídas da contabilidade`}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <KpiRow kpis={kpis} />
              {cycle.goal_percent != null && (
                <GoalProgressBar goalPercent={cycle.goal_percent} currentPercent={kpis.renovadosPercent} />
              )}
            </div>
          </section>

          <section>
            <SectionHeader index="02" title="Evolução" desc="Renovações e novos compradores, dia a dia" />
            <CumulativeChart
              data={buildCumulativeSeries(daily ?? [], series)}
              series={series}
              onSeriesChange={setSeries}
            />
          </section>

          <section>
            <SectionHeader index="03" title="Roster" desc="Compradores do ciclo, busca e exportação" />
            <RosterTable
              rows={roster ?? []}
              role={role}
              onLinkClick={canWrite ? setLinkTarget : undefined}
              onUnlinkClick={canWrite ? setUnlinkTarget : undefined}
            />
          </section>
        </div>
      )}

      {/* Diferente dos demais modais, este NÃO é gateado por ciclo ativo:
          a lista de ofertas excluídas continua editável em ciclo encerrado
          (decisão 8 do PRD de 2026-07-30). Só o papel decide quem escreve. */}
      {excludedOpen && (
        <ExcludedOffersModal
          cycleId={cycle.id}
          canWrite={role === "gestor"}
          onChanged={handleRefreshed}
          onClose={() => setExcludedOpen(false)}
        />
      )}

      {uploadOpen && canWrite && (
        <UploadBuyersModal
          cycleId={cycle.id}
          onCommitted={handleWriteDone}
          onCancel={() => setUploadOpen(false)}
        />
      )}

      {linkTarget && canWrite && (
        <LinkBuyerModal
          cycleId={cycle.id}
          newBuyerRow={linkTarget}
          baseRows={baseRows}
          onLinked={handleWriteDone}
          onCancel={() => setLinkTarget(null)}
        />
      )}

      {unlinkTarget && canWrite && (
        <UnlinkBuyerModal
          cycleId={cycle.id}
          targetRow={unlinkTarget}
          onUnlinked={handleWriteDone}
          onCancel={() => setUnlinkTarget(null)}
        />
      )}
    </div>
  );
}
