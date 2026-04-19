"use client";

import { useState, useRef, useEffect } from "react";
import type { IndicadoresProject } from "@/types/indicadores";

interface ProjectCardProps {
  project: IndicadoresProject;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onClick, onEdit, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "20px 16px",
        cursor: "pointer",
        transition: "box-shadow 0.15s",
        position: "relative",
        minHeight: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)")
      }
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {project.name}
        </p>

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
              padding: "2px 6px",
              borderRadius: 6,
              color: "var(--color-text-muted)",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ⋯
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
                minWidth: 120,
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
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 14px",
                    fontSize: 13,
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
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {project.campaign_terms.length > 0 && (
        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            marginTop: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {project.campaign_terms.join(", ")}
        </p>
      )}
    </div>
  );
}
