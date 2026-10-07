"use client";

import { useState } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  // Executa a ação destrutiva. Rejeitar com Error mostra a mensagem no
  // diálogo e o mantém aberto para nova tentativa.
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

// Diálogo próprio de confirmação destrutiva (PRD #185 RF-4). Substitui
// `confirm()`/`alert()` nativos, que não seguem o tema e não deixam mostrar o
// erro da API no próprio lugar.
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a exclusão.");
      setBusy(false);
    }
  }

  return (
    <div
      data-testid="confirm-dialog-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        data-testid="confirm-dialog"
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: "var(--radius-lg, 12px)",
          border: "1px solid var(--border-vis)",
          background: "var(--surface-2, #18181b)",
          padding: 24,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <h2 id="confirm-dialog-title" style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: "0 0 10px" }}>
          {title}
        </h2>
        <p id="confirm-dialog-message" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", margin: 0 }}>
          {message}
        </p>

        {error && (
          <div
            role="alert"
            data-testid="confirm-dialog-error"
            style={{ fontSize: 12, color: "#ef4444", marginTop: 14, padding: "6px 10px", borderRadius: 4, background: "rgba(239, 68, 68, 0.1)" }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy} data-testid="confirm-dialog-cancel">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            data-testid="confirm-dialog-confirm"
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--radius-sm, 6px)",
              border: "1px solid rgba(239, 68, 68, 0.6)",
              background: "rgba(239, 68, 68, 0.9)",
              color: "#fff",
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Excluindo..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
