import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  fetchHotmartToken,
  mapHotmartSaleItem,
  upsertPlaceholderOffers,
  HOTMART_SALES_URL,
  type HotmartSaleItem,
} from "@/lib/services/hotmart";
import type { HotmartCredentials } from "@/types/accounts";

/**
 * Dash Ultimates — "Atualizar agora" (PRD issue #114, seção 6.3, RF-7, critério 8).
 *
 * Busca sob demanda das vendas Hotmart do produto de UM ciclo, sem tocar nos
 * crons globais. Protegida por dois mecanismos:
 *  - Throttle: bloqueia refreshes em rajada (< THROTTLE_MS desde last_refresh_at).
 *  - Lock atômico: um único UPDATE condicional em refresh_started_at resolve a
 *    corrida no Postgres. Perdedor sai imediatamente com 409, sem chamar a Hotmart.
 *
 * Toda conversa com a Hotmart tem prazo (HOTMART_BUDGET_MS): uma API lenta ou
 * inalcançável vira um erro rápido (502) em vez de travar o handler. Isso é o
 * que garante que o finally rode e o lock seja liberado — sem timeout, um fetch
 * pendurado deixava refresh_started_at preso e todo clique seguinte batia em 409.
 *
 * O finally libera o lock de forma CONDICIONAL (só se ainda for o nosso lock) e
 * grava last_refresh_at. Se mesmo assim o processo morrer antes do finally (ex.:
 * recompilação do `next dev`, kill de cold start — maxDuration não vale em dev),
 * o TTL do lock é a rede de segurança: outra invocação o rouba após LOCK_TTL_MS.
 * Escrita via service_role (a tabela só permite escrita fora da RLS).
 */

// A busca escopada pagina a API da Hotmart; folga para não ser cortado pela
// plataforma serverless durante uma sincronização mais longa. ATENÇÃO: isto é
// ignorado pelo `next dev` (localhost) — a rede de segurança real é o LOCK_TTL,
// não este limite.
export const maxDuration = 60;

// Prazo total gasto falando com a Hotmart (token + páginas de vendas). Fica bem
// abaixo do LOCK_TTL para que um refresh nunca ultrapasse a janela do lock.
const HOTMART_BUDGET_MS = 45 * 1000;
// Janela mínima entre dois refreshes bem-sucedidos do mesmo ciclo.
const THROTTLE_MS = 60 * 1000;
// Lock mais velho que isto é considerado órfão e pode ser roubado. Precisa ser
// > HOTMART_BUDGET_MS para que um refresh legítimo não tenha o lock roubado no meio.
const LOCK_TTL_MS = 90 * 1000;

