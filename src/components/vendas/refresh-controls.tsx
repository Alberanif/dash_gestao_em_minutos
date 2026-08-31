"use client";

import { useEffect, useState } from "react";
import type { UltimatesCycleStatus } from "@/types/vendas";
import { interpretRefreshResponse, formatRefreshedAgo, type RefreshOutcome } from "@/lib/vendas/refresh";

interface RefreshControlsProps {
  cycleId: string;
  cycleStatus: UltimatesCycleStatus;
  lastRefreshAt: string | null;
  // Sucesso ⇒ o pai recarrega roster/daily (a fonte de KPIs/gráfico/tabela).
  onRefreshed: () => void;
}

// Botão "Atualizar agora" (PRD issue #114, seção 3.6, RF-7, critério 8).
// POST /api/vendas/cycles/[id]/refresh — a interpretação da resposta
// (throttle/lock/sucesso) fica em src/lib/ultimates/refresh.ts, testável
// sem DOM; este componente só orquestra fetch + estado de UI.
export function RefreshControls({ cycleId, cycleStatus, lastRefreshAt, onRefreshed }: RefreshControlsProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<RefreshOutcome | null>(null);
  const [localLastRefreshAt, setLocalLastRefreshAt] = useState(lastRefreshAt);

  // cycle prop pode trocar (seletor de ciclo) — resincroniza o rótulo local.
  useEffect(() => {
    setLocalLastRefreshAt(lastRefreshAt);
    setFeedback(null);
  }, [cycleId, lastRefreshAt]);

  const isClosed = cycleStatus === "encerrado";
  const label = formatRefreshedAgo(localLastRefreshAt);

  async function handleClick() {
    setRefreshing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/vendas/cycles/${cycleId}/refresh`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      const outcome = interpretRefreshResponse(res.status, body);
      setFeedback(outcome);
      if (outcome.kind === "success") {
        setLocalLastRefreshAt(outcome.lastRefreshAt);
        onRefreshed();
      }
    } catch {
      setFeedback({ kind: "error", message: "Erro de conexão ao atualizar." });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      data-testid="ultimates-refresh-controls"
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {label && (
          <span data-testid="ultimates-refresh-label" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {label}
          </span>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={refreshing || isClosed}
          className="btn-secondary"
          data-testid="ultimates-refresh-btn"
          title={isClosed ? "Ciclo encerrado não pode ser atualizado" : undefined}
        >
          {refreshing ? "Atualizando..." : "Atualizar agora"}
        </button>
      </div>
      {feedback && feedback.kind !== "success" && (
        <span
          role="status"
          data-testid="ultimates-refresh-feedback"
          style={{
            fontSize: 12,
            color: feedback.kind === "throttled" ? "var(--color-warning)" : "var(--color-danger)",
          }}
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}
