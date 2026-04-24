"use client";

import type {
  ConviteAdsComercialMetrics,
  ConviteFccMetrics,
  ConviteFunilDestraveMetrics,
  ConviteMccMetrics,
  ConviteProject,
  ConviteUltimateMetrics,
} from "@/types/convite";

interface ConviteProjectCardProps {
  project: ConviteProject;
  onClick?: () => void;
  onConfigureAdsComercial?: () => void;
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

function fmtMonthYear(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function isFunilDestraveMetrics(
  metrics: ConviteProject["metrics"]
): metrics is ConviteFunilDestraveMetrics {
  return !!metrics && "comparecimento" in metrics;
}

function isAdsComercialMetrics(
  metrics: ConviteProject["metrics"]
): metrics is ConviteAdsComercialMetrics {
  return !!metrics && "total_sales" in metrics;
}

function isUltimateMetrics(
  metrics: ConviteProject["metrics"]
): metrics is ConviteUltimateMetrics {
  return !!metrics && "latest_numero_absoluto" in metrics;
}

function isFccMetrics(
  metrics: ConviteProject["metrics"]
): metrics is ConviteFccMetrics {
  return !!metrics && "latest_perc_assessment" in metrics;
}

function isMccMetrics(
  metrics: ConviteProject["metrics"]
): metrics is ConviteMccMetrics {
  return !!metrics && "latest_perc_ultimate" in metrics;
}

export function ConviteProjectCard({
  project,
  onClick,
  onConfigureAdsComercial,
}: ConviteProjectCardProps) {
  const isAdsComercial = project.grupo === "funil_ads_comercial";
  const hasClickableSurface = !isAdsComercial && !!onClick;

  return (
    <div
      onClick={hasClickableSurface ? onClick : undefined}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "16px",
        cursor: hasClickableSurface ? "pointer" : "default",
        transition: "box-shadow 0.15s, transform 0.1s",
      }}
      onMouseEnter={(event) => {
        const element = event.currentTarget as HTMLElement;
        element.style.boxShadow = "var(--shadow-md)";
        element.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(event) => {
        const element = event.currentTarget as HTMLElement;
        element.style.boxShadow = "var(--shadow-card)";
        element.style.transform = "translateY(0)";
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1.35,
            }}
          >
            {project.nome_projeto}
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            {formatDate(project.data_inicio)} → {formatDate(project.data_fim)}
          </p>
        </div>

        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 999,
            padding: "4px 8px",
            color:
              isAdsComercial
                ? project.ads_comercial_config
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)"
                : project.metrics
                ? "var(--color-primary)"
                : "var(--color-text-muted)",
            background:
              isAdsComercial
                ? project.ads_comercial_config
                  ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                  : "var(--color-bg)"
                : project.metrics
                ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                : "var(--color-bg)",
            border: "1px solid var(--color-border)",
          }}
        >
          {isAdsComercial
            ? project.ads_comercial_config
              ? "Configurado"
              : "Não configurado"
            : project.metrics
            ? "Ativo"
            : "Aguardando dados"}
        </span>
      </div>

      <div
        style={{
          height: 1,
          background: "var(--color-border)",
          margin: "14px 0",
        }}
      />

      {project.grupo === "funil_destrave" && isFunilDestraveMetrics(project.metrics) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="flex justify-between gap-4">
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              Comparecimento
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
              {project.metrics.comparecimento.toLocaleString("pt-BR")}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <MetricCell label="Conv. PP" value={formatPercent(project.metrics.conv_produto_principal)} />
            <MetricCell label="Conv. Down" value={formatPercent(project.metrics.conv_downsell)} />
            <MetricCell label="Conv. Up" value={formatPercent(project.metrics.conv_upsell)} />
            <MetricCell label="CAC Geral" value={formatCurrency(project.metrics.cac_geral)} />
          </div>
        </div>
      ) : project.grupo === "funil_ads_comercial" ? (
        <AdsComercialContent
          project={project}
          onConfigureAdsComercial={onConfigureAdsComercial}
        />
      ) : project.grupo === "ultimate" && isUltimateMetrics(project.metrics) ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <MetricCell
            label="Último mês"
            value={project.metrics.latest_month_year ? fmtMonthYear(project.metrics.latest_month_year) : "—"}
          />
          <MetricCell
            label="Nº Absoluto"
            value={project.metrics.latest_month_year ? project.metrics.latest_numero_absoluto.toLocaleString("pt-BR") : "—"}
          />
          <MetricCell
            label="% Renovação"
            value={project.metrics.latest_perc_renovacao !== null ? formatPercent(project.metrics.latest_perc_renovacao) : "—"}
          />
          <MetricCell
            label="% Conv. Pitch"
            value={project.metrics.latest_perc_conv_pitch !== null ? formatPercent(project.metrics.latest_perc_conv_pitch) : "—"}
          />
        </div>
      ) : project.grupo === "fcc" && isFccMetrics(project.metrics) ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <MetricCell
            label="% Assessment"
            value={project.metrics.latest_perc_assessment !== null
              ? formatPercent(project.metrics.latest_perc_assessment)
              : "—"}
          />
          <MetricCell
            label="% MCC"
            value={project.metrics.latest_perc_mcc !== null
              ? formatPercent(project.metrics.latest_perc_mcc)
              : "—"}
          />
          <MetricCell
            label="% PC ao Vivo"
            value={project.metrics.latest_perc_pc_ao_vivo !== null
              ? formatPercent(project.metrics.latest_perc_pc_ao_vivo)
              : "—"}
          />
        </div>
      ) : project.grupo === "mcc" && isMccMetrics(project.metrics) ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <MetricCell
            label="% Ultimate"
            value={project.metrics.latest_perc_ultimate !== null
              ? formatPercent(project.metrics.latest_perc_ultimate)
              : "—"}
          />
          <MetricCell
            label="% PC ao Vivo"
            value={project.metrics.latest_perc_pc_ao_vivo !== null
              ? formatPercent(project.metrics.latest_perc_pc_ao_vivo)
              : "—"}
          />
        </div>
      ) : (
        <EmptyDataState group={project.grupo} />
      )}
    </div>
  );
}

