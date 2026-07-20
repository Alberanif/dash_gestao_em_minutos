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
 *    corrida no Postgres (padrão Six Dados, conventions.md §12). Perdedor sai
 *    imediatamente com 409, sem chamar a Hotmart.
 *
 * O lock é sempre liberado no finally (mesmo em erro), gravando last_refresh_at.
 * Escrita via service_role (a tabela só permite escrita fora da RLS).
 */

// A busca escopada pagina a API da Hotmart; folga para não ser cortado pela
// plataforma serverless durante uma sincronização mais longa.
export const maxDuration = 60;

// Janela mínima entre dois refreshes bem-sucedidos do mesmo ciclo.
const THROTTLE_MS = 60 * 1000;
// Lock com mais de 2 min é considerado travado e pode ser roubado.
const LOCK_TTL_MS = 2 * 60 * 1000;

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
    const { data: account, error: accountErr } = await supabase
      .from("dash_gestao_accounts")
      .select("id, credentials")
      .eq("id", cycle.account_id)
      .single();

    if (accountErr || !account) {
      throw new Error("Conta Hotmart do ciclo não encontrada");
    }

    const { client_id, client_secret } = account.credentials as HotmartCredentials;
    const accessToken = await fetchHotmartToken(client_id, client_secret);

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
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    // Libera o lock e grava last_refresh_at SEMPRE — inclusive em erro
    // (sem lock preso; o throttle passa a valer a partir desta tentativa).
    // O release incondicional é seguro porque maxDuration (60s) < LOCK_TTL
    // (120s): a invocação não pode passar do TTL e ter seu lock roubado por
    // outra antes de chegar aqui, então este clear nunca apaga lock alheio.
    await supabase
      .from("dash_gestao_ultimates_cycles")
      .update({ refresh_started_at: null, last_refresh_at: new Date().toISOString() })
      .eq("id", id);
  }
}
