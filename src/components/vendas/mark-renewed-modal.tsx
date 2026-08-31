"use client";

import { useEffect, useMemo, useState } from "react";
import type { UltimatesRosterRow } from "@/types/vendas";
import { fmtBRL, fmtDateFull } from "@/lib/vendas/format";

interface MarkRenewedModalProps {
  cycleId: string;
  // Linha da base classificada como "nao_renovado".
  targetRow: UltimatesRosterRow;
  // Compras não atribuídas do ciclo — as linhas do roster com buyer_id null,
  // que o dashboard já tem em memória. Nenhuma chamada nova é necessária.
  unattributedRows: UltimatesRosterRow[];
  // Só decide a nomenclatura do texto: com o ciclo sem novas compras, estas
  // linhas se chamam "renovação sem vínculo".
  countsNewBuyers: boolean;
  onLinked: () => void;
  onCancel: () => void;
}

// Modal "Marcar renovado" (PRD docs/PRD_2026-07-30_ultimates_editar_roster.md,
// seção 3.3) — o VÍNCULO INVERTIDO.
//
// É o LinkBuyerModal com os dois lados trocados: lá se parte da compra e se
// escolhe a pessoa; aqui se parte da pessoa e se escolhe a compra. Mesma rota
// (POST /api/vendas/links), mesma tabela, nenhum conceito novo — e é por
// isso que "renovado" continua tendo data, valor e transação REAIS, em vez de
// virar um rótulo escrito à mão que faria a tabela divergir do card Evolução.
//
// Não existe override livre aqui de propósito (decisão 6 do PRD): sem compra
// correspondente, não há renovação a marcar.
export function MarkRenewedModal({
  cycleId,
  targetRow,
  unattributedRows,
  countsNewBuyers,
  onLinked,
  onCancel,
}: MarkRenewedModalProps) {
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
    return unattributedRows
      // Sem transaction_code não há o que vincular (linha só de estorno, por
      // exemplo) — oferecê-la levaria a um POST que a rota recusaria.
      .filter((r) => r.buyer_id === null && r.transaction_code !== null)
      .filter((r) => (q === "" ? true : r.email.toLowerCase().includes(q)));
  }, [unattributedRows, search]);

  const rotuloOrigem = countsNewBuyers ? "Novos Compradores" : "Renovação sem vínculo";

  async function handleConfirm() {
    if (!selected?.transaction_code || !targetRow.buyer_id) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/vendas/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cycleId,
          buyerId: targetRow.buyer_id,
          transactionCode: selected.transaction_code,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Não foi possível marcar como renovado.");
        return;
      }
      onLinked();
    } catch {
      setError("Falha de rede ao marcar como renovado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Marcar como renovado"
      className="ult-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 460 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          Marcar como renovado
        </h3>

        <p
          data-testid="ultimates-mark-renewed-intro"
          style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}
        >
          <strong>{targetRow.name ?? targetRow.email}</strong> consta como não renovado. Escolha
          abaixo, entre as compras de <em>{rotuloOrigem}</em>, qual é a renovação dele.
        </p>

        {!selected && candidates.length === 0 && (
          <p data-testid="ultimates-mark-renewed-empty" style={feedbackStyle("var(--color-text-muted)")}>
            Nenhuma compra sem atribuição neste ciclo. Só é possível marcar como renovado apontando
            uma compra real — não há como declarar uma renovação que a Hotmart não registrou.
          </p>
        )}

        {!selected && candidates.length > 0 && (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por email da compra..."
              className="field-control"
              data-testid="ultimates-mark-renewed-search"
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
              {candidates.slice(0, 100).map((c) => (
                <li key={c.transaction_code}>
                  <button
                    type="button"
                    className="btn-secondary"
                    data-testid={`ultimates-mark-renewed-select-${c.transaction_code}`}
                    onClick={() => setSelected(c)}
                    style={{ width: "100%", textAlign: "left", fontSize: 13 }}
                  >
                    <strong>{c.email}</strong>
                    <span style={{ color: "var(--color-text-muted)", marginLeft: 8 }}>
                      {c.total_value === null ? "—" : fmtBRL(c.total_value)} ·{" "}
                      {fmtDateFull(c.renewed_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {selected && (
          <p
            data-testid="ultimates-mark-renewed-confirm-text"
            style={{ fontSize: 14, color: "var(--color-text)", margin: 0, lineHeight: 1.6 }}
          >
            Confirmar: a compra de <strong>{selected.email}</strong> (
            {selected.total_value === null ? "—" : fmtBRL(selected.total_value)} em{" "}
            {fmtDateFull(selected.renewed_at)}) é a renovação de{" "}
            <strong>{targetRow.name ?? targetRow.email}</strong> ({targetRow.email})?
          </p>
        )}

        {error && (
          <p data-testid="ultimates-mark-renewed-error" style={feedbackStyle("var(--color-danger)")}>
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
                data-testid="ultimates-mark-renewed-confirm-btn"
              >
                {busy ? "Marcando..." : "Confirmar renovação"}
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
