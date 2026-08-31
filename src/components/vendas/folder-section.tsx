"use client";

import { useState } from "react";
import type { CycleGroup } from "@/lib/vendas/group-cycles";
import type { CycleWithProducts } from "./types";
import type { VendasFolderRecord } from "@/types/vendas";

interface FolderSectionProps {
  group: CycleGroup;
  selectedCycleId: string | null;
  isGestor: boolean;
  onSelectCycle: (cycleId: string) => void;
  onEditCycle?: (cycle: CycleWithProducts) => void;
  onToggleExpand: (groupId: string) => void;
  onRenameFolder?: (folder: VendasFolderRecord) => void;
  onDeleteFolder?: (folder: VendasFolderRecord) => void;
}

export function FolderSection({
  group,
  selectedCycleId,
  isGestor,
  onSelectCycle,
  onEditCycle,
  onToggleExpand,
  onRenameFolder,
  onDeleteFolder,
}: FolderSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const cycleCount = group.cycles.length;

  return (
    <div
      data-testid={`folder-section-${group.id}`}
      style={{
        marginBottom: 16,
        borderRadius: "var(--radius-md, 8px)",
        border: "1px solid var(--border-vis, rgba(255,255,255,0.08))",
        background: "var(--surface, rgba(255,255,255,0.02))",
        overflow: "hidden",
      }}
    >
      {/* Header da Pasta */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--surface-2, rgba(255,255,255,0.04))",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => onToggleExpand(group.id)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Ícone de pasta */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: group.isUnfolder ? "var(--text-muted, #71717a)" : "#a8c4ff" }}
          >
            {group.isUnfolder ? (
              <>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </>
            ) : (
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            )}
          </svg>

          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-strong, #ffffff)",
            }}
          >
            {group.name}
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "1px 7px",
              borderRadius: 10,
              background: "var(--surface, rgba(255,255,255,0.06))",
              color: "var(--text-muted, #a1a1aa)",
            }}
          >
            {cycleCount} {cycleCount === 1 ? "ciclo" : "ciclos"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {/* Menu de ações da pasta (...) para Gestor */}
          {isGestor && !group.isUnfolder && group.folder && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                data-testid={`folder-menu-btn-${group.id}`}
                onClick={() => setMenuOpen((prev) => !prev)}
                title="Ações da pasta"
                aria-label="Ações da pasta"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  border: "none",
                  background: menuOpen ? "var(--surface-3, rgba(255,255,255,0.1))" : "transparent",
                  color: "var(--text-muted, #a1a1aa)",
                  cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  data-testid={`folder-dropdown-${group.id}`}
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 4,
                    zIndex: 20,
                    width: 140,
                    borderRadius: 6,
                    border: "1px solid var(--border-strong, rgba(255,255,255,0.12))",
                    background: "var(--surface-2, #18181b)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                    padding: 4,
                  }}
                >
                  <button
                    type="button"
                    data-testid={`folder-rename-btn-${group.id}`}
                    onClick={() => {
                      setMenuOpen(false);
                      if (group.folder) onRenameFolder?.(group.folder);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      color: "var(--text-strong, #fff)",
                      background: "transparent",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    Renomear
                  </button>

                  <button
                    type="button"
                    data-testid={`folder-delete-btn-${group.id}`}
                    onClick={() => {
                      setMenuOpen(false);
                      if (group.folder) onDeleteFolder?.(group.folder);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 10px",
                      fontSize: 12,
                      color: "#ef4444",
                      background: "transparent",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    Deletar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chevron expandir/recolher */}
          <button
            type="button"
            data-testid={`folder-toggle-btn-${group.id}`}
            onClick={() => onToggleExpand(group.id)}
            title={group.isExpanded ? "Recolher pasta" : "Expandir pasta"}
            aria-label={group.isExpanded ? "Recolher pasta" : "Expandir pasta"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: "var(--text-muted, #a1a1aa)",
              cursor: "pointer",
              transform: group.isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 150ms ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conteúdo expandido: Pills dos ciclos */}
      {group.isExpanded && (
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {cycleCount === 0 ? (
            <span style={{ fontSize: 12, color: "var(--text-muted, #71717a)", fontStyle: "italic" }}>
              Nenhum ciclo nesta pasta
            </span>
          ) : (
            group.cycles.map((cycle) => {
              const selected = cycle.id === selectedCycleId;
              return (
                <div key={cycle.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectCycle(cycle.id)}
                    data-testid={`ultimates-cycle-option-${cycle.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      borderRadius: 20,
                      border: selected ? "1px solid rgba(76, 141, 255, 0.55)" : "1px solid var(--border-vis)",
                      background: selected ? "rgba(76, 141, 255, 0.14)" : "var(--surface)",
                      color: selected ? "#a8c4ff" : "var(--text-muted)",
                      cursor: "pointer",
                      transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
                    }}
                  >
                    {cycle.name}
                    {cycle.status === "encerrado" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 10,
                          background: "var(--surface-2)",
                          color: "var(--text-3)",
                        }}
                      >
                        Encerrado
                      </span>
                    )}
                  </button>

                  {isGestor && selected && onEditCycle && (
                    <button
                      type="button"
                      onClick={() => onEditCycle(cycle)}
                      data-testid="ultimates-edit-cycle-btn"
                      title="Editar ciclo"
                      aria-label="Editar ciclo"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "1px solid var(--border-vis)",
                        background: "var(--surface)",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
