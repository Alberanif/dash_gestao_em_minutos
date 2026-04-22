"use client";

import { useState, useRef, useEffect } from "react";
import type { IndicadoresProject } from "@/types/indicadores";

interface ProjectCardProps {
  project: IndicadoresProject;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const ACCENTS = [
  { bg: "#ebf5fb", text: "#1e7ead", border: "#3b93c3" },
  { bg: "#f0fdf4", text: "#15803d", border: "#16a34a" },
  { bg: "#fdf4ff", text: "#7e22ce", border: "#9333ea" },
  { bg: "#fff7ed", text: "#c2410c", border: "#ea580c" },
  { bg: "#f0f9ff", text: "#0369a1", border: "#0284c7" },
];

function pickAccent(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

export function ProjectCard({ project, onClick, onEdit, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accent = pickAccent(project.name);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${accent.border}`,
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "16px",
        cursor: "pointer",
        transition: "box-shadow 0.15s, transform 0.1s",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--shadow-md)";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--shadow-card)";
        el.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: accent.bg,
            color: accent.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            letterSpacing: "0.02em",
          }}
        >
          {getInitials(project.name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {project.name}
          </p>
        </div>

        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              borderRadius: 6,
              color: "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="Opções"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--shadow-md)",
                zIndex: 20,
                minWidth: 130,
                overflow: "hidden",
              }}
            >
              {(["Editar", "Excluir"] as const).map((label) => (
                <button
                  key={label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    label === "Editar" ? onEdit() : onDelete();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: label === "Excluir" ? "var(--color-danger)" : "var(--color-text)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "var(--color-bg)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "none")
                  }
                >
                  {label === "Editar" ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                    </svg>
                  )}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {project.campaign_terms.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {project.campaign_terms.slice(0, 3).map((term) => (
            <span
              key={term}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: accent.text,
                background: accent.bg,
                padding: "2px 8px",
                borderRadius: 20,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {term}
            </span>
          ))}
          {project.campaign_terms.length > 3 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--color-text-muted)",
                background: "var(--color-bg)",
                padding: "2px 8px",
                borderRadius: 20,
                border: "1px solid var(--color-border)",
              }}
            >
              +{project.campaign_terms.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
