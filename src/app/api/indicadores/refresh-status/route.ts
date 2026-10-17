import { NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadRefreshInputs } from "@/lib/indicadores/load-refresh-inputs";
import { computeRefreshStatus } from "@/lib/indicadores/refresh-status";

/**
 * GET /api/indicadores/refresh-status
 * O que o botão "Atualizar Agora" precisa: coleta rodando (lock `indicadores`
 * não vencido), fim da última coleta, erros vigentes por conta e se pode
 * disparar. Mesmas roles do layout de /indicadores (gestor e analista).
 */
export async function GET() {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const now = new Date();
  const loaded = await loadRefreshInputs(createSupabaseServiceClient(), now);
  if (loaded.error !== undefined) {
    return NextResponse.json({ error: loaded.error }, { status: 500 });
  }

  return NextResponse.json(computeRefreshStatus({ ...loaded.inputs, now }));
}
