"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface IndicadoresSidebarProps {
  userEmail: string;
}

export function IndicadoresSidebar({ userEmail }: IndicadoresSidebarProps) {
  const pathname = usePathname();
  const isProjects = pathname === "/indicadores" || pathname.startsWith("/indicadores/");

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
          background: "var(--color-primary)",
          flexShrink: 0,
        }}
      >
        <Image src="/igt-logo.png" alt="IGT" width={26} height={26} priority />
        <span style={{ fontSize: 13, fontWeight: 700, color: "white", letterSpacing: "0.06em" }}>
          IGT
        </span>
      </div>

      <div style={{ padding: "16px 12px 8px", flexShrink: 0 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-text-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "0 8px",
            marginBottom: 6,
          }}
        >
          Indicadores
        </p>
        <Link
          href="/indicadores"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
            color: isProjects ? "var(--color-primary)" : "var(--color-text-muted)",
            background: isProjects ? "var(--color-primary-light)" : "transparent",
            borderLeft: isProjects ? "3px solid var(--color-primary)" : "3px solid transparent",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="6" height="18" rx="1" />
            <rect x="10" y="8" width="6" height="13" rx="1" />
            <rect x="18" y="5" width="4" height="16" rx="1" />
          </svg>
          Projetos
        </Link>
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: "12px",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Link
          href="/"
          className="indicadores-back-link"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-text-muted)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Trocar módulo
        </Link>
        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            padding: "4px 10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {userEmail}
        </p>
      </div>

      <style>{`
        .indicadores-back-link:hover {
          background: #f8fafc;
          color: var(--color-text) !important;
        }
      `}</style>
    </aside>
  );
}
