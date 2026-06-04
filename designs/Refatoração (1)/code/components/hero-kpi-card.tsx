"use client";

interface BadgeProp {
  text: string;
  variant: "positive" | "neutral" | "negative";
}

interface HeroKpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  accent: string;
  badge?: BadgeProp;
  loading?: boolean;
}

const badgeStyles: Record<BadgeProp["variant"], React.CSSProperties> = {
  positive: { color: "var(--green)",  background: "rgba(26,185,108,0.10)", border: "1px solid rgba(26,185,108,0.20)" },
  neutral:  { color: "var(--amber)",  background: "rgba(217,149,18,0.10)", border: "1px solid rgba(217,149,18,0.20)" },
  negative: { color: "var(--red)",    background: "rgba(224,66,66,0.10)",  border: "1px solid rgba(224,66,66,0.20)" },
};

export function HeroKpiCard({
  label, value, subtitle, accent, badge, loading,
}: HeroKpiCardProps) {
  if (loading) {
    return (
      <div
        style={{
          height: 106,
          background: "var(--surface-2)",
          borderRadius: 10,
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 10,
        padding: "22px 22px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 2px accent stripe at the top — replaces the left border */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: accent,
        }}
      />

      {/* Label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-3)",
          marginBottom: 14,
        }}
      >
        {label}
      </div>

      {/* Value */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 40,
          fontWeight: 500,
          color: accent,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        {value}
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{subtitle}</div>

      {/* Optional badge */}
      {badge && (
        <div
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 10,
            borderRadius: 4,
            padding: "2px 6px",
            ...badgeStyles[badge.variant],
          }}
        >
          {badge.text}
        </div>
      )}
    </div>
  );
}