type Params = { id: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  // 1. Ciclo existe?
  const { data: cycle, error: cycleErr } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("id, account_id, product_id, status, created_at, last_refresh_at")
    .eq("id", id)
    .single();

  if (cycleErr || !cycle) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  // 2. Ciclo encerrado é histórico — refresh bloqueado.
  if (cycle.status === "encerrado") {
    return NextResponse.json(
      { error: "Ciclo encerrado não pode ser atualizado" },
      { status: 409 }
    );
  }

  const now = new Date();

  // 3. Throttle: refresh recente demais.
  if (cycle.last_refresh_at) {
    const elapsedMs = now.getTime() - new Date(cycle.last_refresh_at).getTime();
    if (elapsedMs < THROTTLE_MS) {
      const retryAfterSeconds = Math.ceil((THROTTLE_MS - elapsedMs) / 1000);
      return NextResponse.json(
        {
          error: "Atualização muito recente. Aguarde antes de atualizar novamente.",
          retryAfterSeconds,
        },
        { status: 429 }
      );
    }
  }

  // 4. Aquisição ATÔMICA do lock: UPDATE condicional numa única statement.
  // Só o primeiro a ver refresh_started_at nulo/expirado vence.
  const lockedAtIso = now.toISOString();
  const expiryIso = new Date(now.getTime() - LOCK_TTL_MS).toISOString();
  const { data: locked, error: lockErr } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .update({ refresh_started_at: lockedAtIso })
    .eq("id", id)
    .or(`refresh_started_at.is.null,refresh_started_at.lt.${expiryIso}`)
    .select();

  if (lockErr) {
    return NextResponse.json({ error: lockErr.message }, { status: 500 });
  }

  const wonLock = Array.isArray(locked) && locked.length > 0;
  if (!wonLock) {
    return NextResponse.json({ error: "refresh em andamento" }, { status: 409 });
  }

  // 5. Vencedor: busca escopada + upsert. finally SEMPRE libera o lock.
  try {
    // Prazo para toda a conversa com a Hotmart: aborta se estourar o orçamento
    // OU se o cliente desconectar. Sem isto, um fetch pendurado trava o handler
    // antes do finally e vaza o lock (causa raiz do 409 "refresh em andamento").
    // Dentro do try: se AbortSignal.any/timeout lançar, o finally ainda libera.
    const hotmartSignal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(HOTMART_BUDGET_MS),
    ]);

    const { data: account, error: accountErr } = await supabase
      .from("dash_gestao_accounts")
      .select("id, credentials")
      .eq("id", cycle.account_id)
      .single();

    if (accountErr || !account) {
      throw new Error("Conta Hotmart do ciclo não encontrada");
    }

    const { client_id, client_secret } = account.credentials as HotmartCredentials;
    const accessToken = await fetchHotmartToken(client_id, client_secret, hotmartSignal);

    // Período do ciclo: da criação até agora. Escopo por product_id (parâmetro
    // nativo da API sales/history) — busca só as vendas do produto do ciclo.
    const startMs = new Date(cycle.created_at).getTime();
    const endMs = now.getTime();

    const allItems: HotmartSaleItem[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(HOTMART_SALES_URL);
      url.searchParams.set("start_date", String(startMs));
      url.searchParams.set("end_date", String(endMs));
      url.searchParams.set("product_id", cycle.product_id);
      url.searchParams.set("max_results", "500");
      if (pageToken) url.searchParams.set("page_token", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: hotmartSignal,
      });

      if (!res.ok) {
        throw new Error(`Hotmart sales API error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      allItems.push(...(data.items ?? []));
      pageToken = data.page_info?.next_page_token;
    } while (pageToken);

    let upserted = 0;
    if (allItems.length > 0) {
      const collectedAt = now.toISOString();
      const rows = allItems.map((item) =>
        mapHotmartSaleItem(item, cycle.account_id, collectedAt)
      );

      // Garante que os offer_codes das vendas existam em hotmart_offers antes do
      // upsert (FK offer_code -> dash_gestao_hotmart_offers) — mesmo pré-upsert
      // usado por collectHotmart. Necessário para ofertas novas ainda não
      // sincronizadas por syncHotmartProducts.
      await upsertPlaceholderOffers(supabase, rows, collectedAt);

      const { error: upsertErr } = await supabase
        .from("dash_gestao_hotmart_sales")
        .upsert(rows, { onConflict: "transaction_code" });

      if (upsertErr) throw new Error(`Hotmart upsert error: ${upsertErr.message}`);
      upserted = rows.length;
    }

    const lastRefreshAt = new Date().toISOString();
    return NextResponse.json({ upserted, lastRefreshAt });
  } catch (err) {
    // AbortError = estouramos o orçamento da Hotmart (ou o cliente desconectou):
    // mensagem clara em vez do erro cru de fetch abortado.
    const message =
      err instanceof Error
        ? err.name === "TimeoutError" || err.name === "AbortError"
          ? "A Hotmart não respondeu a tempo. Tente novamente."
          : err.message
        : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    // Libera o lock e grava last_refresh_at SEMPRE — inclusive em erro
    // (sem lock preso; o throttle passa a valer a partir desta tentativa).
    // Release CONDICIONAL (refresh_started_at = lockedAtIso): se o TTL já tiver
    // expirado e outra invocação roubado o lock, o eq() não casa e não apagamos
    // o lock alheio — correção independente de qualquer premissa de timing.
    const { error: releaseErr } = await supabase
      .from("dash_gestao_ultimates_cycles")
      .update({ refresh_started_at: null, last_refresh_at: new Date().toISOString() })
      .eq("id", id)
      .eq("refresh_started_at", lockedAtIso);
    if (releaseErr) {
      // Não relança (não pode sobrescrever a resposta já formada); loga para o
      // TTL não ser a única pista de que o release falhou.
      console.error(`[ultimates/refresh] falha ao liberar lock do ciclo ${id}: ${releaseErr.message}`);
    }
  }
}
