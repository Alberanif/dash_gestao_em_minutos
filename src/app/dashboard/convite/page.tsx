"use client";

import { useCallback, useEffect, useState } from "react";
import { ConviteAdsComercialConfigModal } from "@/components/convite/ads-comercial-config-modal";
import { PageHeader } from "@/components/layout/page-header";
import { ConviteProjectCard } from "@/components/convite/project-card";
import { ConviteProjectDetailModal } from "@/components/convite/project-detail-modal";
import { ConviteProjectFormModal } from "@/components/convite/project-form-modal";
import { ConviteUltimateDetailModal } from "@/components/convite/ultimate-detail-modal";
import {
  CONVITE_GROUP_OPTIONS,
  type ConviteGroup,
  type ConviteProject,
} from "@/types/convite";

function EmptyProjectsState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="surface-card"
      style={{
        borderStyle: "dashed",
        padding: "28px 24px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 13,
          color: "var(--color-text-muted)",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

function LoadingCard() {
  return (
    <div
      className="animate-pulse rounded-[var(--radius-card)]"
      style={{
        height: 210,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    />
  );
}

export default function ConviteDashboardPage() {
  const [projects, setProjects] = useState<ConviteProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [initialGroup, setInitialGroup] = useState<ConviteGroup>("funil_destrave");
  const [selectedProject, setSelectedProject] = useState<ConviteProject | null>(null);
  const [selectedUltimateProject, setSelectedUltimateProject] = useState<ConviteProject | null>(null);
  const [configProject, setConfigProject] = useState<ConviteProject | null>(null);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch("/api/convite/projects");
      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleCreateProject(data: {
    grupo: ConviteGroup;
    nome_projeto: string;
    data_inicio: string;
    data_fim: string;
  }) {
    const response = await fetch("/api/convite/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error ?? "Erro ao salvar projeto");
    }

    await loadProjects();
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Convite"
        subtitle="Gerencie os projetos de Convite e acompanhe as frentes conectadas com a base de dados"
        actions={
          <button
            onClick={() => {
              setInitialGroup("funil_destrave");
              setFormOpen(true);
            }}
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
            + Novo Projeto
          </button>
        }
      />

      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
        {CONVITE_GROUP_OPTIONS.map((groupOption) => {
          const sectionProjects = projects.filter((project) => project.grupo === groupOption.value);
          const isFunilDestrave = groupOption.value === "funil_destrave";
          const isAdsComercial = groupOption.value === "funil_ads_comercial";

          return (
            <section key={groupOption.value}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex items-center gap-3" style={{ flex: 1 }}>
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  {groupOption.label}
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
                  {sectionProjects.length} projetos
                </span>
              </div>

              <button
                onClick={() => {
                  setInitialGroup(groupOption.value);
                  setFormOpen(true);
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "none",
                  background: "var(--color-primary)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 20,
                  fontWeight: 500,
                  lineHeight: 1,
                }}
                title={`Criar projeto em ${groupOption.label}`}
                aria-label={`Criar projeto em ${groupOption.label}`}
              >
                +
              </button>
            </div>

            {loadingProjects ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 16,
                }}
              >
                {[0, 1, 2].map((key) => (
                  <LoadingCard key={`${groupOption.value}-${key}`} />
                ))}
              </div>
            ) : sectionProjects.length === 0 ? (
              <EmptyProjectsState
                title={`Nenhum projeto listado em ${groupOption.label}`}
                description={
                  isFunilDestrave
                    ? "Cadastre o primeiro projeto para vincular o período e começar a ler as métricas da tabela dash_gestao_convite_funil_destrave."
                    : isAdsComercial
                    ? "Cadastre o projeto e use o botão Configurar para conectar Hotmart, Meta Ads e eventos orgânicos."
                    : "Cadastre os projetos desta frente. As visualizações específicas desse grupo podem ser conectadas na próxima etapa."
                }
                action={
                  <button
                    onClick={() => {
                      setInitialGroup(groupOption.value);
                      setFormOpen(true);
                    }}
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-primary)",
                      background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                      color: "var(--color-primary)",
                      cursor: "pointer",
                    }}
                  >
                    Criar primeiro projeto
                  </button>
                }
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 16,
                }}
              >
                {sectionProjects.map((project) => (
                  <ConviteProjectCard
                    key={project.id}
                    project={project}
                    onClick={
                    project.grupo === "funil_destrave"
                      ? () => setSelectedProject(project)
                      : project.grupo === "ultimate"
                      ? () => setSelectedUltimateProject(project)
                      : undefined
                  }
                    onConfigureAdsComercial={
                      project.grupo === "funil_ads_comercial"
                        ? () => setConfigProject(project)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
            </section>
          );
        })}
      </div>

      <ConviteProjectFormModal
        open={formOpen}
        initialGroup={initialGroup}
        onClose={() => setFormOpen(false)}
        onSave={handleCreateProject}
      />

      <ConviteProjectDetailModal
        open={!!selectedProject}
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      <ConviteUltimateDetailModal
        open={!!selectedUltimateProject}
        project={selectedUltimateProject}
        onClose={() => setSelectedUltimateProject(null)}
      />

      <ConviteAdsComercialConfigModal
        open={!!configProject}
        project={configProject}
        onClose={() => setConfigProject(null)}
        onSaved={loadProjects}
      />
    </div>
  );
}
