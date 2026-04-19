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

  async function handleSave(formData: { name: string; hotmart_product_id: string; campaign_terms: string[] }) {
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

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)" }}>
          Projetos
        </h1>
        <button
          onClick={openCreate}
          style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600,
            borderRadius: "var(--radius-sm)", border: "none",
            background: "var(--color-primary)", color: "#fff", cursor: "pointer",
          }}
        >
          + Novo Projeto
        </button>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 100, borderRadius: "var(--radius-card)",
                background: "var(--color-surface)", border: "1px solid var(--color-border)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div
          style={{
            border: "2px dashed var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Nenhum projeto criado ainda
          </p>
          <button
            onClick={openCreate}
            style={{
              padding: "7px 16px", fontSize: 13, fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-primary)",
              background: "var(--color-primary-light)",
              color: "var(--color-primary)", cursor: "pointer",
            }}
          >
            Criar primeiro projeto
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {projects.map((project) => (
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

      <ProjectFormModal
        project={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
