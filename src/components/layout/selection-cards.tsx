"use client";

import Link from "next/link";
import type { UserRole } from "@/types/auth";

const MODULES = [
  {
    href: "/dashboard",
    label: "Gestão à Vista",
    description: "Painéis de EQA, posicionamento, relacionamento e Meta Ads",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    accent: "var(--color-primary)",
    accentBg: "var(--color-primary-light)",
    restrictedTo: ["analista", "comum"] as UserRole[],
  },
  {
    href: "/indicadores",
    label: "Indicadores",
    description: "KPIs de campanhas, Meta Ads, Google Ads e leads orgânicos",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    accent: "#7c3aed",
    accentBg: "#f5f3ff",
    restrictedTo: ["analista", "comum"] as UserRole[],
  },
  {
    href: "/base-de-dados",
    label: "Base de Dados",
    description: "Atenção, EQA, Convite e Entrega Nível A",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    accent: "#059669",
    accentBg: "#ecfdf5",
    restrictedTo: [] as UserRole[],
  },
];

interface SelectionCardsProps {
  role: UserRole;
}

export function SelectionCards({ role }: SelectionCardsProps) {
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="8" height="8" rx="2" fill="white" fillOpacity="0.9" />
            <rect x="13" y="3" width="8" height="8" rx="2" fill="white" fillOpacity="0.6" />
            <rect x="3" y="13" width="8" height="8" rx="2" fill="white" fillOpacity="0.6" />
            <rect x="13" y="13" width="8" height="8" rx="2" fill="white" fillOpacity="0.9" />
          </svg>
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
          IGT
        </span>
      </div>

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
        Selecione o módulo
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        {MODULES.map(({ href, label, description, icon, accent, accentBg, restrictedTo }) => {
          const isDisabled = restrictedTo.includes(role);

          return isDisabled ? (
            <div
              key={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                opacity: 0.5,
                cursor: "not-allowed",
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                  padding: "4px 8px",
                  background: "var(--color-danger-light)",
                  color: "var(--color-danger)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Acesso restrito
              </div>
            </div>
          ) : (
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
          );
        })}
      </div>
    </div>
  );
}
