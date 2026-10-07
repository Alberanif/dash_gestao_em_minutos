import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  fetchAndStoreProductSales,
  getHotmartAccessToken,
  errorMessage,
  REFRESH_BUDGET_MS,
  THROTTLE_MS,
  LOCK_TTL_MS,
  REFRESH_LOOKBACK_DAYS,
  runBackfill,
} from "@/lib/vendas/views-sync";
import type { VendasViewRecord } from "@/types/vendas";

/**
 * "Atualizar agora" de uma Visualização (PRD #185, fatia 2/4). Derivada de
 * rota de refresh anterior, MAIS ENXUTA: busca só as vendas do produto da
 * visualização e grava em hotmart_sales (a visualização só conta vendas).
 *
 * Mantém o contrato de segurança do refresh antigo:
 *  - Throttle de 60s (429 com retryAfterSeconds).
 *  - Lock atômico por UPDATE condicional em refresh_started_at (409 se perder).
 *    Usa { count: "exact" } e NUNCA .select(): o RETURNING reavaliaria o filtro
 *    sobre a linha já atualizada e voltaria vazio (lock órfão + 409 eterno).
 *  - Orçamento de tempo em TODO I/O externo; estouro vira 502 e o finally roda.
 *  - Release condicional (só libera o NOSSO lock) + TTL como rede de segurança.
 *
 * Janela: últimos REFRESH_LOOKBACK_DAYS dias (respeitando view_start_date se for
 * mais recente). O histórico anterior é do backfill.
 *
 * RECUPERAÇÃO DE BACKFILL: o refresh incremental não cobre o histórico, então se
 * backfill_status for failed/pending/partial — ou running ÓRFÃO (updated_at mais
 * velho que LOCK_TTL_MS: o processo que o iniciou morreu) — o "Atualizar agora"
 * roda o backfill COMPLETO (runBackfill, todas as ofertas) no lugar do
 * incremental, sob o mesmo throttle/lock/orçamento. É o que dá sentido ao botão
 * "Tentar novamente" da UI. Um running NÃO órfão devolve 409 (há um backfill vivo).
 */
export const maxDuration = 60;

const VIEWS_TABLE = "dash_gestao_vendas_views";
const DAY_MS = 24 * 60 * 60 * 1000;

type Params = { id: string };

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: found, error: viewErr } = await supabase
    .from(VIEWS_TABLE)
    .select(
      "id, account_id, product_id, offer_codes, view_start_date, last_refresh_at, backfill_status, updated_at"
    )
    .eq("id", id)
    .single();

  if (viewErr || !found) {
    return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });
  }
  const view = found as Pick<
    VendasViewRecord,
    | "id"
    | "account_id"
    | "product_id"
    | "offer_codes"
    | "view_start_date"
    | "last_refresh_at"
    | "backfill_status"
    | "updated_at"
  >;

  const now = new Date();

  const runningAlive =
    view.backfill_status === "running" &&
    now.getTime() - new Date(view.updated_at).getTime() < LOCK_TTL_MS;
  if (runningAlive) {
    return NextResponse.json({ error: "backfill em andamento" }, { status: 409 });
  }
  // failed | pending | partial | running órfão => refaz o backfill completo.
  const needsBackfill = view.backfill_status !== "done";

  if (view.last_refresh_at) {
    const elapsedMs = now.getTime() - new Date(view.last_refresh_at).getTime();
    if (elapsedMs < THROTTLE_MS) {
      return NextResponse.json(
        {
          error: "Atualização muito recente. Aguarde antes de atualizar novamente.",
          retryAfterSeconds: Math.ceil((THROTTLE_MS - elapsedMs) / 1000),
        },
        { status: 429 }
      );
    }
  }

  const lockedAtIso = now.toISOString();
  const expiryIso = new Date(now.getTime() - LOCK_TTL_MS).toISOString();
  const { count, error: lockErr } = await supabase
    .from(VIEWS_TABLE)
    .update({ refresh_started_at: lockedAtIso }, { count: "exact" })
    .eq("id", id)
    .or(`refresh_started_at.is.null,refresh_started_at.lt.${expiryIso}`);

  if (lockErr) {
    return NextResponse.json({ error: lockErr.message }, { status: 500 });
  }
  if ((count ?? 0) === 0) {
    return NextResponse.json({ error: "refresh em andamento" }, { status: 409 });
  }

  try {
    if (needsBackfill) {
      const outcome = await runBackfill({
        supabase,
        view,
        offerCodes: view.offer_codes,
        now,
        budgetMs: REFRESH_BUDGET_MS,
        signal: request.signal,
      });
      if (outcome.status === "failed") {
        return NextResponse.json(
          { error: outcome.error ?? "Falha ao refazer o histórico da visualização" },
          { status: 502 }
        );
      }
      const lastRefreshAt = new Date().toISOString();
      return NextResponse.json({
        upserted: 0,
        backfill: outcome.status,
        lastRefreshAt,
        view: await readView(supabase, id, lastRefreshAt),
      });
    }

    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(REFRESH_BUDGET_MS)]);

    const accessToken = await getHotmartAccessToken(supabase, view.account_id, deadline);

    const lookbackMs = now.getTime() - REFRESH_LOOKBACK_DAYS * DAY_MS;
    const periodStartMs = view.view_start_date
      ? Date.parse(`${view.view_start_date}T00:00:00.000Z`)
      : 0;
    const startMs = Math.max(lookbackMs, periodStartMs);

    const upserted = await fetchAndStoreProductSales({
      supabase,
      accountId: view.account_id,
      accessToken,
      productId: view.product_id,
      startMs,
      endMs: now.getTime(),
      collectedAt: now.toISOString(),
      deadline,
    });

    const lastRefreshAt = new Date().toISOString();
    return NextResponse.json({ upserted, lastRefreshAt, view: await readView(supabase, id, lastRefreshAt) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  } finally {
    // Release CONDICIONAL: se o TTL expirou e outra invocação roubou o lock, o
    // eq() não casa e não apagamos o lock alheio.
    const { error: releaseErr } = await supabase
      .from(VIEWS_TABLE)
      .update({ refresh_started_at: null, last_refresh_at: new Date().toISOString() })
      .eq("id", id)
      .eq("refresh_started_at", lockedAtIso);
    if (releaseErr) {
      console.error(`[vendas/views/refresh] falha ao liberar lock da visualização ${id}: ${releaseErr.message}`);
    }
  }
}

// A resposta de sucesso devolve a visualização atualizada. A leitura roda ANTES
// do finally (o release ainda não aconteceu), então last_refresh_at e o lock são
// refletidos à mão: é o estado que o finally está prestes a gravar.
async function readView(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  id: string,
  lastRefreshAt: string
): Promise<VendasViewRecord | null> {
  const { data } = await supabase.from(VIEWS_TABLE).select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return { ...(data as VendasViewRecord), refresh_started_at: null, last_refresh_at: lastRefreshAt };
}
