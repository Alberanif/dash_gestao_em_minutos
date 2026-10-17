import { NextRequest, NextResponse } from "next/server";
import { validateCronApiKey } from "@/lib/utils/api-auth";
import { acquireLock, type CronLock } from "@/lib/cron/lock";
import {
  INDICADORES_LOCK_NAME,
  parsePlatforms,
  parseWindow,
  runRound,
} from "@/lib/cron/indicadores-round";

// PRD #225 / issue #228. Disparado pelo cron-job.org, que corta a requisição em ~30s:
// responde 202 logo após pegar o lock e coleta em background.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error: authError } = await validateCronApiKey(request);
  if (authError) return authError;

  const params = request.nextUrl.searchParams;

  const parsedWindow = parseWindow(params.get("window"));
  if (parsedWindow.error !== undefined) {
    return NextResponse.json({ error: parsedWindow.error }, { status: 400 });
  }
  const window = parsedWindow.value;

  const parsedPlatforms = parsePlatforms(params.get("platforms"));
  if (parsedPlatforms.error !== undefined) {
    return NextResponse.json({ error: parsedPlatforms.error }, { status: 400 });
  }
  const platforms = parsedPlatforms.value;

  // Erro de banco no acquire NÃO é "ocupado": devolve 500 para o cron-job.org
  // notificar a falha, em vez de mascarar como skipped.
  let lock: CronLock | null;
  try {
    lock = await acquireLock(INDICADORES_LOCK_NAME);
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
