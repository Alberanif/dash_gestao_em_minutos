import type { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { VendasViewProduct } from "@/types/vendas";

// Produtos de uma Visualização (PRD #213, fatia 2/6): leitura via tabela filha
// dash_gestao_vendas_view_products e checagens que dependem do banco (produto
// existe, mesma conta). As colunas legadas product_id/offer_codes de
// dash_gestao_vendas_views NÃO são lidas nem gravadas por nenhum código daqui.

type Supabase = ReturnType<typeof createSupabaseServiceClient>;

export const VIEW_PRODUCTS_TABLE = "dash_gestao_vendas_view_products";

/** Select (com embed da tabela filha) que devolve a view já com `products`. */
export const VIEW_WITH_PRODUCTS_SELECT =
  "*, products:dash_gestao_vendas_view_products(product_id, offer_codes, created_at)";

/**
 * Normaliza o embed: ordena os produtos por created_at (ordem estável de
 * inclusão) e tira o created_at, que não faz parte do contrato.
 */
export function withProducts<T extends object>(row: T): T & { products: VendasViewProduct[] } {
  const raw = (row as { products?: unknown }).products;
  const list = Array.isArray(raw)
    ? (raw as Array<VendasViewProduct & { created_at?: string }>)
    : [];
  const products = [...list]
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .map((p) => ({ product_id: p.product_id, offer_codes: p.offer_codes }));
  return { ...row, products };
}

export type AccountCheck =
  | { ok: true; accountId: string }
  | { ok: false; status: 400 | 500; error: string };

/**
 * Todos os produtos existem em hotmart_products e pertencem à MESMA conta
 * (decisão 3 do PRD). `expectedAccountId` (edição) exige ainda que seja a conta
 * da visualização.
 */
export async function resolveProductsAccount(
  supabase: Supabase,
  products: VendasViewProduct[],
  expectedAccountId?: string
): Promise<AccountCheck> {
  const ids = products.map((p) => p.product_id);
  const { data, error } = await supabase
    .from("dash_gestao_hotmart_products")
    .select("product_id, account_id")
    .in("product_id", ids);

  if (error) return { ok: false, status: 500, error: error.message };

  const found = (data ?? []) as Array<{ product_id: string; account_id: string }>;
  const missing = ids.filter((id) => !found.some((f) => f.product_id === id));
  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `Produto não encontrado: ${missing.join(", ")}. Rode o sync de produtos em /api/hotmart/sync-products e tente novamente.`,
    };
  }

  const accounts = new Set(found.map((f) => f.account_id));
  if (accounts.size > 1) {
    return {
      ok: false,
      status: 400,
      error: "Todos os produtos de uma visualização devem ser da mesma conta Hotmart",
    };
  }
  const accountId = found[0].account_id;
  if (expectedAccountId !== undefined && accountId !== expectedAccountId) {
    return {
      ok: false,
      status: 400,
      error: "Os produtos devem ser da mesma conta Hotmart da visualização",
    };
  }
  return { ok: true, accountId };
}

/**
 * O que o backfill precisa buscar depois de uma edição: produto novo => todas as
 * ofertas; produto existente => só as ofertas novas. Remoção não gera trabalho.
 */
export function newBackfillTargets(
  before: VendasViewProduct[],
  after: VendasViewProduct[]
): Array<{ productId: string; offerCodes: string[] }> {
  const targets: Array<{ productId: string; offerCodes: string[] }> = [];
  for (const product of after) {
    const previous = before.find((p) => p.product_id === product.product_id);
    const offerCodes = previous
      ? product.offer_codes.filter((code) => !previous.offer_codes.includes(code))
      : product.offer_codes;
    if (offerCodes.length > 0) targets.push({ productId: product.product_id, offerCodes });
  }
  return targets;
}
