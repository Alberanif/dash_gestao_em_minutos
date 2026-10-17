import { NextRequest, NextResponse } from "next/server";
import { validateCronApiKey } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { acquireLock, releaseLock, type CronLock } from "@/lib/cron/lock";
import { syncPlatform, type SyncWindow } from "@/lib/services/sync-platform";

// PRD #225 / issue #228. Disparado pelo cron-job.org, que corta a requisição em ~30s:
// responde 202 logo após pegar o lock e coleta em background.
export const dynamic = "force-dynamic";

const LOCK_NAME = "indicadores";
const WINDOWS: readonly SyncWindow[] = ["24h", "3d"];
const ALLOWED_PLATFORMS = ["hotmart", "meta-ads"] as const;
const DEFAULT_PLATFORMS = "hotmart,meta-ads";

/**
 * Plataformas em paralelo; as contas de cada plataforma rodam em sequência dentro de
 * `syncPlatform`, que também grava o resultado de cada conta em `dash_gestao_cron_logs`
 * (erro numa conta não derruba as outras). O lock é liberado no `finally`, inclusive
 * quando a coleta lança. Nunca rejeita: roda sem ninguém aguardando.
 */
async function runRound(
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

export async function POST(request: NextRequest) {
  const { error: authError } = await validateCronApiKey(request);
  if (authError) return authError;

  const params = request.nextUrl.searchParams;

  const window = (params.get("window") ?? "24h") as SyncWindow;
  if (!WINDOWS.includes(window)) {
    return NextResponse.json(
      { error: `window inválido; use ${WINDOWS.join(" ou ")}` },
      { status: 400 }
    );
  }

  const platforms = [
    ...new Set(
      (params.get("platforms") ?? DEFAULT_PLATFORMS)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    ),
  ];
  const invalid = platforms.filter(
    (p) => !(ALLOWED_PLATFORMS as readonly string[]).includes(p)
  );
  if (platforms.length === 0 || invalid.length > 0) {
    return NextResponse.json(
      {
        error: `platforms inválido${invalid.length ? ` (${invalid.join(", ")})` : ""}; permitidas: ${ALLOWED_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Erro de banco no acquire NÃO é "ocupado": devolve 500 para o cron-job.org
  // notificar a falha, em vez de mascarar como skipped.
  let lock: CronLock | null;
  try {
    lock = await acquireLock(LOCK_NAME);
  } catch (err) {
    console.error("[cron/indicadores] falha ao adquirir lock:", err);
    return NextResponse.json({ error: "Falha ao adquirir lock" }, { status: 500 });
  }

  if (!lock) {
    return NextResponse.json({ skipped: "em andamento" }, { status: 202 });
  }

  // Promise deliberadamente não aguardada: a Railway roda um processo Node persistente.
  void runRound(lock, platforms, window);

  return NextResponse.json({ accepted: true, window, platforms }, { status: 202 });
}
