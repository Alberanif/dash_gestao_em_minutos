"use client";

import Link from "next/link";
import { SettingsCards } from "@/components/layout/settings-cards";

export default function AjustesPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        width: "100%",
        maxWidth: 480,
        margin: "auto",
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

      <SettingsCards />

      <Link
        href="/"
        style={{
          marginTop: 12,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Voltar ao menu
      </Link>
    </div>
  );
}
