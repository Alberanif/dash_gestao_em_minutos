"use client";

import { useSocialSellerWeeks } from "@/hooks/useSocialSellerWeeks";
import { SocialSellerCard } from "./social-seller-card";

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekEnd + "T00:00:00");

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  });

  const startLabel = formatter.format(start);
  const endLabel = formatter.format(end);

  return `Semana de ${startLabel} a ${endLabel}`;
}

export function SocialSellerSection() {
  const { weeks, selectedWeek, loading, error, selectWeek, retry } =
    useSocialSellerWeeks();

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

  const containerStyle: React.CSSProperties = {
    background: "var(--color-bg)",
    borderRadius: "var(--radius-sm)",
    padding: 16,
    marginBottom: 20,
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--color-error)",
    marginBottom: 12,
  };

  const buttonStyle: React.CSSProperties = {
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid var(--color-primary)",
    background: "var(--color-primary-light)",
    color: "var(--color-primary)",
    cursor: "pointer",
    borderRadius: "var(--radius-sm)",
  };

  // Loading state
  if (loading && weeks.length === 0) {
    return (
      <div style={containerStyle}>
        <div
          className="animate-pulse"
          style={{
            height: 40,
            background: "var(--color-border)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 12,
          }}
        />
        <SocialSellerCard week={null} loading={true} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={containerStyle}>
        <p style={errorStyle}>{error}</p>
        <button style={buttonStyle} onClick={retry}>
          Tentar novamente
        </button>
      </div>
    );
  }

  // Empty state
  if (weeks.length === 0) {
    return (
      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          textAlign: "center",
          padding: 20,
          background: "var(--color-bg)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        Nenhuma semana de dados disponível
      </p>
    );
  }

  // Normal state
  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 12 }}>
        <select
          value={selectedWeek?.id || ""}
          onChange={(e) => selectWeek(e.target.value)}
          style={selectStyle}
          disabled={loading}
        >
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {formatWeekLabel(week.week_start, week.week_end)}
            </option>
          ))}
        </select>
      </div>
      <SocialSellerCard week={selectedWeek} loading={loading} />
    </div>
  );
}
