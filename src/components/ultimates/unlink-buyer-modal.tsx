"use client";

import { useEffect, useState } from "react";
import type { UltimatesRosterRow } from "@/types/ultimates";

interface UnlinkBuyerModalProps {
  cycleId: string;
  // Linha de comprador da base renovada — pode ou não ter vindo de um vínculo
  // manual (o roster não distingue). O DELETE trata 404 quando não era vínculo.
  targetRow: UltimatesRosterRow;
  onUnlinked: () => void;
  onCancel: () => void;
}

// Modal de confirmação de "Desfazer vínculo" (PRD issue #114, seção 3.4,
// critério 6). O roster não distingue uma renovação por email de uma por
// vínculo manual, então oferecemos a ação em qualquer renovação e tratamos o
// 404 do DELETE (transação sem vínculo) com mensagem amigável — solução
// mínima documentada no brief (não há endpoint para listar vínculos do ciclo).
export function UnlinkBuyerModal({ cycleId, targetRow, onUnlinked, onCancel }: UnlinkBuyerModalProps) {
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
      const res = await fetch("/api/ultimates/links", {
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
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={panelStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
          Desfazer vínculo
        </h3>
        <p style={{ fontSize: 13, color: "var(--color-text)", margin: 0, lineHeight: 1.6 }}>
          Desfazer o vínculo manual da renovação de <strong>{targetRow.name ?? targetRow.email}</strong>{" "}
          ({targetRow.email})? A compra volta para <em>Novos Compradores</em> caso tenha vindo de um
          email fora da base.
        </p>

        {error && (
          <p data-testid="ultimates-unlink-error" style={feedbackStyle("var(--color-danger)")}>
            {error}
          </p>
        )}

        <div className="flex gap-3" style={{ justifyContent: "flex-end" }}>
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

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
  padding: 16,
};

const panelStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-lg)",
  padding: 24,
  width: "100%",
  maxWidth: 440,
  boxShadow: "var(--shadow-md)",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

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
