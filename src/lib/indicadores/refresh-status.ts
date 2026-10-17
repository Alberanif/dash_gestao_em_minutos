/**
 * Regra do botão "Atualizar Agora" (PRD #234). Função pura, sem banco:
 * a fronteira dos 5 min é testada aqui.
 */

import { hasCurrentError, type AccountCronStatus } from "@/lib/indicadores/cron-freshness";

/** Intervalo mínimo entre coletas (cron ou botão). */
export const REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;

export interface RefreshAccountError {
  account_id: string;
  name: string;
  platform: string;
  last_error_at: string | null;
  last_error_message: string | null;
}

export interface RefreshStatus {
  running: boolean;
  last_finished_at: string | null;
  has_current_error: boolean;
  errors: RefreshAccountError[];
  can_refresh: boolean;
}

/** Contas com erro vigente (erro mais recente que o último sucesso). */
export function currentErrors(accounts: AccountCronStatus[]): RefreshAccountError[] {
  return accounts.filter(hasCurrentError).map((a) => ({
    account_id: a.account_id,
    name: a.name,
    platform: a.platform,
    last_error_at: a.last_error_at,
    last_error_message: a.last_error_message,
  }));
}

/**
 * Libera o botão se não há coleta rodando e (passou o intervalo mínimo desde a
 * última coleta, ou há erro vigente). Exatamente 5 min já libera.
 */
export function computeRefreshStatus(input: {
  running: boolean;
  lastFinishedAt: string | null;
  accounts: AccountCronStatus[];
  now: Date;
}): RefreshStatus {
  const errors = currentErrors(input.accounts);
  const hasError = errors.length > 0;

  let withinInterval = false;
  if (input.lastFinishedAt) {
    const t = new Date(input.lastFinishedAt).getTime();
    if (!Number.isNaN(t)) {
      withinInterval = input.now.getTime() - t < REFRESH_MIN_INTERVAL_MS;
    }
  }

  return {
    running: input.running,
    last_finished_at: input.lastFinishedAt,
    has_current_error: hasError,
    errors,
    can_refresh: !input.running && (!withinInterval || hasError),
  };
}
