import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, HotmartCredentials } from "@/types/accounts";

const HOTMART_TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";
export const HOTMART_SALES_URL = "https://developers.hotmart.com/payments/api/v1/sales/history";
const HOTMART_PRODUCTS_URL = "https://developers.hotmart.com/products/api/v1/products";

export async function fetchHotmartToken(clientId: string, clientSecret: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(HOTMART_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`Hotmart OAuth error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export interface HotmartSaleItem {
  product: { id: number; name: string };
  buyer: { email: string; name?: string };
  purchase: {
    transaction: string;
    order_date: number;
    approved_date?: number;
    status: string;
    price: { value: number; currency_code: string };
    offer?: { code?: string; name?: string; payment_mode?: string };
    hotmart_fee?: {
      base: number;
      total: number;
      percentage?: number;
      fixed?: number;
      currency_code?: string;
    };
    tracking?: {
      source_sck?: string;
      source?: string;
      external_code?: string;
    };
  };
}

interface HotmartSalesResponse {
  items: HotmartSaleItem[];
  page_info?: {
    next_page_token?: string;
    total_results?: number;
  };
}

// Mapeia um item da API sales/history da Hotmart para uma linha de
// dash_gestao_hotmart_sales. Função pura (sem I/O) — extraída de collectHotmart
// para ser reutilizada pela busca escopada do Dash Ultimates ("Atualizar agora").
export function mapHotmartSaleItem(
  item: HotmartSaleItem,
  accountId: string,
  collectedAt: string
) {
  return {
    account_id: accountId,
    transaction_code: item.purchase.transaction,
    product_id: String(item.product.id),
    product_name: item.product.name,
    offer_code: item.purchase.offer?.code ?? null,
    offer_name: item.purchase.offer?.name ?? null,
    status: item.purchase.status,
    // hotmart_fee.base é o preço da oferta antes dos encargos da Hotmart.
    // hotmart_fee.total é apenas a taxa percentual da plataforma.
    // hotmart_fee.fixed é a taxa fixa (ex: R$ 0,99 por transação HotPay).
    // Preço da Oferta (painel Hotmart) = base - total - fixed.
    // price.value inclui juros do parcelamento ("Parcelado Hotmart"), inflando o valor.
    price: item.purchase.hotmart_fee
      ? Math.round((item.purchase.hotmart_fee.base - item.purchase.hotmart_fee.total - (item.purchase.hotmart_fee.fixed ?? 0)) * 100) / 100
      : item.purchase.price.value,
    currency: item.purchase.price.currency_code,
    purchase_date: new Date(item.purchase.order_date).toISOString(),
    approved_date: item.purchase.approved_date
      ? new Date(item.purchase.approved_date).toISOString()
      : null,
    buyer_email: item.buyer.email,
    tracking_source_sck: item.purchase.tracking?.source_sck ?? null,
    tracking_source: item.purchase.tracking?.source ?? null,
    tracking_external_code: item.purchase.tracking?.external_code ?? null,
    collected_at: collectedAt,
  };
}

// Garante que todos os offer_codes referenciados por um conjunto de linhas de
// venda existam em dash_gestao_hotmart_offers ANTES do upsert das vendas — a
// FK offer_code -> dash_gestao_hotmart_offers rejeitaria vendas com ofertas
// ainda não sincronizadas (ex.: oferta nova criada entre dois syncs). Idempotente
// (ignoreDuplicates preserva ofertas já sincronizadas com preço/nome reais).
// Compartilhada por collectHotmart e pela busca escopada "Atualizar agora" (#120).
export async function upsertPlaceholderOffers(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  rows: Array<{
    account_id: string;
    product_id: string;
    offer_code: string | null;
    offer_name: string | null;
  }>,
  updatedAt: string
): Promise<void> {
  const offerMap = new Map<
    string,
    { account_id: string; product_id: string; offer_name: string }
  >();
  for (const row of rows) {
    const code = row.offer_code;
    if (code && !offerMap.has(code)) {
      offerMap.set(code, {
        account_id: row.account_id,
        product_id: row.product_id,
        offer_name: row.offer_name ?? code,
      });
    }
  }

  if (offerMap.size === 0) return;

  const placeholderOffers = Array.from(offerMap.entries()).map(([code, meta]) => ({
    account_id: meta.account_id,
    product_id: meta.product_id,
    offer_code: code,
    offer_name: meta.offer_name,
    price: null,
    currency: null,
    is_main_offer: false,
    updated_at: updatedAt,
  }));

  const { error: offersErr } = await supabase
    .from("dash_gestao_hotmart_offers")
    .upsert(placeholderOffers, { onConflict: "offer_code", ignoreDuplicates: true });

  if (offersErr) throw new Error(`Hotmart offers pre-upsert error: ${offersErr.message}`);
}

export async function collectHotmart(
  account: Account,
  { startDate, endDate }: { startDate: Date; endDate: Date }
): Promise<{ salesRecords: number }> {
  const { client_id, client_secret } = account.credentials as HotmartCredentials;
  const supabase = createSupabaseServiceClient();
  const now = new Date();

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  const accessToken = await fetchHotmartToken(client_id, client_secret);

  // Paginate through all sales
  const allItems: HotmartSaleItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(HOTMART_SALES_URL);
    url.searchParams.set("start_date", String(startMs));
    url.searchParams.set("end_date", String(endMs));
    url.searchParams.set("max_results", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Hotmart sales API error: ${res.status} ${await res.text()}`);
    }

    const data: HotmartSalesResponse = await res.json();
    allItems.push(...(data.items ?? []));
    pageToken = data.page_info?.next_page_token;
  } while (pageToken);

  if (allItems.length === 0) {
    return { salesRecords: 0 };
  }

  // Map to DB rows
  const collectedAt = now.toISOString();
  const rows = allItems.map((item) => mapHotmartSaleItem(item, account.id, collectedAt));

  // Garantir que todos os offer_codes referenciados existam em hotmart_offers
  // antes do upsert de vendas (evita violação de FK com ofertas históricas).
  await upsertPlaceholderOffers(supabase, rows, collectedAt);

  const { error } = await supabase
    .from("dash_gestao_hotmart_sales")
    .upsert(rows, { onConflict: "transaction_code" });

  if (error) throw new Error(`Hotmart upsert error: ${error.message}`);

  return { salesRecords: rows.length };
}

