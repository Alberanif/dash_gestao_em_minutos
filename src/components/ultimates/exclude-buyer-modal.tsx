"use client";

import { useEffect, useState } from "react";
import type { UltimatesRosterRow } from "@/types/ultimates";
import { fmtBRL, fmtDateFull } from "@/lib/ultimates/format";

interface ExcludeBuyerModalProps {
  cycleId: string;
  // Linha da BASE (buyer_id != null) que sai da contabilidade do ciclo.
  targetRow: UltimatesRosterRow;
  onExcluded: () => void;
  onCancel: () => void;
}

// Modal "Excluir lead" (PRD docs/PRD_2026-07-30_ultimates_editar_roster.md,
// seção 3.2).
//
// Nada aqui apaga a linha da base nem venda alguma: o POST só acrescenta o
// email a uma lista que as RPCs consultam em leitura (migration 055). Por isso
// a operação é reversível pelo modal "Leads excluídos".
//
// O aviso da compra existe porque este é o efeito colateral mais fácil de
// aplicar sem perceber: excluir alguém que renovou tira a RECEITA dele das
// curvas e do total, não só a linha da tabela. Quem confirma precisa ver o
// valor antes.
export function ExcludeBuyerModal({ cycleId, targetRow, onExcluded, onCancel }: ExcludeBuyerModalProps) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  // "Tem compra" é ter transação aprovada — total_value/renewed_at só existem
  // quando alguma venda foi atribuída a esta pessoa.
  const temCompra = targetRow.transaction_code !== null;

  async function handleConfirm() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/ultimates/cycles/${cycleId}/excluded-buyers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: targetRow.email, note: note.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Não foi possível excluir o lead.");
        return;
      }
      onExcluded();
    } catch {
      setError("Falha de rede ao excluir o lead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Excluir lead do ciclo"
      className="ult-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 460 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          Excluir lead do ciclo
        </h3>

        <p style={{ fontSize: 13, color: "var(--color-text)", margin: 0, lineHeight: 1.6 }}>
          Excluir <strong>{targetRow.name ?? targetRow.email}</strong> ({targetRow.email}) da
          contabilidade deste ciclo? Ele sai do roster e do denominador da meta.
        </p>

        {temCompra && (
          <p data-testid="ultimates-exclude-sale-warning" style={feedbackStyle("var(--amber)")}>
            Esta pessoa tem uma renovação de{" "}
            <strong>{targetRow.total_value === null ? "valor não informado" : fmtBRL(targetRow.total_value)}</strong>{" "}
            em {fmtDateFull(targetRow.renewed_at)}. Excluí-la remove também essa compra da
            contabilidade do ciclo.
          </p>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Motivo (opcional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex.: email interno de teste"
            className="field-control"
            data-testid="ultimates-exclude-note"
          />
        </label>

        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.5 }}>
          Reversível a qualquer momento em &quot;Leads excluídos&quot;. A exclusão continua valendo
          mesmo que o email volte num próximo upload da base.
        </p>

        {error && (
          <p data-testid="ultimates-exclude-error" style={feedbackStyle("var(--color-danger)")}>
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
            data-testid="ultimates-exclude-confirm-btn"
          >
            {busy ? "Excluindo..." : "Excluir do ciclo"}
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
