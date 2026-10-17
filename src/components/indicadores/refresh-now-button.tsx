"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { formatAge } from "@/lib/indicadores/cron-freshness";
import type { RefreshAccountError, RefreshStatus } from "@/lib/indicadores/refresh-status";

export const REFRESH_POLL_MS = 5000;

const STATUS_URL = "/api/indicadores/refresh-status";
const REFRESH_URL = "/api/indicadores/refresh";

const PLATFORM_LABEL: Record<string, string> = {
  hotmart: "Hotmart",
  "meta-ads": "Meta Ads",
};

type Phase = "idle" | "refreshing";

interface Props {
  /** Chamado quando uma coleta termina; o dashboard recarrega dados e frescor. */
  onRefreshed?: () => void;
  /** Relógio injetável (testes). */
  now?: () => Date;
}

/** Botão "Atualizar Agora" (PRD #234): dispara a coleta e acompanha até o fim. */
export function RefreshNowButton({ onRefreshed, now }: Props) {
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [otherRound, setOtherRound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<RefreshAccountError[]>([]);
  // Sem isto, um 2º clique antes do 1º POST responder dispararia duas coletas.
  const [posting, setPosting] = useState(false);
  const postingRef = useRef(false);

  const onRefreshedRef = useRef(onRefreshed);
  useEffect(() => {
    onRefreshedRef.current = onRefreshed;
  }, [onRefreshed]);

  const fetchStatus = useCallback(async (): Promise<RefreshStatus | null> => {
    try {
      const res = await fetch(STATUS_URL);
      if (!res.ok) return null;
      return (await res.json()) as RefreshStatus;
    } catch {
      return null;
    }
  }, []);

  // Leitura inicial. Coleta já em andamento (de outra aba/usuário/cron) é acompanhada.
  useEffect(() => {
    let cancelled = false;
    fetchStatus().then((s) => {
      if (cancelled || !s) return;
      setStatus(s);
      if (s.running) {
        setOtherRound(true);
        setPhase("refreshing");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  // Polling: só existe enquanto atualiza; o cleanup cancela ao terminar/desmontar.
  useEffect(() => {
    if (phase !== "refreshing") return;
    let cancelled = false;
    let inFlight = false;
    const id = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      const s = await fetchStatus();
      inFlight = false;
      if (cancelled || !s) return; // falha transitória: tenta no próximo ciclo
      setStatus(s);
      if (s.running) return;
      setErrors(s.has_current_error ? s.errors : []);
      setOtherRound(false);
      setPhase("idle");
      onRefreshedRef.current?.();
    }, REFRESH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase, fetchStatus]);

  async function handleClick() {
    if (postingRef.current || phase === "refreshing") return;
    postingRef.current = true;
    setPosting(true);
    setMessage(null);
    setErrors([]);
    try {
      const res = await fetch(REFRESH_URL, { method: "POST" });
      if (res.status === 202) {
        const body = (await res.json().catch(() => ({}))) as { skipped?: string };
        setOtherRound(Boolean(body.skipped));
        setPhase("refreshing");
      } else if (res.status === 429) {
        setMessage("Os dados foram atualizados há pouco. Tente novamente em alguns minutos.");
        const s = await fetchStatus();
        if (s) setStatus(s);
      } else if (res.status === 401 || res.status === 403) {
        setMessage("Sem permissão para atualizar os dados.");
      } else {
        setMessage("Não foi possível iniciar a atualização. Tente novamente.");
      }
    } catch {
      setMessage("Falha de rede ao iniciar a atualização. Tente novamente.");
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  const refreshing = phase === "refreshing";
  // Só desabilita quando o servidor disse que não pode (intervalo); sem leitura, o servidor decide.
  const blockedByInterval = !refreshing && status !== null && !status.can_refresh && !status.running;
  const disabled = refreshing || posting || blockedByInterval;

  let label = "Atualizar Agora";
  let hint: string | null = null;
  if (refreshing) {
    label = otherRound ? "Já há uma coleta em andamento…" : "Atualizando…";
  } else if (blockedByInterval) {
    let minutes: number | null = null;
    if (status?.last_finished_at) {
      const t = new Date(status.last_finished_at).getTime();
      if (!Number.isNaN(t)) {
        minutes = Math.max(0, Math.floor(((now ? now() : new Date()).getTime() - t) / 60000));
      }
    }
    hint = minutes === null ? "Dados atualizados há pouco" : `Dados atualizados ${formatAge(minutes)}`;
  }

  return (
    <div className="refresh-now" data-testid="refresh-now">
      <button
        type="button"
        className="refresh-now-btn"
        data-testid="refresh-now-button"
        data-state={refreshing ? "refreshing" : blockedByInterval ? "blocked" : "idle"}
        disabled={disabled}
        aria-busy={refreshing}
        onClick={handleClick}
      >
        {refreshing && <span className="refresh-now-spin" aria-hidden />}
        {label}
      </button>

      {hint && (
        <span className="refresh-now-hint" data-testid="refresh-now-hint">
          {hint}
        </span>
      )}

      {message && (
        <div className="refresh-now-msg" role="alert" data-testid="refresh-now-message">
          {message}
        </div>
      )}

      {errors.length > 0 && (
        <div className="refresh-now-errors" role="alert" data-testid="refresh-now-errors">
          <div className="refresh-now-errors-title">A coleta terminou com erro em:</div>
          <ul>
            {errors.map((e) => (
              <li key={e.account_id} data-testid="refresh-now-error-item">
                <strong>{e.name}</strong> ({PLATFORM_LABEL[e.platform] ?? e.platform})
                {e.last_error_message ? `: ${e.last_error_message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
