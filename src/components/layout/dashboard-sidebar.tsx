"use client";

import { useEffect, useRef, useState } from "react";
import { NavLinks } from "@/components/layout/nav-links";
import type { UserRole } from "@/types/auth";

interface DashboardSidebarProps {
  userEmail: string;
  role: UserRole;
}

export function DashboardSidebar({ userEmail }: DashboardSidebarProps) {
  const [open, setOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const initial = (userEmail[0] ?? "?").toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">IGT</div>
        <span>Gestão à Vista</span>
      </div>
      <nav className="sb-nav">
        <NavLinks />
      </nav>
      <div className="sb-footer" ref={footerRef}>
        {open && (
          <div className="profile-popup">
            <a href="/" className="profile-popup-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Trocar módulo
            </a>
            <div className="profile-popup-divider" />
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="profile-popup-item danger">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sair
              </button>
            </form>
          </div>
        )}
        <button
          className="sb-profile-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu do perfil"
          aria-expanded={open}
        >
          <span className="sb-avatar">{initial}</span>
          <span className="who">{userEmail}</span>
        </button>
      </div>
    </aside>
  );
}
