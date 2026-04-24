"use client";

import { useEffect } from "react";
import type { ConviteFunilDestraveMetrics, ConviteProject } from "@/types/convite";

interface ConviteProjectDetailModalProps {
  open: boolean;
  project: ConviteProject | null;
  onClose: () => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function ConviteProjectDetailModal({
  open,
  project,
  onClose,
}: ConviteProjectDetailModalProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    if (open) {
      document.addEventListener("keydown", handleKey);
    }

    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !project) return null;

  const metrics = project.grupo === "funil_destrave" && isFunilDestraveMetrics(project.metrics)
    ? project.metrics
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 520,
          padding: 24,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
          title="Fechar"
        >
          ✕
        </button>

        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            paddingRight: 32,
          }}
        >
          {project.nome_projeto}
        </h2>
        <p
          style={{
            margin: "6px 0 18px",
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          {project.grupo === "funil_destrave" ? "Funil Destrave" : "Convite"} · {formatDate(project.data_inicio)} → {formatDate(project.data_fim)}
        </p>

        <div
          style={{
            height: 1,
            background: "var(--color-border)",
            marginBottom: 20,
          }}
        />

        {metrics ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <MetricBox
              label="Comparecimento"
              value={metrics.comparecimento.toLocaleString("pt-BR")}
            />
            <MetricBox
              label="Conv. Produto Principal"
              value={formatPercent(metrics.conv_produto_principal)}
            />
            <MetricBox
              label="Conv. Downsell"
              value={formatPercent(metrics.conv_downsell)}
            />
            <MetricBox
              label="Conv. Upsell"
              value={formatPercent(metrics.conv_upsell)}
            />
            <MetricBox
              label="CAC Geral"
              value={formatCurrency(metrics.cac_geral)}
            />
            <MetricBox
              label="Última Atualização"
              value={formatDate(metrics.updated_at)}
            />
          </div>
        ) : (
          <div
            style={{
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--color-border)",
              background: "var(--color-bg)",
              padding: "20px 16px",
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
              Esse projeto ainda não possui métricas disponíveis.
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: "var(--color-text-muted)",
                lineHeight: 1.5,
              }}
            >
              Para o card começar a refletir o funil, a coluna
              {" "}
              <code>projeto</code>
              {" "}
              da tabela
              {" "}
              <code>dash_gestao_convite_funil_destrave</code>
              {" "}
              precisa usar exatamente o nome cadastrado acima.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function isFunilDestraveMetrics(
  metrics: ConviteProject["metrics"]
): metrics is ConviteFunilDestraveMetrics {
  return !!metrics && "comparecimento" in metrics;
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        borderRadius: "var(--radius-sm)",
        padding: "14px 14px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 17,
          fontWeight: 700,
          color: "var(--color-text)",
          lineHeight: 1.3,
        }}
      >
        {value}
      </p>
    </div>
  );
}
