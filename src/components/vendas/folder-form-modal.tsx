"use client";

import { useState } from "react";
import type { VendasFolderRecord } from "@/types/vendas";

interface FolderFormModalProps {
  folderTarget?: VendasFolderRecord | null;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}

export function FolderFormModal({
  folderTarget,
  onSave,
  onCancel,
}: FolderFormModalProps) {
  const [name, setName] = useState(folderTarget?.name ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(folderTarget);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg("Nome da pasta é obrigatório");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onSave(trimmed);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Erro ao salvar pasta");
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="folder-form-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div
        data-testid="folder-form-modal"
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: "var(--radius-lg, 12px)",
          border: "1px solid var(--border-vis, rgba(255,255,255,0.12))",
          background: "var(--surface-2, #18181b)",
          padding: 24,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-strong, #fff)",
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          {isEdit ? "Renomear pasta" : "Nova pasta"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="folder-name-input"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-muted, #a1a1aa)",
                marginBottom: 6,
              }}
            >
              Nome da pasta
            </label>
            <input
              id="folder-name-input"
              data-testid="folder-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lançamentos 2026"
              autoFocus
              disabled={submitting}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 13,
                borderRadius: "var(--radius-sm, 6px)",
                border: "1px solid var(--border-vis, rgba(255,255,255,0.15))",
                background: "var(--surface, #09090b)",
                color: "#fff",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {errorMsg && (
            <div
              data-testid="folder-form-error"
              style={{
                fontSize: 12,
                color: "#ef4444",
                marginBottom: 16,
                padding: "6px 10px",
                borderRadius: 4,
                background: "rgba(239, 68, 68, 0.1)",
              }}
            >
              {errorMsg}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: "var(--radius-sm, 6px)",
                border: "1px solid var(--border-vis, rgba(255,255,255,0.15))",
                background: "transparent",
                color: "var(--text-muted, #a1a1aa)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              data-testid="folder-form-submit"
              disabled={submitting}
              className="btn-primary"
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm, 6px)",
                cursor: "pointer",
              }}
            >
              {submitting ? "Salvando..." : isEdit ? "Salvar" : "Criar pasta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
