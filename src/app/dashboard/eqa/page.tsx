"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FunnelCard } from "@/components/eqa/funnel-card";
import { FunnelDetailModal } from "@/components/eqa/funnel-detail-modal";
import { FunnelFormModal } from "@/components/eqa/funnel-form-modal";
import { EventosCard } from "@/components/eqa-eventos/eventos-card";
import { EventosDetailModal } from "@/components/eqa-eventos/eventos-detail-modal";
import { EventosFormModal } from "@/components/eqa-eventos/eventos-form-modal";
import { SocialSellerSection } from "@/components/social-seller/social-seller-section";
import type { Funnel, FunnelMetrics } from "@/types/funnels";
import type { EqaEventosProject } from "@/types/eqa-eventos";

export default function EQAPage() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, FunnelMetrics>>({});
  const [loadingFunnels, setLoadingFunnels] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Modal de detalhes
  const [viewingFunnel, setViewingFunnel] = useState<Funnel | null>(null);

  // Modal de criação/edição
  const [formOpen, setFormOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | undefined>(undefined);

  // Eventos Comercial
  const [eventosProjects, setEventosProjects] = useState<EqaEventosProject[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [viewingEvento, setViewingEvento] = useState<EqaEventosProject | null>(null);
  const [eventoFormOpen, setEventoFormOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<EqaEventosProject | undefined>(undefined);

  const fetchMetrics = useCallback(async (funnelList: Funnel[]) => {
    if (funnelList.length === 0) return;
    setLoadingMetrics(true);
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
    setLoadingMetrics(false);
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

  const loadEventosProjects = useCallback(async () => {
    setLoadingEventos(true);
    try {
      const res = await fetch("/api/eqa-eventos");
      const data = await res.json();
      const list: EqaEventosProject[] = Array.isArray(data) ? data : [];
      setEventosProjects(list);
    } catch {
      setEventosProjects([]);
    } finally {
      setLoadingEventos(false);
    }
  }, []);

  useEffect(() => {
    loadFunnels();
    loadEventosProjects();
  }, [loadFunnels, loadEventosProjects]);

  async function handleSave(
    formData: Omit<Funnel, "id" | "created_at" | "updated_at">
  ) {
    const method = editingFunnel ? "PUT" : "POST";
    const url = editingFunnel
      ? `/api/funnels/${editingFunnel.id}`
      : "/api/funnels";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Erro ao salvar");
    }

    await loadFunnels();
  }

  async function handleDelete(funnel: Funnel) {
    if (!confirm(`Excluir o funil "${funnel.name}"? Esta ação não pode ser desfeita.`)) return;

    const res = await fetch(`/api/funnels/${funnel.id}`, { method: "DELETE" });
    if (res.ok) {
      setFunnels((prev) => prev.filter((f) => f.id !== funnel.id));
      setMetricsMap((prev) => {
        const next = { ...prev };
        delete next[funnel.id];
        return next;
      });
    }
  }

  async function handleSaveEvento(
    formData: Omit<EqaEventosProject, "id" | "created_at" | "updated_at">
  ) {
    const method = editingEvento ? "PUT" : "POST";
    const url = editingEvento
      ? `/api/eqa-eventos/${editingEvento.id}`
      : "/api/eqa-eventos";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Erro ao salvar");
    }

    await loadEventosProjects();
  }

  async function handleDeleteEvento(project: EqaEventosProject) {
    if (!confirm(`Excluir o evento "${project.name}"? Esta ação não pode ser desfeita.`)) return;

    const res = await fetch(`/api/eqa-eventos/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      setEventosProjects((prev) => prev.filter((p) => p.id !== project.id));
    }
  }

  function openCreate() {
    setEditingFunnel(undefined);
    setFormOpen(true);
  }

  function openEdit(funnel: Funnel) {
    setEditingFunnel(funnel);
    setFormOpen(true);
  }

  function openCreateEvento() {
    setEditingEvento(undefined);
    setEventoFormOpen(true);
  }

  function openEditEvento(project: EqaEventosProject) {
    setEditingEvento(project);
    setEventoFormOpen(true);
  }

  const destraveFunnels = funnels.filter((f) => f.type === "destrave");

  return (
    <div className="min-h-full">
      <PageHeader
        title="EQA — Eventos de Qualificação"
        subtitle="Gerencie seus funis de performance"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={openCreate}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--color-primary)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              + Novo Funil
            </button>
            <button
              onClick={openCreateEvento}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--color-primary)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              + Novo Evento
            </button>
          </div>
        }
      />

      <div style={{ padding: 24 }}>
        {loadingFunnels || loadingEventos ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-[var(--radius-card)]"
                style={{
                  height: 160,
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Seção Destrave */}
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  Funis Destrave
                </h2>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 99,
                    padding: "2px 10px",
                  }}
                >
                  {destraveFunnels.length}
                </span>
              </div>

              {destraveFunnels.length === 0 ? (
                <div
                  style={{
                    border: "2px dashed var(--color-border)",
                    borderRadius: "var(--radius-card)",
                    padding: "40px 24px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
                    Nenhum funil Destrave criado ainda
                  </p>
                  <button
                    onClick={openCreate}
                    style={{
                      padding: "7px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-primary)",
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      cursor: "pointer",
                    }}
                  >
                    Criar primeiro funil
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {destraveFunnels.map((funnel) => (
                    <FunnelCard
                      key={funnel.id}
                      funnel={funnel}
                      metrics={metricsMap[funnel.id] ?? null}
                      loading={loadingMetrics && !metricsMap[funnel.id]}
                      onClick={() => setViewingFunnel(funnel)}
                      onEdit={() => openEdit(funnel)}
                      onDelete={() => handleDelete(funnel)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Seção EQA Eventos Comercial */}
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  EQA Eventos Comercial
                </h2>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 99,
                    padding: "2px 10px",
                  }}
                >
                  {eventosProjects.length}
                </span>
              </div>

              {eventosProjects.length === 0 ? (
                <div
                  style={{
                    border: "2px dashed var(--color-border)",
                    borderRadius: "var(--radius-card)",
                    padding: "40px 24px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
                    Nenhum evento criado ainda
                  </p>
                  <button
                    onClick={openCreateEvento}
                    style={{
                      padding: "7px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-primary)",
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      cursor: "pointer",
                    }}
                  >
                    Criar primeiro evento
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {eventosProjects.map((project) => (
                    <EventosCard
                      key={project.id}
                      project={project}
                      onClick={() => setViewingEvento(project)}
                      onEdit={() => openEditEvento(project)}
                      onDelete={() => handleDeleteEvento(project)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Seção Social Seller */}
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  Social Seller
                </h2>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 99,
                    padding: "2px 10px",
                  }}
                >
                  {/* weeks count will be displayed inside SocialSellerSection */}
                </span>
              </div>
              <SocialSellerSection />
            </section>
          </>
        )}
      </div>

      {/* Modal de detalhes */}
      {viewingFunnel && metricsMap[viewingFunnel.id] && (
        <FunnelDetailModal
          funnel={viewingFunnel}
          metrics={metricsMap[viewingFunnel.id]}
          open={!!viewingFunnel}
          onClose={() => setViewingFunnel(null)}
        />
      )}

      {/* Modal de criação/edição Funil */}
      <FunnelFormModal
        funnel={editingFunnel}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      {/* Modal de detalhes Eventos */}
      {viewingEvento && (
        <EventosDetailModal
          project={viewingEvento}
          open={!!viewingEvento}
          onClose={() => setViewingEvento(null)}
        />
      )}

      {/* Modal de criação/edição Eventos */}
      <EventosFormModal
        project={editingEvento}
        open={eventoFormOpen}
        onClose={() => setEventoFormOpen(false)}
        onSave={handleSaveEvento}
      />
    </div>
  );
}
