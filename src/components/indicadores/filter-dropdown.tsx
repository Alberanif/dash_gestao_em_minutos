"use client";

import { useState, useRef, useEffect } from "react";
import type { FilterRecord } from "@/types/indicadores";

interface FilterDropdownProps {
  filters: FilterRecord[];
  activeFilter: FilterRecord | null;
  onSelect: (filter: FilterRecord | null) => void;
  onNew: () => void;
  onEdit: (filter: FilterRecord) => void;
  onDelete: (filter: FilterRecord) => void;
}

export function FilterDropdown({
  filters,
  activeFilter,
  onSelect,
  onNew,
  onEdit,
  onDelete,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 8,
          border: activeFilter
            ? "1.5px solid var(--violet)"
            : "1.5px solid var(--border-vis)",
          background: activeFilter ? "rgba(144,112,232,0.12)" : "var(--surface)",
          color: activeFilter ? "var(--violet)" : "var(--text-2)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {activeFilter ? activeFilter.name : "Filtros"}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            background: "var(--surface)",
            border: "1px solid var(--border-vis)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {/* Sem filtro */}
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: activeFilter === null ? "var(--violet)" : "var(--text-2)",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            Sem filtro
          </button>

          {/* Filter list */}
          {filters.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-3)" }}>
              Nenhum filtro salvo
            </div>
          )}
          {filters.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px",
                borderBottom: "1px solid var(--border)",
                background: activeFilter?.id === f.id ? "rgba(144,112,232,0.08)" : "transparent",
              }}
            >
              <button
                onClick={() => { onSelect(f); setOpen(false); }}
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: activeFilter?.id === f.id ? 700 : 500,
                  color: activeFilter?.id === f.id ? "var(--violet)" : "var(--text)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {f.name}
              </button>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(f); setOpen(false); }}
                  title="Editar"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(f); setOpen(false); }}
                  title="Deletar"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          {/* New filter */}
          <button
            onClick={() => { onNew(); setOpen(false); }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--violet)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            + Novo filtro
          </button>
        </div>
      )}
    </div>
  );
}
