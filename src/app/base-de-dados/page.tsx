"use client";

import Link from "next/link";

const ACCENT = "#059669";
const ACCENT_BG = "#ecfdf5";

const OPTIONS = [
  {
    href: "/base-de-dados/atencao",
    label: "Atenção",
    description: "Registro semanal de oportunidades — início e fim da semana",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/base-de-dados/eqa",
    label: "EQA",
    description: "Seguidores conectados, total de CTAs e agendamentos semanais",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/base-de-dados/convite",
    label: "Convite",
    description: "Funil Destrave, Ultimate, FCC, MCC e Social Seller",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: "/base-de-dados/entrega-nivel-a",
    label: "Entrega Nível A",
    description: "MCC/FCC, Ultimate e Destrave — métricas por projeto e mês",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

export default function BaseDeDadosPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", margin: 0, lineHeight: 1.2 }}>
              Base de Dados
            </h1>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, marginTop: 1 }}>
              Selecione a seção para registrar dados
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {OPTIONS.map(({ href, label, description, icon }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                boxShadow: "var(--shadow-card)",
                textDecoration: "none",
                transition: "box-shadow 150ms ease, border-color 150ms ease, transform 100ms ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.boxShadow = "var(--shadow-md)";
                el.style.borderColor = ACCENT;
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
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: ACCENT_BG,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: ACCENT,
                }}
              >
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", margin: 0, marginBottom: 2 }}>
                  {label}
                </p>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.4 }}>
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

        <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
          <Link href="/" className="bdd-back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Trocar módulo
          </Link>
        </div>
      </div>
    </div>
  );
}
