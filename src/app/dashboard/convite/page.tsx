"use client";

import { useCallback, useEffect, useState } from "react";
import { ConviteAdsComercialConfigModal } from "@/components/convite/ads-comercial-config-modal";
import { ConviteFccDetailModal } from "@/components/convite/fcc-detail-modal";
import { ConviteMccDetailModal } from "@/components/convite/mcc-detail-modal";
import { ConviteProjectDetailModal } from "@/components/convite/project-detail-modal";
import { ConviteProjectFormModal } from "@/components/convite/project-form-modal";
import { ConviteUltimateDetailModal } from "@/components/convite/ultimate-detail-modal";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { NarrLabel } from "@/components/gv/narr-label";
import { ProjectCard } from "@/components/gv/project-card";
import { PulseBanner } from "@/components/gv/pulse-banner";
import {
  CONVITE_GROUP_OPTIONS,
  type ConviteAdsComercialMetrics,
  type ConviteFccMetrics,
  type ConviteFunilDestraveMetrics,
  type ConviteGroup,
  type ConviteMccMetrics,
  type ConviteProject,
  type ConviteUltimateMetrics,
} from "@/types/convite";

type ProjectStatus = "green" | "amber" | "red";

function isFunilDestraveMetrics(
  m: ConviteProject["metrics"]
): m is ConviteFunilDestraveMetrics {
  return !!m && "comparecimento" in m;
}

function isAdsComercialMetrics(
  m: ConviteProject["metrics"]
): m is ConviteAdsComercialMetrics {
  return !!m && "total_sales" in m;
}

function isUltimateMetrics(
  m: ConviteProject["metrics"]
): m is ConviteUltimateMetrics {
  return !!m && "latest_numero_absoluto" in m;
}

function isFccMetrics(
  m: ConviteProject["metrics"]
): m is ConviteFccMetrics {
  return !!m && "latest_perc_assessment" in m;
}

