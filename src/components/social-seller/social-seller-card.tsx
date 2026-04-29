import type { SocialSellerWeek } from "@/types/social-seller";

interface SocialSellerCardProps {
  week: SocialSellerWeek | null;
  weekNumber: number;
  loading: boolean;
  weeks: SocialSellerWeek[];
  selectedWeekId: string | undefined;
  onSelectWeek: (weekId: string) => void;
}

function formatNumber(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekEnd + "T00:00:00");

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `${formatter.format(start)} → ${formatter.format(end)}`;
}

export function SocialSellerCard({
  week,
  weekNumber,
  loading,
  weeks,
  selectedWeekId,
  onSelectWeek,
}: SocialSellerCardProps) {
  if (loading && !week) {
    return (
      <div
        className="animate-pulse rounded-[var(--radius-card)]"
        style={{
          height: 300,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      />
    );
  }

  if (!week) {
    return null;
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: 24,
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottom: "1px solid var(--color-border)",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--color-text)",
    marginBottom: 4,
  };

  const dateStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--color-text-muted)",
    marginBottom: 12,
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    outline: "none",
    boxSizing: "border-box",
  };

  const metricsContainerStyle: React.CSSProperties = {
    marginTop: 20,
  };

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
    <div style={cardStyle}>
      <div style={headerStyle}>
        <p style={titleStyle}>Social Seller {weekNumber}</p>
        <p style={dateStyle}>{formatDateRange(week.week_start, week.week_end)}</p>
        <select
          value={selectedWeekId || ""}
          onChange={(e) => onSelectWeek(e.target.value)}
          style={selectStyle}
          disabled={loading}
        >
          {weeks.map((w, idx) => (
            <option key={w.id} value={w.id}>
              Semana {idx + 1}
            </option>
          ))}
        </select>
      </div>

      <div style={metricsContainerStyle}>
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
      </div>
    </div>
  );
}
