"use client";

import { useEffect, useState } from "react";
import type { UltimatesRosterRow } from "@/types/ultimates";

interface EditBuyerModalProps {
  cycleId: string;
  // Linha da BASE (buyer_id != null) — só ela tem registro a corrigir.
  targetRow: UltimatesRosterRow;
  onSaved: () => void;
  onCancel: () => void;
}

// Modal "Editar lead" (PRD docs/PRD_2026-07-30_ultimates_editar_roster.md,
// seção 3.4).
//
// Só nome e telefone. O EMAIL é exibido e não editável de propósito: é a chave
// do cruzamento com as vendas, e trocá-lo reclassificaria a pessoa sem deixar
// rastro do motivo — o caminho explícito para isso é "Marcar renovado"
// (vínculo manual). Não transforme o texto do email num input.
export function EditBuyerModal({ cycleId, targetRow, onSaved, onCancel }: EditBuyerModalProps) {
  const [name, setName] = useState(targetRow.name ?? "");
  const [phone, setPhone] = useState(targetRow.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  async function handleConfirm() {
    if (!targetRow.buyer_id) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/ultimates/cycles/${cycleId}/buyers/${targetRow.buyer_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Não foi possível salvar a correção.");
        return;
      }
      onSaved();
    } catch {
      setError("Falha de rede ao salvar a correção.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar lead"
      className="ult-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 420 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          Editar lead
        </h3>

        <div>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-4)", margin: 0 }}>
            Email
          </p>
          <p style={{ fontSize: 13, color: "var(--color-text)", margin: "2px 0 0", overflowWrap: "anywhere" }}>
            {targetRow.email}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0", lineHeight: 1.5 }}>
            O email não é editável: é ele que liga esta pessoa às compras na Hotmart. Se a renovação
            veio de outro email, use &quot;Marcar renovado&quot;.
          </p>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-control"
            data-testid="ultimates-edit-name"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Telefone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field-control"
            data-testid="ultimates-edit-phone"
          />
        </label>

        <p data-testid="ultimates-edit-upload-warning" style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.5 }}>
          Esta correção vale até o próximo upload da base — a planilha continua sendo a fonte da
          verdade e sobrescreve nome e telefone.
        </p>

        {error && (
          <p data-testid="ultimates-edit-error" style={feedbackStyle("var(--color-danger)")}>
            {error}
          </p>
        )}

        <div className="ult-modal-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="btn-primary"
            data-testid="ultimates-edit-confirm-btn"
          >
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function feedbackStyle(color: string): React.CSSProperties {
  return {
    fontSize: 12,
    color,
    margin: 0,
    padding: "8px 10px",
    borderRadius: "var(--radius-sm)",
    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    lineHeight: 1.5,
  };
}