function isMccMetrics(
  m: ConviteProject["metrics"]
): m is ConviteMccMetrics {
  return !!m && "latest_perc_ultimate" in m;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function deriveProjectStatus(project: ConviteProject): ProjectStatus {
  if (project.grupo === "funil_ads_comercial") {
    if (!project.ads_comercial_config) return "red";
    if (!project.metrics) return "amber";
    return "green";
  }
  if (!project.metrics) return "amber";
  return "green";
}

interface ProjectCardData {
  mainMetric: string;
  value: string;
  subMetric: string;
  sub: string;
}

function deriveCardData(project: ConviteProject): ProjectCardData {
  if (project.grupo === "funil_destrave" && isFunilDestraveMetrics(project.metrics)) {
    return {
      mainMetric: "Comparecimento",
      value: project.metrics.comparecimento.toLocaleString("pt-BR"),
      subMetric: "Conv. PP",
      sub: formatPercent(project.metrics.conv_produto_principal),
    };
  }
  if (project.grupo === "funil_ads_comercial" && isAdsComercialMetrics(project.metrics)) {
    return {
      mainMetric: "Vendas",
      value: project.metrics.total_sales.toLocaleString("pt-BR"),
      subMetric: "Conversão",
      sub: formatPercent(project.metrics.sales_conversion_rate),
    };
  }
  if (project.grupo === "ultimate" && isUltimateMetrics(project.metrics)) {
    return {
      mainMetric: "Nº Absoluto",
      value: project.metrics.latest_numero_absoluto.toLocaleString("pt-BR"),
      subMetric: "% Renovação",
      sub:
        project.metrics.latest_perc_renovacao !== null
          ? formatPercent(project.metrics.latest_perc_renovacao)
          : "—",
    };
  }
  if (project.grupo === "fcc" && isFccMetrics(project.metrics)) {
    return {
      mainMetric: "% Assessment",
      value:
        project.metrics.latest_perc_assessment !== null
          ? formatPercent(project.metrics.latest_perc_assessment)
          : "—",
      subMetric: "% PC ao Vivo",
      sub:
        project.metrics.latest_perc_pc_ao_vivo !== null
          ? formatPercent(project.metrics.latest_perc_pc_ao_vivo)
          : "—",
    };
  }
  if (project.grupo === "mcc" && isMccMetrics(project.metrics)) {
    return {
      mainMetric: "% Ultimate",
      value:
        project.metrics.latest_perc_ultimate !== null
          ? formatPercent(project.metrics.latest_perc_ultimate)
          : "—",
      subMetric: "% PC ao Vivo",
      sub:
        project.metrics.latest_perc_pc_ao_vivo !== null
          ? formatPercent(project.metrics.latest_perc_pc_ao_vivo)
          : "—",
    };
  }
  return {
    mainMetric: "Receita",
    value: project.grupo === "funil_ads_comercial" && isAdsComercialMetrics(project.metrics)
      ? formatCurrency(project.metrics.total_revenue)
      : "—",
    subMetric: "Status",
    sub: "Aguardando dados",
  };
}

function projectOnClick(
  project: ConviteProject,
  setSelectedProject: (p: ConviteProject) => void,
  setSelectedUltimateProject: (p: ConviteProject) => void,
  setSelectedFccProject: (p: ConviteProject) => void,
  setSelectedMccProject: (p: ConviteProject) => void,
  setConfigProject: (p: ConviteProject) => void
): (() => void) | undefined {
  if (project.grupo === "funil_destrave") return () => setSelectedProject(project);
  if (project.grupo === "ultimate") return () => setSelectedUltimateProject(project);
  if (project.grupo === "fcc") return () => setSelectedFccProject(project);
  if (project.grupo === "mcc") return () => setSelectedMccProject(project);
  if (project.grupo === "funil_ads_comercial") return () => setConfigProject(project);
  return undefined;
}

function derivePulseBanner(projects: ConviteProject[]): {
  status: "green" | "amber" | "red";
  headline: string;
  sub: string;
  chips: { label: string; status: "green" | "amber" | "red" | "muted" }[];
} {
  const healthy = projects.filter((p) => deriveProjectStatus(p) === "green").length;
  const attention = projects.filter((p) => deriveProjectStatus(p) === "amber").length;
  const critical = projects.filter((p) => deriveProjectStatus(p) === "red").length;
  const total = projects.length;

  let bannerStatus: "green" | "amber" | "red" = "green";
  let headline = "Todos os projetos com dados conectados";
  let sub = `${total} projeto${total !== 1 ? "s" : ""} monitorados`;

  if (total === 0) {
    bannerStatus = "amber";
    headline = "Nenhum projeto cadastrado ainda";
    sub = "Cadastre projetos para começar a acompanhar o funil de convite";
  } else if (critical > 0 && critical >= healthy) {
    bannerStatus = "red";
    headline = "Projetos críticos precisam de atenção";
    sub = `${critical} sem configuração ou dados`;
  } else if (attention > 0 && attention >= healthy) {
    bannerStatus = "amber";
    headline = "Alguns projetos aguardam dados";
    sub = `${attention} projeto${attention !== 1 ? "s" : ""} sem métricas ainda`;
  } else if (healthy === total && total > 0) {
    bannerStatus = "green";
    headline = "Todos os projetos com dados conectados";
    sub = `${total} projeto${total !== 1 ? "s" : ""} saudáveis`;
  } else {
    bannerStatus = "amber";
    headline = "Maioria dos projetos saudável";
    sub = `${healthy} saudáveis · ${attention} atenção · ${critical} críticos`;
  }

  const chips: { label: string; status: "green" | "amber" | "red" | "muted" }[] = [];
  if (healthy > 0) chips.push({ label: `${healthy} Saudáv${healthy === 1 ? "el" : "eis"}`, status: "green" });
  if (attention > 0) chips.push({ label: `${attention} Atenção`, status: "amber" });
  if (critical > 0) chips.push({ label: `${critical} Crítico${critical !== 1 ? "s" : ""}`, status: "red" });
  if (chips.length === 0) chips.push({ label: "Sem projetos", status: "muted" });

  return { status: bannerStatus, headline, sub, chips };
}

export default function ConviteDashboardPage() {
  const [projects, setProjects] = useState<ConviteProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [initialGroup, setInitialGroup] = useState<ConviteGroup>("funil_destrave");
  const [selectedProject, setSelectedProject] = useState<ConviteProject | null>(null);
  const [selectedUltimateProject, setSelectedUltimateProject] = useState<ConviteProject | null>(null);
  const [selectedFccProject, setSelectedFccProject] = useState<ConviteProject | null>(null);
  const [selectedMccProject, setSelectedMccProject] = useState<ConviteProject | null>(null);
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

  const pulse = derivePulseBanner(projects);

  return (
    <div className="main">
      <GvPageHeader
        title="Convite"
        sub="Cada projeto em uma frase: convidamos quantos, e quantos toparam"
      />

      <div className="section">
        {!loadingProjects && (
          <PulseBanner
            status={pulse.status}
            headline={pulse.headline}
            sub={pulse.sub}
            chips={pulse.chips}
          />
        )}

        {CONVITE_GROUP_OPTIONS.map((groupOption, idx) => {
          const sectionProjects = projects.filter(
            (project) => project.grupo === groupOption.value
          );
          const step = String(idx + 1).padStart(2, "0");

          return (
            <section key={groupOption.value}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <NarrLabel step={step} label={groupOption.label} />
                <button
                  onClick={() => {
                    setInitialGroup(groupOption.value);
                    setFormOpen(true);
                  }}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: "none",
                    background: "var(--bl, var(--color-primary))",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 18,
                    fontWeight: 500,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title={`Criar projeto em ${groupOption.label}`}
                  aria-label={`Criar projeto em ${groupOption.label}`}
                >
                  +
                </button>
              </div>

              {loadingProjects ? (
                <div className="grid g3">
                  {[0, 1, 2].map((key) => (
                    <div
                      key={`${groupOption.value}-${key}`}
                      style={{
                        height: 140,
                        background: "var(--sf, var(--color-surface))",
                        border: "1px solid var(--bv, var(--color-border))",
                        borderRadius: 10,
                        opacity: 0.5,
                      }}
                    />
                  ))}
                </div>
              ) : sectionProjects.length === 0 ? (
                <div
                  style={{
                    background: "var(--sf, var(--color-surface))",
                    border: "1px dashed var(--bv, var(--color-border))",
                    borderRadius: 10,
                    padding: "24px 20px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--tx, var(--color-text))",
                    }}
                  >
                    Nenhum projeto em {groupOption.label}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 14px",
                      fontSize: 12,
                      color: "var(--t2, var(--color-text-muted))",
                      lineHeight: 1.5,
                    }}
                  >
                    Cadastre o primeiro projeto desta frente para começar a acompanhar as métricas.
                  </p>
                  <button
                    onClick={() => {
                      setInitialGroup(groupOption.value);
                      setFormOpen(true);
                    }}
                    style={{
                      padding: "7px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: "1px solid var(--bl, var(--color-primary))",
                      background: "rgba(61,132,245,.1)",
                      color: "var(--bl, var(--color-primary))",
                      cursor: "pointer",
                    }}
                  >
                    Criar primeiro projeto
                  </button>
                </div>
              ) : (
                <div className="grid g3">
                  {sectionProjects.map((project) => {
                    const cardData = deriveCardData(project);
                    const status = deriveProjectStatus(project);
                    const onClick = projectOnClick(
                      project,
                      setSelectedProject,
                      setSelectedUltimateProject,
                      setSelectedFccProject,
                      setSelectedMccProject,
                      setConfigProject
                    );
                    return (
                      <ProjectCard
                        key={project.id}
                        name={project.nome_projeto}
                        start={formatDate(project.data_inicio)}
                        end={formatDate(project.data_fim)}
                        mainMetric={cardData.mainMetric}
                        value={cardData.value}
                        subMetric={cardData.subMetric}
                        sub={cardData.sub}
                        status={status}
                        onClick={onClick}
                      />
                    );
                  })}
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

      <ConviteFccDetailModal
        open={!!selectedFccProject}
        project={selectedFccProject}
        onClose={() => setSelectedFccProject(null)}
      />

      <ConviteMccDetailModal
        open={!!selectedMccProject}
        project={selectedMccProject}
        onClose={() => setSelectedMccProject(null)}
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
