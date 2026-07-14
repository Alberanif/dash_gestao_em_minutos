"use client";

interface HeroKpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  dotColor: string;
  loading?: boolean;
}

export function HeroKpiCard({ label, value, subtitle, dotColor, loading }: HeroKpiCardProps) {
  if (loading) {
    return (
      <div
        style={{
          height: 118,
          background: "var(--surface-2)",
          borderRadius: 11,
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
        borderRadius: 11,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--text-label)",
          marginBottom: 12,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        {label}
      </div>

      <div
        style={{
          fontSize: 36,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "var(--text-strong)",
        }}
      >
        {value}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 9 }}>{subtitle}</div>
    </div>
  );
}
