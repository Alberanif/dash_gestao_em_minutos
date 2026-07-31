"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDateFull } from "@/lib/ultimates/format";
import type { ExcludedBuyer } from "./types";

interface ExcludedBuyersModalProps {
  cycleId: string;
  // gestor gerencia; analista só lê (espelha o gate real dos endpoints).
  canWrite: boolean;
  // Disparado após cada restauração — o pai recarrega o dashboard e o contador
  // do botão.
  onChanged: () => void;
  onClose: () => void;
}

// Modal "Leads excluídos" (PRD docs/PRD_2026-07-30_ultimates_editar_roster.md,
// seção 3.5). Segue o padrão do ExcludedOffersModal.
//
// Esta tela é o que torna a exclusão REVERSÍVEL na prática: o lead excluído
// some do roster (é filtrado dentro das RPCs), então não sobra linha nenhuma
// para clicar em "restaurar". Sem este modal, "reversível" seria uma promessa
// que a UI não cumpre.
//
// Não há como ADICIONAR um lead aqui, só remover: a exclusão nasce na linha do
// roster, onde o gestor vê quem é a pessoa, se renovou e quanto — é esse
// contexto que evita excluir a errada.
export function ExcludedBuyersModal({
  cycleId,
  canWrite,
  onChanged,
  onClose,
}: ExcludedBuyersModalProps) {
  const [buyers, setBuyers] = useState<ExcludedBuyer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/ultimates/cycles/${cycleId}/excluded-buyers`);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      setBuyers(Array.isArray(data?.buyers) ? data.buyers : []);
    } catch {
      setLoadError(true);
    }
  }, [cycleId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleRestore(email: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/ultimates/cycles/${cycleId}/excluded-buyers`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Não foi possível restaurar o lead.");
        return;
      }
      await load();
      onChanged();
    } catch {
      setError("Não foi possível restaurar o lead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Leads excluídos da contabilidade"
      className="ult-modal-overlay"
      data-testid="ultimates-excluded-buyers-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 560 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          Leads excluídos da contabilidade
        </h3>

        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          Quem está aqui não entra na base, nos KPIs, no gráfico nem no roster deste ciclo — e as
          compras dele também não. Nada foi apagado: restaurar devolve o lead inteiro na leitura
          seguinte.
        </p>

        {loadError && (
          <p data-testid="ultimates-excluded-buyers-load-error" style={feedbackStyle("var(--color-danger)")}>
            Não foi possível carregar os leads excluídos.
          </p>
        )}

        {buyers === null && !loadError && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Carregando...</p>
        )}

        {buyers !== null && buyers.length === 0 && (
          <p
            data-testid="ultimates-excluded-buyers-empty"
            style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}
          >
            Nenhum lead excluído — toda a base conta para este ciclo.
          </p>
        )}

        {buyers !== null && buyers.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {buyers.map((buyer) => (
              <li
                key={buyer.id}
                data-testid={`ultimates-excluded-buyer-${buyer.email}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-vis)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
                    {buyer.name ?? buyer.email}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", overflowWrap: "anywhere" }}>
                    {buyer.email}
                  </p>
                  {buyer.note && (
                    <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0" }}>{buyer.note}</p>
                  )}
                  <p style={{ fontSize: 11, color: "var(--text-4)", margin: "4px 0 0" }}>
                    {buyer.excluded_by_email ?? "autor não identificado"} ·{" "}
                    {fmtDateFull(buyer.created_at)}
                  </p>
                </div>

                {canWrite && (
                  <button
                    type="button"
                    className="btn-secondary"
                    data-testid={`ultimates-restore-buyer-${buyer.email}`}
                    disabled={busy}
                    onClick={() => handleRestore(buyer.email)}
                    style={{ fontSize: 12, padding: "5px 10px", flexShrink: 0 }}
                  >
                    Restaurar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p data-testid="ultimates-excluded-buyers-error" style={feedbackStyle("var(--color-danger)")}>
            {error}
          </p>
        )}

        <div className="ult-modal-actions">
          <button type="button" onClick={onClose} className="btn-secondary">
            Fechar
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
