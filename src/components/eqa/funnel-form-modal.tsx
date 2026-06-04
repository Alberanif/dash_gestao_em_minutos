"use client";

import { useEffect } from "react";
import type { Funnel } from "@/types/funnels";
import { FunnelFormContent } from "./funnel-form-content";

interface FunnelFormModalProps {
  funnel?: Funnel;
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Funnel, "id" | "created_at" | "updated_at">) => Promise<void>;
}

export function FunnelFormModal({ funnel, open, onClose, onSave }: FunnelFormModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 520,
          padding: 24,
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          type="button"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>

        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 20,
            paddingRight: 32,
          }}
        >
          {funnel ? "Editar Funil" : "Novo Funil"}
        </h2>

        <FunnelFormContent funnel={funnel} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}
