"use client";

import { useSocialSellerWeeks } from "@/hooks/useSocialSellerWeeks";
import { SocialSellerCard } from "./social-seller-card";

export function SocialSellerSection() {
  const { weeks, selectedWeek, loading, error, selectWeek, retry } =
    useSocialSellerWeeks();

  const errorStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--color-error)",
    padding: 20,
    background: "var(--color-surface)",
    borderRadius: "var(--radius-card)",
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
    return <SocialSellerCard week={null} weekNumber={0} loading={true} weeks={[]} selectedWeekId="" onSelectWeek={() => {}} />;
  }

  // Error state
  if (error) {
    return (
      <div>
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
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
        }}
      >
        Nenhuma semana de dados disponível
      </p>
    );
  }

  // Normal state - find week number
  const weekNumber =
    weeks.findIndex((w) => w.id === selectedWeek?.id) + 1 || 1;

  return (
    <SocialSellerCard
      week={selectedWeek}
      weekNumber={weekNumber}
      loading={loading}
      weeks={weeks}
      selectedWeekId={selectedWeek?.id}
      onSelectWeek={selectWeek}
    />
  );
}
