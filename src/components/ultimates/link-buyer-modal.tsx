"use client";

import { useEffect, useMemo, useState } from "react";
import type { UltimatesRosterRow } from "@/types/ultimates";

interface LinkBuyerModalProps {
  cycleId: string;
  // Linha de Novos Compradores (buyer_id null) cuja venda queremos atribuir a
  // um comprador da base.
  newBuyerRow: UltimatesRosterRow;
  // Todas as linhas do roster; filtramos as com buyer_id != null (base).
  baseRows: UltimatesRosterRow[];
  onLinked: () => void;
  onCancel: () => void;
}

// Modal de vínculo manual (PRD issue #114, seção 3.4, critério 6). A partir de
// uma compra de email fora da base, o gestor escolhe o comprador da base do
// qual essa compra é a renovação, confirma, e o POST /api/ultimates/links
// move a venda. Só é montado para gestor em ciclo não encerrado (pai gateia).
export function LinkBuyerModal({ cycleId, newBuyerRow, baseRows, onLinked, onCancel }: LinkBuyerModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UltimatesRosterRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseRows
      .filter((r) => r.buyer_id !== null)
      .filter((r) => {
        if (q === "") return true;
        return (
          (r.name ?? "").toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
        );
      });
  }, [baseRows, search]);

  const transactionCode = newBuyerRow.transaction_code;

  async function handleConfirm() {
    if (!selected || !selected.buyer_id || !transactionCode) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ultimates/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cycleId,
          buyerId: selected.buyer_id,
          transactionCode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Não foi possível criar o vínculo.");
        return;
      }
      onLinked();
    } catch {
      setError("Falha de rede ao criar o vínculo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vincular comprador à base"
      className="ult-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 460 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          Vincular à base
        </h3>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
          A compra de <strong>{newBuyerRow.email}</strong> veio de um email fora da base. Escolha o
          comprador da base do qual esta é a renovação.
        </p>

        {!transactionCode && (
          <p data-testid="ultimates-link-no-transaction" style={feedbackStyle("var(--color-danger)")}>
            Esta linha não tem uma transação associada — não é possível vincular.
          </p>
        )}

        {!selected && transactionCode && (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="field-control"
              data-testid="ultimates-link-search"
            />
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                maxHeight: 280,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {candidates.length === 0 && (
                <li style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  Nenhum comprador da base encontrado.
                </li>
              )}
              {candidates.slice(0, 100).map((c) => (
                <li key={c.buyer_id}>
                  <button
                    type="button"
                    className="btn-secondary"
                    data-testid={`ultimates-link-select-${c.buyer_id}`}
                    onClick={() => setSelected(c)}
                    style={{ width: "100%", textAlign: "left", fontSize: 13 }}
                  >
                    <strong>{c.name ?? "—"}</strong>
                    <span style={{ color: "var(--color-text-muted)", marginLeft: 8 }}>{c.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {selected && transactionCode && (
          <p data-testid="ultimates-link-confirm-text" style={{ fontSize: 14, color: "var(--color-text)", margin: 0, lineHeight: 1.6 }}>
            Confirmar: a compra de <strong>{newBuyerRow.email}</strong> é a renovação de{" "}
            <strong>{selected.name ?? selected.email}</strong> ({selected.email})?
          </p>
        )}

        {error && (
          <p data-testid="ultimates-link-error" style={feedbackStyle("var(--color-danger)")}>
            {error}
          </p>
        )}

        <div className="ult-modal-actions">
          {selected ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setError("");
                }}
                className="btn-secondary"
                disabled={busy}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className="btn-primary"
                data-testid="ultimates-link-confirm-btn"
              >
                {busy ? "Vinculando..." : "Confirmar vínculo"}
              </button>
            </>
          ) : (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
          )}
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