// ── Products & Offers sync ───────────────────────────────────────────────────

interface HotmartProductApiItem {
  id: number;
  name: string;
  ucode: string; // UUID usado no endpoint de ofertas
}
interface HotmartProductsApiResponse {
  items: HotmartProductApiItem[];
  page_info?: { next_page_token?: string };
}
interface HotmartOfferApiItem {
  code: string;
  name: string;
  price?: { value: number; currency_code: string };
  is_main_offer?: boolean;
}
interface HotmartOffersApiResponse {
  items: HotmartOfferApiItem[];
}

export async function syncHotmartProducts(
  account: Account
): Promise<{ productsRecords: number; offersRecords: number }> {
  const { client_id, client_secret } = account.credentials as HotmartCredentials;
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const accessToken = await fetchHotmartToken(client_id, client_secret);

  // 1. Paginate through all products
  const allProducts: HotmartProductApiItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(HOTMART_PRODUCTS_URL);
    url.searchParams.set("max_results", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const resText = await res.text();

    if (!res.ok) {
      throw new Error(`Hotmart products API error: ${res.status} ${resText.slice(0, 500)}`);
    }

    let data: HotmartProductsApiResponse;
    try {
      data = JSON.parse(resText);
    } catch {
      throw new Error(`Hotmart products API retornou não-JSON. Status: ${res.status}. Corpo: ${resText.slice(0, 500)}`);
    }
    allProducts.push(...(data.items ?? []));
    pageToken = data.page_info?.next_page_token;
  } while (pageToken);

  // 2. Upsert products
  if (allProducts.length > 0) {
    const productRows = allProducts.map((item) => ({
      account_id: account.id,
      product_id: String(item.id),
      product_name: item.name,
      is_active: true,
      updated_at: now,
    }));

    const { error: productsError } = await supabase
      .from("dash_gestao_hotmart_products")
      .upsert(productRows, { onConflict: "product_id" });

    if (productsError) throw new Error(`Hotmart products upsert error: ${productsError.message}`);
  }

  // 3. Fetch and upsert offers for each product
  let totalOffersRecords = 0;

  for (const item of allProducts) {
    const offersUrl = `${HOTMART_PRODUCTS_URL}/${item.ucode}/offers`;
    const offersRes = await fetch(offersUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!offersRes.ok) {
      throw new Error(`Hotmart offers API error: ${offersRes.status} ${await offersRes.text()}`);
    }

    const offersData: HotmartOffersApiResponse = await offersRes.json();
    const offerItems = offersData.items ?? [];

    if (offerItems.length > 0) {
      const offerRows = offerItems.map((offer) => ({
        account_id: account.id,
        product_id: String(item.id),
        offer_code: offer.code,
        offer_name: offer.name,
        price: offer.price?.value ?? null,
        currency: offer.price?.currency_code ?? null,
        is_main_offer: offer.is_main_offer ?? false,
        updated_at: now,
      }));

      const { error: offersError } = await supabase
        .from("dash_gestao_hotmart_offers")
        .upsert(offerRows, { onConflict: "offer_code" });

      if (offersError) throw new Error(`Hotmart offers upsert error: ${offersError.message}`);

      totalOffersRecords += offerRows.length;
    }
  }

  // 4. Soft-delete products present in DB but absent from the API response
  const apiProductIds = allProducts.map((item) => String(item.id));

  if (apiProductIds.length > 0) {
    const { data: existingRows, error: selectError } = await supabase
      .from("dash_gestao_hotmart_products")
      .select("product_id")
      .eq("account_id", account.id)
      .not("product_id", "in", `(${apiProductIds.join(",")})`);

    if (selectError) throw new Error(`Hotmart soft-delete select error: ${selectError.message}`);

    if (existingRows && existingRows.length > 0) {
      const removedIds = existingRows.map((r: { product_id: string }) => r.product_id);

      const { error: deactivateError } = await supabase
        .from("dash_gestao_hotmart_products")
        .update({ is_active: false, updated_at: now })
        .eq("account_id", account.id)
        .in("product_id", removedIds);

      if (deactivateError) throw new Error(`Hotmart soft-delete error: ${deactivateError.message}`);
    }
  }

  return { productsRecords: allProducts.length, offersRecords: totalOffersRecords };
}
