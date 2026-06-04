"use client";

import { useEffect, useState, useCallback } from "react";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { NarrLabel } from "@/components/gv/narr-label";
import { FunnelCard } from "@/components/gv/funnel-card";
import { FunnelDetailDrawer } from "@/components/gv/funnel-detail-drawer";
import { FunnelFormModal } from "@/components/eqa/funnel-form-modal";
import { EventCard } from "@/components/gv/event-card";
import { StatCard } from "@/components/gv/stat-card";
import type { Funnel, FunnelMetrics } from "@/types/funnels";
import type { EqaEventosProject, EqaEventosMetrics } from "@/types/eqa-eventos";
import { today, dateSubtractDays } from "@/lib/date-utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function funnelPeriod(funnel: Funnel): string {
  const start = new Date(funnel.start_date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  const end = new Date(funnel.end_date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

function funnelSalesGoal(funnel: Funnel): number {
  return funnel.goal_sales;
}

function funnelActualSales(metrics: FunnelMetrics | null): number {
  if (!metrics) return 0;
  if (metrics.type === "lancamento_pago") return metrics.total_sales;
  return 0;
}

function funnelActualLeads(metrics: FunnelMetrics | null): number {
  if (!metrics) return 0;
  if (metrics.type === "lancamento") return metrics.total_leads;
  return 0;
}

function deriveFunnelSteps(
  funnel: Funnel,
  metrics: FunnelMetrics | null
): Array<{ label: string; value: number; conv: number }> {
  if (funnel.type === "lancamento_pago") {
    const goal = funnelSalesGoal(funnel);
    const sales = funnelActualSales(metrics);
    const pace = metrics?.type === "lancamento_pago" ? metrics.pace_diario : 0;
    const conv = goal > 0 ? Math.min(100, Math.round((sales / goal) * 100)) : 0;
    return [
      { label: "Meta", value: goal, conv: 100 },
      { label: "Vendas", value: sales, conv },
      { label: "Ritmo/dia", value: pace, conv: Math.min(100, conv) },
    ];
  }
  const leads = funnelActualLeads(metrics);
  const goalLeads =
    metrics?.type === "lancamento" ? (metrics.leads_remaining + leads) : leads;
  const convL = goalLeads > 0 ? Math.min(100, Math.round((leads / goalLeads) * 100)) : 0;
  return [
    { label: "Meta leads", value: goalLeads, conv: 100 },
    { label: "Leads", value: leads, conv: convL },
  ];
}

function deriveFunnelVerdict(funnel: Funnel, metrics: FunnelMetrics | null): string {
  if (!metrics) return "Sem dados suficientes para análise";
  const goal = funnelSalesGoal(funnel);
  if (funnel.type === "lancamento_pago") {
    const sales = metrics.type === "lancamento_pago" ? metrics.total_sales : 0;
    const pct = goal > 0 ? (sales / goal) * 100 : 0;
    if (pct >= 100) return "Meta batida";
    if (pct >= 70) return "No ritmo — continue o esforço";
    return "Abaixo do esperado — revisar campanha";
  }
  if (metrics.type === "lancamento") {
    const leads = metrics.total_leads;
    const remaining = metrics.leads_remaining;
    const total = leads + remaining;
    const pct = total > 0 ? (leads / total) * 100 : 0;
    if (pct >= 80) return "Captação no verde";
    if (pct >= 50) return "Captação abaixo do ritmo";
    return "Captação crítica — revisão necessária";
  }
  return "—";
}

function deriveFunnelStatus(
  funnel: Funnel,
  metrics: FunnelMetrics | null
): "green" | "amber" {
  if (!metrics) return "amber";
  const goal = funnelSalesGoal(funnel);
  if (funnel.type === "lancamento_pago") {
    const sales = metrics.type === "lancamento_pago" ? metrics.total_sales : 0;
    return (goal > 0 && sales / goal >= 0.7) ? "green" : "amber";
  }
  if (metrics.type === "lancamento") {
    const total = metrics.total_leads + metrics.leads_remaining;
    return (total > 0 && metrics.total_leads / total >= 0.5) ? "green" : "amber";
  }
  return "amber";
}

function derivePulseBannerStatus(
  funnels: Funnel[],
  metricsMap: Record<string, FunnelMetrics>
): "green" | "amber" | "red" {
  if (funnels.length === 0) return "amber";
  const statuses = funnels.map((f) =>
    deriveFunnelStatus(f, metricsMap[f.id] ?? null)
  );
  const greenCount = statuses.filter((s) => s === "green").length;
  const amberCount = statuses.filter((s) => s === "amber").length;
  if (greenCount === funnels.length) return "green";
  if (amberCount === funnels.length) return "red";
  return "amber";
}

// ── icons ────────────────────────────────────────────────────────────────────

function IconPeople() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconBars() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function EQAPage() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, FunnelMetrics>>({});
  const [loadingFunnels, setLoadingFunnels] = useState(true);

  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [showFunnelModal, setShowFunnelModal] = useState(false);

  const [eventosProjects, setEventosProjects] = useState<EqaEventosProject[]>([]);
  const [eventosMetricsMap, setEventosMetricsMap] = useState<Record<string, EqaEventosMetrics>>({});
  const [loadingEventos, setLoadingEventos] = useState(true);

  const fetchMetrics = useCallback(async (funnelList: Funnel[]) => {
    if (funnelList.length === 0) return;
    const results = await Promise.all(
      funnelList.map((f) =>
        fetch(`/api/funnels/${f.id}/metrics`)
          .then((r) => r.json())
          .then((data): [string, FunnelMetrics | null] => {
            if (data.error) return [f.id, null];
            return [f.id, data as FunnelMetrics];
          })
          .catch((): [string, null] => [f.id, null])
      )
    );
    const map: Record<string, FunnelMetrics> = {};
    for (const [id, m] of results) {
      if (m) map[id] = m;
    }
    setMetricsMap(map);
  }, []);

  const fetchEventosMetrics = useCallback(async (list: EqaEventosProject[]) => {
    if (list.length === 0) return;
    const end = today();
    const start = dateSubtractDays(end, 7);
    const results = await Promise.all(
      list.map((e) =>
        fetch(`/api/eqa-eventos/${e.id}/metrics?start_date=${start}&end_date=${end}`)
          .then((r) => r.json())
          .then((data): [string, EqaEventosMetrics | null] => {
            if (data.error) return [e.id, null];
            return [e.id, data as EqaEventosMetrics];
          })
          .catch((): [string, null] => [e.id, null])
      )
    );
    const map: Record<string, EqaEventosMetrics> = {};
    for (const [id, m] of results) {
      if (m) map[id] = m;
    }
    setEventosMetricsMap(map);
  }, []);

  const loadFunnels = useCallback(async () => {
    setLoadingFunnels(true);
    try {
      const res = await fetch("/api/funnels");
      const data = await res.json();
      const list: Funnel[] = Array.isArray(data) ? data : [];
      setFunnels(list);
      await fetchMetrics(list);
    } catch {
      setFunnels([]);
    } finally {
      setLoadingFunnels(false);
    }
  }, [fetchMetrics]);

  const loadEventos = useCallback(async () => {
    setLoadingEventos(true);
    try {
      const res = await fetch("/api/eqa-eventos");
      const data = await res.json();
      const list: EqaEventosProject[] = Array.isArray(data) ? data : [];
      setEventosProjects(list);
      await fetchEventosMetrics(list);
    } catch {
      setEventosProjects([]);
    } finally {
      setLoadingEventos(false);
    }
  }, [fetchEventosMetrics]);

  useEffect(() => {
    loadFunnels();
    loadEventos();
  }, [loadFunnels, loadEventos]);

  const handleCreateFunnel = useCallback(async (data: Omit<Funnel, "id" | "created_at" | "updated_at">) => {
    const res = await fetch("/api/funnels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao criar funil");
    await loadFunnels();
  }, [loadFunnels]);

  const handleSaveFunnel = useCallback(async (data: Omit<Funnel, "id" | "created_at" | "updated_at">) => {
    if (!selectedFunnelId) return;
    const res = await fetch(`/api/funnels/${selectedFunnelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao atualizar funil");
    await loadFunnels();
  }, [selectedFunnelId, loadFunnels]);

  const handleDeleteFunnel = useCallback(async (id: string) => {
    const res = await fetch(`/api/funnels/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao excluir funil");
    setSelectedFunnelId(null);
    await loadFunnels();
  }, [loadFunnels]);

  // ── derived state ────────────────────────────────────────────────────────

  const loading = loadingFunnels || loadingEventos;

  const pulseStatus = derivePulseBannerStatus(funnels, metricsMap);
  const greenCount = funnels.filter(
    (f) => deriveFunnelStatus(f, metricsMap[f.id] ?? null) === "green"
  ).length;
  const amberCount = funnels.length - greenCount;

  const pulseHeadline =
    funnels.length === 0
      ? "Nenhum funil configurado"
      : greenCount === funnels.length
      ? `${greenCount} ${greenCount === 1 ? "funil" : "funis"} no verde`
      : `${greenCount} ${greenCount === 1 ? "funil" : "funis"} no verde, ${amberCount} com atenção`;

  const pulseSub =
    funnels.length === 0
      ? "Crie o primeiro funil para começar a acompanhar conversões."
      : amberCount > 0
      ? "Revise os funis marcados com atenção e ajuste as etapas com queda de conversão."
      : "Todos os funis estão convertendo acima da meta. Continue monitorando.";

  const selectedFunnel = funnels.find((f) => f.id === selectedFunnelId) ?? null;
  const selectedMetrics = selectedFunnelId !== null ? (metricsMap[selectedFunnelId] ?? null) : null;

  return (
    <>
    <div className="main">
      <GvPageHeader
        eyebrow="Gestão à Vista · Gestão em 4 Minutos"
        title="EQA — Eventos de Qualificação"
        sub="Como cada funil está convertendo do topo até a venda"
      />

      {loading ? (
        <div className="section">
          <div className="grid g3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="lc" style={{ minHeight: 160, opacity: 0.4 }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="section">

          {/* 01 — Status Geral */}
          <NarrLabel step="01" label="Status Geral" />
          <PulseBanner
            status={pulseStatus}
            headline={pulseHeadline}
            sub={pulseSub}
            chips={[
              ...(greenCount > 0
                ? [{ label: `${greenCount} batendo meta`, status: "green" as const }]
                : []),
              ...(amberCount > 0
                ? [{ label: `${amberCount} abaixo`, status: "amber" as const }]
                : []),
              { label: `${funnels.length} funis ativos`, status: "muted" as const },
            ]}
          />

          {/* 02 — Funis Ativos */}
          <NarrLabel
            step="02"
            label="Funis Ativos"
            desc={`${funnels.length} ${funnels.length === 1 ? "funil" : "funis"}`}
          />
          <div className="grid g3">
            {funnels.map((f) => (
              <FunnelCard
                key={f.id}
                name={f.name}
                period={funnelPeriod(f)}
                steps={deriveFunnelSteps(f, metricsMap[f.id] ?? null)}
                status={deriveFunnelStatus(f, metricsMap[f.id] ?? null)}
                verdict={deriveFunnelVerdict(f, metricsMap[f.id] ?? null)}
                onClick={() => setSelectedFunnelId(f.id)}
              />
            ))}
            <button
              onClick={() => setShowFunnelModal(true)}
              className="lc"
              style={{
                display: "grid",
                placeItems: "center",
                minHeight: 120,
                borderStyle: "dashed",
                background: "none",
                cursor: "pointer",
                width: "100%",
                textAlign: "center",
              }}
            >
              <span className="xmuted">+ Novo funil</span>
            </button>
          </div>

          {/* 03 — EQA Eventos Comercial */}
          <NarrLabel step="03" label="EQA Eventos Comercial" />
          <div className="grid g3">
            {eventosProjects.map((p) => {
              const m = eventosMetricsMap[p.id] ?? null;
              const leads = m?.total_leads ?? 0;
              const convPct = leads > 0 ? Math.min(100, leads) : 0;
              return (
                <EventCard
                  key={p.id}
                  name={p.name}
                  date={new Date(p.created_at).toLocaleDateString("pt-BR")}
                  presence={convPct}
                  conv={convPct}
                  target={10}
                  status={m && m.total_leads > 0 ? "green" : "amber"}
                />
              );
            })}
            <div
              className="lc"
              style={{
                display: "grid",
                placeItems: "center",
                minHeight: 120,
                borderStyle: "dashed",
              }}
            >
              <span className="xmuted">+ Novo evento</span>
            </div>
          </div>

          {/* 04 — Social Seller */}
          <NarrLabel
            step="04"
            label="Social Seller"
            desc="Semana 18 — atualização semanal"
          />
          <div className="grid g4">
            <StatCard
              icon={<IconPeople />}
              title="Vendedores Ativos"
              value="14"
              delta={7.7}
              status="green"
              foot="<strong>1 a mais</strong> que a semana passada"
            />
            <StatCard
              icon={<IconSpark />}
              title="Conversas Iniciadas"
              value="2.483"
              delta={12.0}
              status="green"
              foot="<strong>177/dia</strong> em média"
            />
            <StatCard
              icon={<IconBars />}
              title="Vendas Fechadas"
              value="186"
              delta={4.5}
              status="green"
              foot="Meta: <strong>180</strong>"
            />
            <StatCard
              icon={<IconClock />}
              title="Tempo de Resposta"
              value="12"
              unit="min"
              delta={-28.0}
              status="green"
              foot="Meta: <strong>≤ 30 min</strong>"
            />
          </div>

        </div>
      )}
    </div>
    <FunnelDetailDrawer
      funnel={selectedFunnel}
      metrics={selectedMetrics}
      period={selectedFunnel ? funnelPeriod(selectedFunnel) : ""}
      status={selectedFunnel ? deriveFunnelStatus(selectedFunnel, selectedMetrics) : "amber"}
      steps={selectedFunnel ? deriveFunnelSteps(selectedFunnel, selectedMetrics) : []}
      verdict={selectedFunnel ? deriveFunnelVerdict(selectedFunnel, selectedMetrics) : ""}
      onClose={() => setSelectedFunnelId(null)}
      onSave={selectedFunnel ? handleSaveFunnel : undefined}
      onDelete={selectedFunnel ? () => handleDeleteFunnel(selectedFunnel.id) : undefined}
    />
    <FunnelFormModal
      open={showFunnelModal}
      onClose={() => setShowFunnelModal(false)}
      onSave={handleCreateFunnel}
    />
    </>
  );
}
