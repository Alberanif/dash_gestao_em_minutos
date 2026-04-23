"use client";

import Link from "next/link";

const OPTIONS = [
  { href: "/base-de-dados/atencao",         label: "Atenção" },
  { href: "/base-de-dados/eqa",             label: "EQA" },
  { href: "/base-de-dados/convite",         label: "Convite" },
  { href: "/base-de-dados/entrega-nivel-a", label: "Entrega Nível A" },
];

const ACCENT = "#059669";

export default function BaseDeDadosPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: 28,
        }}
      >
        Base de Dados
      </h1>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "100%",
          maxWidth: 400,
        }}
      >
        {OPTIONS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "18px 24px",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              boxShadow: "var(--shadow-card)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text)",
              textDecoration: "none",
              transition: "box-shadow 0.15s, border-color 0.15s, transform 0.1s",
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
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
