"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProjectCard } from "@/components/indicadores/project-card";
import { ProjectFormModal } from "@/components/indicadores/project-form-modal";
import type { IndicadoresProject } from "@/types/indicadores";

export default function IndicadoresPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<IndicadoresProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IndicadoresProject | undefined>(undefined);
  const [search, setSearch] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/indicadores/projects");
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleSave(formData: { name: string; hotmart_account_id: string | null; hotmart_product_ids: string[]; campaign_terms: string[]; organic_lead_events: string[] }) {
    const method = editing ? "PUT" : "POST";
    const url = editing
      ? `/api/indicadores/projects/${editing.id}`
      : "/api/indicadores/projects";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Erro ao salvar");
    }
    await loadProjects();
  }

  async function handleDelete(project: IndicadoresProject) {
    if (!confirm(`Excluir o projeto "${project.name}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/indicadores/projects/${project.id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
  }

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(project: IndicadoresProject) {
    setEditing(project);
    setFormOpen(true);
  }

  const filtered = search.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.campaign_terms.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : projects;

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "20px 24px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", marginBottom: 2 }}>
            Projetos
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            {loading ? "Carregando…" : `${projects.length} projeto${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo Projeto
        </button>
      </header>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {!loading && projects.length > 0 && (
          <div style={{ position: "relative", maxWidth: 360 }}>
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-text-muted)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Buscar projeto ou termo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-control"
              style={{ paddingLeft: 34, fontSize: 13 }}
            />
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 110,
                  borderRadius: "var(--radius-card)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : filtered.length === 0 && search ? (
          <div
            style={{
              padding: "40px 24px",
              textAlign: "center",
              background: "var(--color-surface)",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block" }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              Nenhum resultado para &ldquo;{search}&rdquo;
            </p>
            <button
              onClick={() => setSearch("")}
              style={{ marginTop: 10, fontSize: 13, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Limpar busca
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div
            style={{
              border: "2px dashed var(--color-border)",
              borderRadius: "var(--radius-card)",
              padding: "56px 24px",
              textAlign: "center",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 14px", display: "block", opacity: 0.5 }}>
              <rect x="2" y="3" width="6" height="18" rx="1" />
              <rect x="10" y="8" width="6" height="13" rx="1" />
              <rect x="18" y="5" width="4" height="16" rx="1" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>
              Nenhum projeto ainda
            </p>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
              Crie seu primeiro projeto para começar a acompanhar os indicadores
            </p>
            <button onClick={openCreate} className="btn-primary" style={{ margin: "0 auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Criar primeiro projeto
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/indicadores/${project.id}`)}
                onEdit={() => openEdit(project)}
                onDelete={() => handleDelete(project)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectFormModal
        project={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
