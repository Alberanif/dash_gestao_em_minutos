import type { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  fetchHotmartToken,
  mapHotmartSaleItem,
  upsertPlaceholderOffers,
  HOTMART_SALES_URL,
  type HotmartSaleItem,
} from "@/lib/services/hotmart";
import type { HotmartCredentials } from "@/types/accounts";

// Sincronização de vendas das Visualizações (PRD #185, fatia 2/4): o "Atualizar
// agora" e o backfill compartilham a MESMA busca/gravação, para que a invariante
// "só vendas do produto, gravadas em hotmart_sales, sem materializar compradores"
// exista em um lugar só. Esta camada NUNCA chama
// dash_gestao_vendas_sync_buyers_from_sales — visualização conta vendas, não
// compradores.

type Supabase = ReturnType<typeof createSupabaseServiceClient>;

const VIEWS_TABLE = "dash_gestao_vendas_views";

/** Orçamento TOTAL de I/O externo de um refresh (abaixo do LOCK_TTL de 90s). */
export const REFRESH_BUDGET_MS = 45 * 1000;
/** Orçamento do backfill síncrono (POST /views e PATCH com oferta nova). */
export const BACKFILL_BUDGET_MS = 40 * 1000;
/** Janela mínima entre dois refreshes da mesma visualização. */
export const THROTTLE_MS = 60 * 1000;
/** Lock mais velho que isto é órfão e pode ser roubado. */
export const LOCK_TTL_MS = 90 * 1000;
/** Sem período definido, o backfill cobre os últimos N dias. */
export const BACKFILL_DEFAULT_DAYS = 90;
/** O backfill anda de trás para frente em janelas deste tamanho. */
export const BACKFILL_CHUNK_DAYS = 30;
/** O refresh olha só os últimos N dias (o resto é do backfill). */
export const REFRESH_LOOKBACK_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return isAbortError(err)
      ? "A atualização demorou demais e foi interrompida. Tente novamente."
      : err.message;
  }
  return "Erro desconhecido";
}

