/**
 * Regra de frescor da coleta automática de Indicadores (PRD #225).
 * Funções puras, sem UI e sem acesso a banco: a cor do indicador do cabeçalho
 * sai daqui para poder ser testada nas fronteiras.
 */

export type FreshnessLevel = "green" | "amber" | "red" | "none";

export interface AccountCronStatus {
  account_id: string;
  name: string;
  platform: string;
  /** ISO do último log com status "success"; null = nunca teve sucesso. */
  last_success_at: string | null;
  /** ISO do último log com status "error"; null = nunca falhou. */
  last_error_at: string | null;
  last_error_message: string | null;
}

export interface CronFreshness {
  level: FreshnessLevel;
  /** Minutos desde o sucesso mais antigo entre as contas; null se alguma conta nunca teve sucesso ou não há contas. */
  minutes: number | null;
}

const MIN_MS = 60_000;
export const GREEN_MAX_MIN = 60;
export const AMBER_MAX_MIN = 120;

/** Idade em minutos (fracionária) de um sucesso; sem sucesso = Infinity. */
function ageMinutes(lastSuccessAt: string | null, now: Date): number {
  if (!lastSuccessAt) return Infinity;
  const t = new Date(lastSuccessAt).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.max(0, (now.getTime() - t) / MIN_MS);
}

/** Faixa de cor para uma idade em minutos: ate 60 verde, ate 120 ambar, acima vermelho. */
export function levelForAge(minutes: number): FreshnessLevel {
  if (minutes <= GREEN_MAX_MIN) return "green";
  if (minutes <= AMBER_MAX_MIN) return "amber";
  return "red";
}

/**
 * Resume as contas ativas em um único nível: vale a pior conta.
 * Conta ativa sem nenhum sucesso conta como vermelho. Sem contas = "none".
 * Contas inativas devem ser filtradas antes (ver `isMonitoredAccount`).
 */
export function summarizeFreshness(
  accounts: Pick<AccountCronStatus, "last_success_at">[],
  now: Date = new Date(),
): CronFreshness {
  if (accounts.length === 0) return { level: "none", minutes: null };
  let worst = 0;
  for (const a of accounts) {
    worst = Math.max(worst, ageMinutes(a.last_success_at, now));
  }
  if (worst === Infinity) return { level: "red", minutes: null };
  return { level: levelForAge(worst), minutes: Math.floor(worst) };
}

/** Só contas ativas de Hotmart e Meta Ads entram no indicador. */
export function isMonitoredAccount(a: { platform: string; is_active: boolean }): boolean {
  return a.is_active === true && (a.platform === "hotmart" || a.platform === "meta-ads");
}

/** "Atualizado há 12 min" / "há 1h 5min" / "sem coleta registrada". */
export function formatAge(minutes: number | null): string {
  if (minutes === null) return "sem coleta registrada";
  if (minutes < 1) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `há ${h}h` : `há ${h}h ${m}min`;
}

/** Erro só conta se for mais recente que o último sucesso; erro antigo já foi superado. */
export function hasCurrentError(
  a: Pick<AccountCronStatus, "last_success_at" | "last_error_at">,
): boolean {
  if (!a.last_error_at) return false;
  if (!a.last_success_at) return true;
  return new Date(a.last_error_at).getTime() > new Date(a.last_success_at).getTime();
}
