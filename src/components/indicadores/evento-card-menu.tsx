"use client";

import { useEffect, useRef, useState } from "react";

interface EventoCardMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function EventoCardMenu({ onEdit, onDelete }: EventoCardMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        aria-label="Ações do evento"
        data-testid="evento-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
          borderRadius: 6,
          color: "var(--text-3)",
          fontSize: 17,
          lineHeight: 1,
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 120,
            background: "var(--surface)",
            border: "1px solid var(--border-vis)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <button
            data-testid="evento-menu-editar"
            onClick={() => { setOpen(false); onEdit(); }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-2)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            Editar
          </button>
          <button
            data-testid="evento-menu-excluir"
            onClick={() => { setOpen(false); onDelete(); }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--red)",
              background: "transparent",
              border: "none",
              borderTop: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}
