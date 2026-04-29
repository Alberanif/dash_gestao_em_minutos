import type { SocialSellerWeek } from "@/types/social-seller";

interface SocialSellerCardProps {
  week: SocialSellerWeek | null;
  loading: boolean;
}

function formatNumber(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(n);
}

export function SocialSellerCard({ week, loading }: SocialSellerCardProps) {
  if (loading) {
    return (
      <div
        className="animate-pulse rounded-[var(--radius-card)]"
        style={{
          height: 160,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      />
    );
  }

  if (!week) {
    return null;
  }

  const metricStyle: React.CSSProperties = {
    background: "var(--color-bg)",
    borderRadius: "var(--radius-sm)",
    padding: "12px 14px",
    textAlign: "center",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "var(--color-text-muted)",
    marginBottom: 4,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--color-text)",
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      <div style={metricStyle}>
        <p style={labelStyle}>Seguidores Conectados</p>
        <p style={valueStyle}>{formatNumber(week.seguidores_conectados)}</p>
      </div>
      <div style={metricStyle}>
        <p style={labelStyle}>Total CTAs</p>
        <p style={valueStyle}>{formatNumber(week.total_ctas)}</p>
      </div>
      <div style={metricStyle}>
        <p style={labelStyle}>Total Agendamentos</p>
        <p style={valueStyle}>{formatNumber(week.total_agendamentos)}</p>
      </div>
    </div>
  );
}
