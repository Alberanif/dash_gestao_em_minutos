"use client";

import { useEffect, useState } from "react";
import type { UltimatesRosterRow } from "@/types/vendas";

interface UnlinkBuyerModalProps {
  cycleId: string;
  // Linha de comprador da base renovada — pode ou não ter vindo de um vínculo
  // manual (o roster não distingue). O DELETE trata 404 quando não era vínculo.
  targetRow: UltimatesRosterRow;
  // Decide como nomear o destino da compra desvinculada — com o ciclo sem
  // novas compras, ela volta para "Renovação sem vínculo", não para "Novos
  // Compradores".
  countsNewBuyers: boolean;
  onUnlinked: () => void;
  onCancel: () => void;
}

// Modal de confirmação de "Desfazer vínculo" (PRD issue #114, seção 3.4,
// critério 6). O roster não distingue uma renovação por email de uma por
// vínculo manual, então oferecemos a ação em qualquer renovação e tratamos o
// 404 do DELETE (transação sem vínculo) com mensagem amigável — solução
// mínima documentada no brief (não há endpoint para listar vínculos do ciclo).
export function UnlinkBuyerModal({ cycleId, targetRow, countsNewBuyers, onUnlinked, onCancel }: UnlinkBuyerModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const transactionCode = targetRow.transaction_code;

  async function handleConfirm() {
    if (!transactionCode) {
      setError("Esta linha não tem uma transação associada.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/vendas/links", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cycleId, transactionCode }),
      });
      if (res.status === 404) {
        setError(
          "Esta renovação não veio de um vínculo manual (foi identificada pelo email cadastrado na base). Nada a desfazer."
        );
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Não foi possível desfazer o vínculo.");
        return;
      }
      onUnlinked();
    } catch {
      setError("Falha de rede ao desfazer o vínculo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Desfazer vínculo"
      className="ult-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 440 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          Desfazer vínculo
        </h3>
        <p style={{ fontSize: 13, color: "var(--color-text)", margin: 0, lineHeight: 1.6 }}>
          Desfazer o vínculo manual da renovação de <strong>{targetRow.name ?? targetRow.email}</strong>{" "}
          ({targetRow.email})? A compra volta para{" "}
          <em>{countsNewBuyers ? "Novos Compradores" : "Renovação sem vínculo"}</em> caso tenha
          vindo de um email fora da base.
        </p>

        {error && (
          <p data-testid="ultimates-unlink-error" style={feedbackStyle("var(--color-danger)")}>
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
            data-testid="ultimates-unlink-confirm-btn"
          >
            {busy ? "Desfazendo..." : "Desfazer vínculo"}
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
