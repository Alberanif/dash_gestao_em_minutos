import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, HotmartCredentials } from "@/types/accounts";

const HOTMART_TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";
const HOTMART_SALES_URL = "https://developers.hotmart.com/payments/api/v1/sales/history";

async function fetchHotmartToken(clientId: string, clientSecret: string): Promise<string> {
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

interface HotmartSaleItem {
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
  };
}

interface HotmartSalesResponse {
  items: HotmartSaleItem[];
  page_info?: {
    next_page_token?: string;
    total_results?: number;
  };
}

export async function collectHotmart(
  account: Account,
  options?: { startDate?: Date; endDate?: Date }
): Promise<{ salesRecords: number }> {
  const { client_id, client_secret } = account.credentials as HotmartCredentials;
  const supabase = createSupabaseServiceClient();
  const now = new Date();

  // Usa datas fornecidas ou, por padrão, 90 dias para capturar mudanças de status
  const startDate = options?.startDate ?? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const endDate   = options?.endDate   ?? now;

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
  const rows = allItems.map((item) => ({
    account_id: account.id,
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
    collected_at: now.toISOString(),
  }));

  const { error } = await supabase
    .from("dash_gestao_hotmart_sales")
    .upsert(rows, { onConflict: "transaction_code" });

  if (error) throw new Error(`Hotmart upsert error: ${error.message}`);

  return { salesRecords: rows.length };
}