function AdsComercialContent({
  project,
  onConfigureAdsComercial,
}: {
  project: ConviteProject;
  onConfigureAdsComercial?: () => void;
}) {
  const metrics = isAdsComercialMetrics(project.metrics) ? project.metrics : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {metrics ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <MetricCell label="Total de vendas" value={metrics.total_sales.toLocaleString("pt-BR")} />
          <MetricCell label="Valor total" value={formatCurrency(metrics.total_revenue)} />
          <MetricCell label="Leads Meta Ads" value={metrics.meta_leads.toLocaleString("pt-BR")} />
          <MetricCell label="Leads orgânicos" value={metrics.organic_leads.toLocaleString("pt-BR")} />
          <MetricCell label="Conversão" value={formatPercent(metrics.sales_conversion_rate)} />
          <MetricCell label="CAC" value={formatCurrency(metrics.cac)} />
        </div>
      ) : (
        <div
          style={{
            borderRadius: "var(--radius-sm)",
            border: "1px dashed var(--color-border)",
            background: "var(--color-bg)",
            padding: "16px 14px",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
            {project.ads_comercial_config
              ? "A configuração foi salva, mas ainda não há métricas para o período."
              : "Esse projeto precisa ser configurado antes de mostrar as métricas."}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Defina Hotmart, produtos, contas Meta Ads, termos e eventos orgânicos.
          </p>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onConfigureAdsComercial?.();
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
          Configurar
        </button>
      </div>
    </div>
  );
}

function EmptyDataState({ group }: { group: ConviteProject["grupo"] }) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-sm)",
        border: "1px dashed var(--color-border)",
        background: "var(--color-bg)",
        padding: "18px 14px",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
        Nenhum dado encontrado para esse projeto.
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        {group === "funil_destrave"
          ? "O nome salvo será usado para localizar os registros em dash_gestao_convite_funil_destrave."
          : "As métricas específicas deste grupo serão conectadas em uma próxima etapa."}
      </p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
      }}
    >
      <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
        {value}
      </p>
    </div>
  );
}
