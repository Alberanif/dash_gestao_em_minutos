import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { releaseLock, type CronLock } from "@/lib/cron/lock";
import { syncPlatform, type SyncWindow } from "@/lib/services/sync-platform";

// Rodada de coleta dos Indicadores, compartilhada pela rota do cron
// (/api/cron/indicadores) e pelo botão "Atualizar Agora" (PRD #234).

export const INDICADORES_LOCK_NAME = "indicadores";
export const WINDOWS: readonly SyncWindow[] = ["24h", "3d"];
export const ALLOWED_PLATFORMS = ["hotmart", "meta-ads"] as const;
export const DEFAULT_PLATFORMS = "hotmart,meta-ads";

export type ParseResult<T> = { value: T; error?: undefined } | { error: string; value?: undefined };

/** Valida a janela; `null`/`undefined` usa o padrão `24h`. */
export function parseWindow(raw: string | null | undefined): ParseResult<SyncWindow> {
  const window = (raw ?? "24h") as SyncWindow;
  if (!WINDOWS.includes(window)) {
    return { error: `window inválido; use ${WINDOWS.join(" ou ")}` };
  }
  return { value: window };
}

/** Valida a lista (CSV) de plataformas; `null`/`undefined` usa o padrão. Remove duplicatas. */
export function parsePlatforms(raw: string | null | undefined): ParseResult<string[]> {
  const platforms = [
    ...new Set(
      (raw ?? DEFAULT_PLATFORMS)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    ),
  ];
  const invalid = platforms.filter(
    (p) => !(ALLOWED_PLATFORMS as readonly string[]).includes(p)
  );
  if (platforms.length === 0 || invalid.length > 0) {
    return {
      error: `platforms inválido${invalid.length ? ` (${invalid.join(", ")})` : ""}; permitidas: ${ALLOWED_PLATFORMS.join(", ")}`,
    };
  }
  return { value: platforms };
}

/**
 * Plataformas em paralelo; as contas de cada plataforma rodam em sequência dentro de
 * `syncPlatform`, que também grava o resultado de cada conta em `dash_gestao_cron_logs`
 * (erro numa conta não derruba as outras). O lock é liberado no `finally`, inclusive
 * quando a coleta lança. Nunca rejeita: roda sem ninguém aguardando.
 */
export async function runRound(
  lock: CronLock,
  platforms: string[],
  window: SyncWindow
): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    const settled = await Promise.allSettled(
      platforms.map((p) => syncPlatform(p, supabase, { window }))
    );
    settled.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[cron/indicadores] plataforma ${platforms[i]} falhou:`, r.reason);
      }
    });
  } catch (err) {
    console.error("[cron/indicadores] rodada falhou:", err);
  } finally {
    try {
      await releaseLock(lock);
    } catch (err) {
      // Sem liberar, o TTL (45 min) destrava o sistema sozinho.
      console.error("[cron/indicadores] falha ao liberar lock:", err);
    }
  }
}
