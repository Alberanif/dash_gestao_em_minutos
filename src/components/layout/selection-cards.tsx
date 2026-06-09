"use client";

import Link from "next/link";
import type { UserRole } from "@/types/auth";

const MODULES = [
  {
    href: "/dashboard",
    label: "Gestão à Vista",
    description: "Painéis de EQA, posicionamento, relacionamento e Meta Ads",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    accent: "#3d84f5",
    restrictedTo: ["analista", "comum"] as UserRole[],
  },
  {
    href: "/indicadores",
    label: "Indicadores",
    description: "KPIs de campanhas, Meta Ads, Google Ads e leads orgânicos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    accent: "#9070e8",
    restrictedTo: ["analista", "comum"] as UserRole[],
  },
  {
    href: "/base-de-dados",
    label: "Base de Dados",
    description: "Atenção, EQA, Convite e Entrega Nível A",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    accent: "#1ab96c",
    restrictedTo: [] as UserRole[],
  },
  {
    href: "/ajustes",
    label: "Ajustes",
    description: "Configurações e gerenciamento de dados",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
    accent: "#7b9ab6",
    restrictedTo: ["comum"] as UserRole[],
  },
];

interface SelectionCardsProps {
  role: UserRole;
  userEmail: string;
}

export function SelectionCards({ role, userEmail }: SelectionCardsProps) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#07101f",
        backgroundImage:
          "radial-gradient(ellipse at 50% 38%, rgba(61,132,245,0.07) 0%, transparent 60%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px 48px",
      }}
    >
      {/* Logout */}
      <form
        action="/api/auth/signout"
        method="post"
        style={{ position: "absolute", top: 24, right: 24 }}
      >
        <button
          type="submit"
          title="Sair"
          aria-label="Sair do sistema"
          style={{
            width: 34,
            height: 34,
            borderRadius: 7,
            border: "1px solid #1c2b40",
            background: "transparent",
            color: "#3c566f",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 120ms, color 120ms",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = "#0d1829";
            el.style.color = "#7b9ab6";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "transparent";
            el.style.color = "#3c566f";
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </form>

      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
          marginBottom: 36,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: "#3d84f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: 11,
            fontWeight: 500,
            color: "#fff",
            letterSpacing: "0.04em",
            marginBottom: 8,
          }}
        >
          IGT
        </div>

        <h1
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: "#ddeaf6",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Gestão em 4 Minutos
        </h1>

        <p
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: 9,
            fontWeight: 500,
            color: "#3c566f",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Painel Interno · IGT Coaching
        </p>

        <p style={{ fontSize: 13, color: "#3c566f", margin: "10px 0 0" }}>
          Olá,{" "}
          <span style={{ color: "#7b9ab6", fontWeight: 500 }}>{userEmail}</span>
        </p>
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2"
        style={{ gap: 10, width: "100%", maxWidth: 560 }}
      >
        {MODULES.map(({ href, label, description, icon, accent, restrictedTo }) => {
          const isDisabled = restrictedTo.includes(role);

          const accentBar = (
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
          );

          const cardInner = (
            <>
              {accentBar}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${accent}1a`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: accent,
                  }}
                >
                  {icon}
                </div>

                {isDisabled ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 7px",
                      background: "rgba(224,66,66,0.1)",
                      border: "1px solid rgba(224,66,66,0.22)",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 500,
                      color: "#e04242",
                      fontFamily: "var(--font-dm-mono), monospace",
                      letterSpacing: "0.04em",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    Restrito
                  </div>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3c566f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>

              <div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#ddeaf6",
                    margin: "0 0 4px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {label}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "#3c566f",
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  {description}
                </p>
              </div>
            </>
          );

          const baseStyle: React.CSSProperties = {
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "18px 20px 16px",
            borderRadius: 10,
            border: "1px solid #253852",
            background: "#0d1829",
            overflow: "hidden",
            opacity: isDisabled ? 0.45 : 1,
            cursor: isDisabled ? "not-allowed" : "pointer",
            textDecoration: "none",
            transition: "border-color 150ms, box-shadow 150ms",
          };

          if (isDisabled) {
            return (
              <div key={href} style={baseStyle}>
                {cardInner}
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              style={baseStyle}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = accent;
                el.style.boxShadow = `0 0 0 1px ${accent}33, 0 0 20px ${accent}14`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "#253852";
                el.style.boxShadow = "none";
              }}
            >
              {cardInner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
