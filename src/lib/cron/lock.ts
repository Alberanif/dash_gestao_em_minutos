// Lock genérico com TTL para rotinas de cron (PRD #225, issue #227).
// A atomicidade vive no banco (migration 073): aqui só há o contrato.

import { randomUUID } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const DEFAULT_LOCK_TTL_MS = 45 * 60 * 1000;

/** Nome do lock da coleta de Indicadores (cron e botão "Atualizar Agora"). */
export const INDICADORES_LOCK_NAME = "indicadores";

/** Subconjunto do SupabaseClient usado aqui (facilita injetar fake nos testes). */
export interface LockRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface CronLock {
  name: string;
  token: string;
}

/**
 * Tenta adquirir o lock `name`. Devolve o lock (com o token do dono) ou null
 * se há um lock ativo. Lock vencido é assumido. Erros de banco lançam: não
 * confundir "ocupado" com "falhou".
 */
export async function acquireLock(
  name: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS,
  client: LockRpcClient = createSupabaseServiceClient(),
): Promise<CronLock | null> {
  const ttlSeconds = Math.ceil(ttlMs / 1000);
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("ttlMs deve ser positivo");
  }
  const token = randomUUID();
  const { data, error } = await client.rpc("dash_gestao_cron_acquire_lock", {
    p_name: name,
    p_token: token,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw new Error(`acquireLock(${name}): ${error.message}`);
  return data === true ? { name, token } : null;
}

/**
 * Libera o lock só se o token ainda for o do dono. Idempotente: devolve false
 * (sem lançar) se já foi liberado ou se venceu e foi assumido por outro.
 */
export async function releaseLock(
  lock: CronLock,
  client: LockRpcClient = createSupabaseServiceClient(),
): Promise<boolean> {
  const { data, error } = await client.rpc("dash_gestao_cron_release_lock", {
    p_name: lock.name,
    p_token: lock.token,
  });
  if (error) throw new Error(`releaseLock(${lock.name}): ${error.message}`);
  return data === true;
}
