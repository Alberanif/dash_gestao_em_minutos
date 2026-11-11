"use client";

import { useState } from "react";
import { interpretRefreshResponse, formatRefreshedAgo, type RefreshOutcome } from "@/lib/vendas/refresh";
import { Button } from "../ui";
import { cx } from "../ui/cx";

interface ControleDeAtualizacaoProps {
  viewId: string;
  // POST /api/vendas/views/[id]/refresh
  refreshUrl: string;
  lastRefreshAt: string | null;
  // Sucesso: o pai recarrega os números da visualização.
  onRefreshed: () => void;
}

// Botão "Atualizar agora". A interpretação da resposta (throttle, lock, sucesso)
// fica em src/lib/vendas/refresh.ts, testável sem DOM; aqui só se orquestra fetch + estado.
export function ControleDeAtualizacao({ viewId, refreshUrl, lastRefreshAt, onRefreshed }: ControleDeAtualizacaoProps) {
  const [atualizando, setAtualizando] = useState(false);
  const [feedback, setFeedback] = useState<RefreshOutcome | null>(null);
  const [ultimaLocal, setUltimaLocal] = useState(lastRefreshAt);

  // A visualização selecionada (ou o last_refresh_at relido) pode mudar por fora:
  // resincroniza o rótulo durante o render, como o React recomenda para estado derivado de prop.
  const [origem, setOrigem] = useState({ viewId, lastRefreshAt });
  if (origem.viewId !== viewId || origem.lastRefreshAt !== lastRefreshAt) {
    setOrigem({ viewId, lastRefreshAt });
    setUltimaLocal(lastRefreshAt);
    setFeedback(null);
  }

  const rotulo = formatRefreshedAgo(ultimaLocal);

  async function aoClicar() {
    setAtualizando(true);
    setFeedback(null);
    try {
      const res = await fetch(refreshUrl, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      const resultado = interpretRefreshResponse(res.status, body);
      setFeedback(resultado);
      if (resultado.kind === "success") {
        setUltimaLocal(resultado.lastRefreshAt);
        onRefreshed();
      }
    } catch {
      setFeedback({ kind: "error", message: "Erro de conexão ao atualizar." });
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <div data-testid="vendas-refresh-controls" className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex items-center gap-3">
        {rotulo && (
          <span data-testid="vendas-refresh-label" className="text-xs text-v2-nevoa/65">
            {rotulo}
          </span>
        )}
        <Button variante="secundario" onClick={aoClicar} disabled={atualizando} data-testid="vendas-refresh-btn">
          {atualizando ? "Atualizando…" : "Atualizar agora"}
        </Button>
      </div>
      {feedback && feedback.kind !== "success" && (
        <span
          role="status"
          data-testid="vendas-refresh-feedback"
          className={cx("text-xs", feedback.kind === "throttled" ? "text-v2-nevoa/75" : "text-v2-queda")}
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}