/** "YYYY-MM-DD" -> ms do início desse dia em UTC. */
function dayStartMs(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

function toDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function getHotmartAccessToken(
  supabase: Supabase,
  accountId: string,
  deadline: AbortSignal
): Promise<string> {
  const { data: account, error } = await supabase
    .from("dash_gestao_accounts")
    .select("id, credentials")
    .eq("id", accountId)
    .abortSignal(deadline)
    .single();

  if (error || !account) {
    throw new Error("Conta Hotmart da visualização não encontrada");
  }

  const { client_id, client_secret } = account.credentials as HotmartCredentials;
  return fetchHotmartToken(client_id, client_secret, deadline);
}

/**
 * Pagina a Hotmart para UM produto (e, opcionalmente, UMA oferta) no intervalo
 * [startMs, endMs] e grava em dash_gestao_hotmart_sales ao fim da paginação.
 * Todo fetch carrega `deadline` — sem isso um fetch pendurado vaza o lock.
 */
export async function fetchAndStoreProductSales(args: {
  supabase: Supabase;
  accountId: string;
  accessToken: string;
  productId: string;
  offerCode?: string;
  startMs: number;
  endMs: number;
  collectedAt: string;
  deadline: AbortSignal;
}): Promise<number> {
  const { supabase, accountId, accessToken, productId, offerCode, deadline } = args;
  const items: HotmartSaleItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(HOTMART_SALES_URL);
    url.searchParams.set("start_date", String(args.startMs));
    url.searchParams.set("end_date", String(args.endMs));
    url.searchParams.set("product_id", productId);
    if (offerCode) url.searchParams.set("offer_code", offerCode);
    url.searchParams.set("max_results", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: deadline,
    });

    if (!res.ok) {
      throw new Error(`Hotmart sales API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    items.push(...(data.items ?? []));
    pageToken = data.page_info?.next_page_token;
  } while (pageToken);

  if (items.length === 0) return 0;

  const rows = items.map((item) => mapHotmartSaleItem(item, accountId, args.collectedAt));

  // FK offer_code -> hotmart_offers: ofertas novas ainda não sincronizadas.
  await upsertPlaceholderOffers(supabase, rows, args.collectedAt, deadline);

  const { error } = await supabase
    .from("dash_gestao_hotmart_sales")
    .upsert(rows, { onConflict: "transaction_code" })
    .abortSignal(deadline);

  if (error) throw new Error(`Hotmart upsert error: ${error.message}`);
  return rows.length;
}

export interface BackfillTarget {
  id: string;
  account_id: string;
  product_id: string;
  view_start_date: string | null;
}

export interface BackfillOutcome {
  status: "done" | "partial" | "failed";
  backfillFrom: string | null;
  error?: string;
}

/**
 * Backfill de uma visualização. `offerCodes` = ofertas a buscar (todas na
 * criação; só as NOVAS ao adicionar oferta). Janelas de BACKFILL_CHUNK_DAYS do
 * dia mais recente para o mais antigo: se o orçamento estourar, o que já foi
 * gravado é a cauda recente contínua, e `backfill_from` é o começo dela.
 *
 *  - concluiu tudo        -> done,    backfill_from = início do período
 *  - orçamento estourou   -> partial, backfill_from = início da cauda coberta
 *                            (nenhuma janela coberta -> failed)
 *  - qualquer outro erro  -> failed
 * NUNCA devolve done quando estourou. Sempre grava o status final.
 */
export async function runBackfill(args: {
  supabase: Supabase;
  view: BackfillTarget;
  offerCodes: string[];
  now?: Date;
  budgetMs?: number;
  signal?: AbortSignal;
}): Promise<BackfillOutcome> {
  const { supabase, view, offerCodes } = args;
  const now = args.now ?? new Date();
  const todayMs = now.getTime();

  const startDay = view.view_start_date ?? toDay(todayMs - BACKFILL_DEFAULT_DAYS * DAY_MS);
  const startMs = dayStartMs(startDay);

  await writeStatus(supabase, view.id, { backfill_status: "running" });

  let outcome: BackfillOutcome;
  try {
    const timeout = AbortSignal.timeout(args.budgetMs ?? BACKFILL_BUDGET_MS);
    const deadline = args.signal ? AbortSignal.any([args.signal, timeout]) : timeout;
    const accessToken = await getHotmartAccessToken(supabase, view.account_id, deadline);
    const collectedAt = now.toISOString();
    const chunkMs = BACKFILL_CHUNK_DAYS * DAY_MS;

    let coveredFromMs: number | null = null;
    let windowEnd = todayMs;

    try {
      while (windowEnd > startMs) {
        const windowStart = Math.max(startMs, windowEnd - chunkMs);
        // Sequencial de propósito: não multiplicar a taxa de chamadas à Hotmart.
        for (const offerCode of offerCodes) {
          await fetchAndStoreProductSales({
            supabase,
            accountId: view.account_id,
            accessToken,
            productId: view.product_id,
            offerCode,
            startMs: windowStart,
            endMs: windowEnd,
            collectedAt,
            deadline,
          });
        }
        coveredFromMs = windowStart;
        windowEnd = windowStart - 1;
      }
      outcome = { status: "done", backfillFrom: startDay };
    } catch (err) {
      if (isAbortError(err) && coveredFromMs !== null) {
        outcome = { status: "partial", backfillFrom: toDay(coveredFromMs) };
      } else {
        throw err;
      }
    }
  } catch (err) {
    outcome = { status: "failed", backfillFrom: null, error: errorMessage(err) };
  }

  await writeStatus(supabase, view.id, {
    backfill_status: outcome.status,
    // failed não mexe em backfill_from: preserva a cobertura anterior, se houver.
    ...(outcome.status === "failed" ? {} : { backfill_from: outcome.backfillFrom }),
  });
  return outcome;
}

async function writeStatus(
  supabase: Supabase,
  viewId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from(VIEWS_TABLE).update(patch).eq("id", viewId);
  if (error) {
    console.error(`[vendas/views] falha ao gravar backfill da visualização ${viewId}: ${error.message}`);
  }
}
