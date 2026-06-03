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
  positive: {
    color: "var(--green)",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.2)",
  },
  neutral: {
    color: "var(--amber)",
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.2)",
  },
  negative: {
    color: "var(--red)",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.2)",
  },
};

export function HeroKpiCard({
  label,
  value,
  subtitle,
  accent,
  badge,
  loading,
}: HeroKpiCardProps) {
  if (loading) {
    return (
      <div
        style={{
          height: "96px",
          background: "var(--surface-2)",
          borderRadius: "10px",
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
        borderRadius: "10px",
        padding: "20px 20px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: accent,
        }}
      />

      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-3)",
        }}
      >
        {label}
      </span>

      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "40px",
          fontWeight: 500,
          color: accent,
          lineHeight: 1,
          margin: "8px 0 4px",
        }}
      >
        {value}
      </div>

      <div style={{ fontSize: "12px", color: "var(--text-3)" }}>{subtitle}</div>

      {badge && (
        <div
          style={{
            display: "inline-block",
            marginTop: "6px",
            fontSize: "10px",
            borderRadius: "4px",
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
