"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { NavLinks } from "@/components/layout/nav-links";
import type { UserRole } from "@/types/auth";

interface DashboardSidebarProps {
  userEmail: string;
  role: UserRole;
}

export function DashboardSidebar({ userEmail, role }: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar-collapsed") === "true";
  });

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <aside
      className="relative flex min-h-screen flex-shrink-0 flex-col"
      style={{
        width: collapsed ? 60 : 220,
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        transition: "width 200ms ease",
      }}
    >
      <div
        className={`flex h-14 items-center ${collapsed ? "justify-center px-2" : "gap-3 px-4"}`}
        style={{ background: "var(--color-primary)" }}
      >
        <Image src="/igt-logo.png" alt="IGT" width={28} height={28} priority />
        {!collapsed ? (
          <span className="text-sm font-semibold tracking-[0.08em] text-white">IGT</span>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-0 py-4">
        <NavLinks collapsed={collapsed} role={role} />
      </nav>

      <div
        className={`${collapsed ? "px-0 py-4" : "px-4 py-4"}`}
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        {!collapsed ? (
          <div className="flex flex-col gap-1">
            <Link
              href="/"
              className="dashboard-module-link flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors"
              style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Trocar módulo
            </Link>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}
                >
                  {userEmail}
                </p>
              </div>
              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-50"
                  style={{ color: "var(--color-text-muted)" }}
                  aria-label="Sair"
                  title="Sair"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div className="group relative flex justify-center">
              <Link
                href="/"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-50"
                style={{ color: "var(--color-text-muted)" }}
                aria-label="Trocar módulo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <span
                className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-md group-hover:block"
                style={{ background: "var(--color-text)" }}
              >
                Trocar módulo
              </span>
            </div>
            <form action="/api/auth/signout" method="post" className="group relative flex justify-center">
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-50"
                style={{ color: "var(--color-text-muted)" }}
                aria-label="Sair"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
              <span
                className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-md group-hover:block"
                style={{ background: "var(--color-text)" }}
              >
                Sair
              </span>
            </form>
          </div>
        )}
      </div>
      <style>{`
        .dashboard-module-link:hover {
          background: #f8fafc;
          color: var(--color-text) !important;
        }
      `}</style>

      <button
        type="button"
        onClick={toggleCollapsed}
        className="absolute top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full"
        style={{
          right: -12,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
          color: "var(--color-text-muted)",
        }}
        aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        <span className="text-sm leading-none">{collapsed ? "»" : "«"}</span>
      </button>
    </aside>
  );
}
