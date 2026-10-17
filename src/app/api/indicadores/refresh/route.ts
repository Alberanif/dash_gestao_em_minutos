import { NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { acquireLock, type CronLock } from "@/lib/cron/lock";
import { INDICADORES_LOCK_NAME, runRound } from "@/lib/cron/indicadores-round";
import { loadRefreshInputs } from "@/lib/indicadores/load-refresh-inputs";
import { computeRefreshStatus } from "@/lib/indicadores/refresh-status";

// Botão "Atualizar Agora" (PRD #234, issue #237). Autenticado pela sessão
// (sem CRON_SECRET); a coleta roda em background na rodada compartilhada com o cron.
export const dynamic = "force-dynamic";

export async function POST() {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const now = new Date();
  const loaded = await loadRefreshInputs(createSupabaseServiceClient(), now);
  if (loaded.error !== undefined) {
    return NextResponse.json({ error: loaded.error }, { status: 500 });
  }

  // `running: false` de propósito: o lock ocupado responde 202 skipped logo abaixo,
  // então aqui só vale a regra do intervalo / erro vigente.
  const status = computeRefreshStatus({ ...loaded.inputs, running: false, now });
  if (!status.can_refresh) {
    return NextResponse.json(
      { error: "Atualizado há pouco", last_finished_at: status.last_finished_at },
      { status: 429 },
    );
  }

  let lock: CronLock | null;
  try {
    lock = await acquireLock(INDICADORES_LOCK_NAME);
  } catch (err) {
    console.error("[indicadores/refresh] falha ao adquirir lock:", err);
    return NextResponse.json({ error: "Falha ao adquirir lock" }, { status: 500 });
  }
  if (!lock) {
    return NextResponse.json({ skipped: "em andamento" }, { status: 202 });
  }

  // Promise deliberadamente não aguardada: a Railway roda um processo Node persistente.
  void runRound(lock, ["hotmart", "meta-ads"], "24h");

  return NextResponse.json({ accepted: true }, { status: 202 });
}
