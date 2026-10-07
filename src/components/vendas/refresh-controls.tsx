"use client";

import { useEffect, useState } from "react";
import { interpretRefreshResponse, formatRefreshedAgo, type RefreshOutcome } from "@/lib/vendas/refresh";

interface RefreshControlsProps {
  viewId: string;
  // POST /api/vendas/views/[id]/refresh
  refreshUrl: string;
  lastRefreshAt: string | null;
  // Sucesso ⇒ o pai recarrega os números da visualização.
  onRefreshed: () => void;
}

// Botão "Atualizar agora". A interpretação da resposta
// (throttle/lock/sucesso) fica em src/lib/vendas/refresh.ts, testável
// sem DOM; este componente só orquestra fetch + estado de UI.
export function RefreshControls({ viewId, refreshUrl, lastRefreshAt, onRefreshed }: RefreshControlsProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<RefreshOutcome | null>(null);
  const [localLastRefreshAt, setLocalLastRefreshAt] = useState(lastRefreshAt);

  // a visualização selecionada pode trocar — resincroniza o rótulo local.
  useEffect(() => {
    setLocalLastRefreshAt(lastRefreshAt);
    setFeedback(null);
  }, [viewId, lastRefreshAt]);

  const label = formatRefreshedAgo(localLastRefreshAt);

  async function handleClick() {
    setRefreshing(true);
    setFeedback(null);
    try {
      const res = await fetch(refreshUrl, { method: "POST" });
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
      data-testid="vendas-refresh-controls"
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {label && (
          <span data-testid="vendas-refresh-label" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {label}
          </span>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={refreshing}
          className="btn-secondary"
          data-testid="vendas-refresh-btn"
        >
          {refreshing ? "Atualizando..." : "Atualizar agora"}
        </button>
      </div>
      {feedback && feedback.kind !== "success" && (
        <span
          role="status"
          data-testid="vendas-refresh-feedback"
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
