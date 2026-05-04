"use client";

import Link from "next/link";

export function SettingsCards() {
  const cards = [
    {
      href: "/dashboard/settings",
      label: "Configurações",
      description: "Gerencie perfil, preferências e integrações",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
      accent: "var(--color-primary)",
      accentBg: "var(--color-primary-light)",
    },
    {
      href: "/dashboard/dados",
      label: "Dados",
      description: "Acesse e gerencie seus dados de campanha",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
      ),
      accent: "#059669",
      accentBg: "#ecfdf5",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        width: "100%",
        maxWidth: 480,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Selecione a opção
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        {cards.map(({ href, label, description, icon, accent, accentBg }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 20px",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              boxShadow: "var(--shadow-card)",
              textDecoration: "none",
              transition: "box-shadow 0.15s, border-color 0.15s, transform 0.1s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = "var(--shadow-md)";
              el.style.borderColor = accent;
              el.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = "var(--shadow-card)";
              el.style.borderColor = "var(--color-border)";
              el.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: accentBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: accent,
              }}
            >
              {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", marginBottom: 2 }}>
                {label}
              </p>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                {description}
              </p>
            </div>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-text-muted)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
