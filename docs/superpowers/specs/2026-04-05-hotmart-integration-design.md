# Hotmart Integration — Design Spec

**Date:** 2026-04-05
**Status:** Approved

## Overview

Add a Hotmart dashboard screen to the existing multi-platform dashboard. The IGT is a producer of digital infoproducts sold on Hotmart. The integration collects sales data daily via cron, stores it in Supabase, and exposes it through a new `/dashboard/hotmart` page with per-product tabs and a custom date range filter.

---

## 1. Authentication — Hotmart API

Hotmart uses OAuth 2.0 Client Credentials flow.

**Token endpoint:**
```
POST https://api-sec-vlc.hotmart.com/security/oauth/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded
Body: grant_type=client_credentials
```

Returns `access_token` valid for ~1 hour. The `basic_token` is derived at runtime from `client_id` and `client_secret` — it is NOT stored in the database.

**Sales history endpoint:**
```
GET https://developers.hotmart.com/payments/api/v1/sales/history
Authorization: Bearer <access_token>
Params: start_date (ms epoch), end_date (ms epoch), page_token, max_results (max 500)
```

**Credentials stored in `dash_gestao_accounts`:**
```ts
interface HotmartCredentials {
  client_id: string;
  client_secret: string;
}
```

One account entry per Hotmart credential set. Multiple products are filtered within that single account.

---

## 2. Data Model

### New Supabase table: `dash_gestao_hotmart_sales`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Supabase default |
| `account_id` | `uuid` FK | References `dash_gestao_accounts.id` |
| `transaction_code` | `text` UNIQUE | Hotmart transaction identifier — used for upsert |
| `product_id` | `text` | Hotmart product ID |
| `product_name` | `text` | Hotmart product name |
| `offer_code` | `text` | Offer code (nullable) |
| `offer_name` | `text` | Offer name (nullable) |
| `status` | `text` | `COMPLETE`, `REFUNDED`, `CANCELLED`, `EXPIRED`, `UNDER_ANALISYS`, `WAITING_PAYMENT`, `PRINTED_BILLET`, `CHARGEBACK`, `BLOCKED` |
| `price` | `numeric` | Sale value in BRL |
| `currency` | `text` | e.g. `BRL` |
| `purchase_date` | `timestamptz` | When the purchase was made |
| `approved_date` | `timestamptz` | When approved (nullable) |
| `buyer_email` | `text` | Buyer e-mail |
| `collected_at` | `timestamptz` | When the cron collected this record |

**Indexes:** `account_id`, `product_id`, `status`, `purchase_date`

### Product tabs strategy

Products are NOT stored as separate accounts. They are derived at query time via `DISTINCT product_id, product_name` from `dash_gestao_hotmart_sales`. This avoids credential duplication and keeps the accounts table clean.

---

## 3. Data Collection Service

**File:** `src/lib/services/hotmart.ts`

**Logic:**
1. Fetch OAuth token using `client_id` and `client_secret` from the account credentials
2. Query Supabase for the most recent `purchase_date` for this `account_id`
   - If no records exist: use `now() - 90 days` as `start_date` (initial backfill)
   - If records exist: use the latest `purchase_date` as `start_date`
3. Set `end_date` to `now()`
4. Paginate through `sales/history` using `page_token` until exhausted (max 500 per page)
5. Upsert all collected sales into `dash_gestao_hotmart_sales` on `transaction_code` conflict
6. Return `{ salesRecords: number }`

**Returns:** `Promise<{ salesRecords: number }>`

### Cron integration (`/api/cron/collect`)

Add a branch to the existing platform loop:

```ts
} else if (account.platform === "hotmart") {
  const result = await collectHotmart(account);
  records = result.salesRecords;
}
```

No other changes to the cron infrastructure needed.

---

## 4. API Routes

### `GET /api/hotmart/sales`

**Query params:** `account_id` (required), `start_date` (ISO string), `end_date` (ISO string), `product_id` (optional)

**Returns:** Array of `HotmartSale` filtered by date range and optionally by product.

### `GET /api/hotmart/products`

**Query params:** `account_id` (required)

**Returns:** `Array<{ product_id: string; product_name: string }>` — distinct products from stored sales, sorted alphabetically.

---

## 5. TypeScript Types

Additions to `src/types/accounts.ts`:

```ts
export interface HotmartCredentials {
  client_id: string;
  client_secret: string;
}

export interface HotmartSale {
  id: string;
  account_id: string;
  transaction_code: string;
  product_id: string;
  product_name: string;
  offer_code: string;
  offer_name: string;
  status: string;
  price: number;
  currency: string;
  purchase_date: string;
  approved_date: string | null;
  buyer_email: string;
  collected_at: string;
}

// Update Account.platform union:
export interface Account {
  // ...
  platform: "youtube" | "instagram" | "hotmart";
  // ...
}
```

---

## 6. Dashboard Page (`/dashboard/hotmart`)

**File:** `src/app/dashboard/hotmart/page.tsx`

### Layout

```
[Header]  Hotmart  —  Vendas e receita de produtos

[Product tabs]  Produto A | Produto B | ...

[Date range filter]  De: [date input]  Até: [date input]  [Aplicar]
                     Default: start = 30 days ago, end = today

[Section tabs]  Visão Geral | Vendas
```

### Section: Visão Geral

**KPI Cards (3 columns):**

| Card | Value | Logic |
|---|---|---|
| Receita Total | R$ sum | Sum of `price` where `status = COMPLETE` |
| Nº de Vendas | count | Count where `status = COMPLETE` |
| Ticket Médio | R$ avg | Receita Total / Nº de Vendas |

**Line chart:** Revenue (COMPLETE sales) aggregated by day over the selected date range.

**Status breakdown:** Small summary cards showing count per status — Aprovadas, Aguardando pagamento, Reembolsadas, Canceladas, Outras.

### Section: Vendas

DataTable with columns:

| Column | Notes |
|---|---|
| Oferta | `offer_name` |
| Status | Badge — green=COMPLETE, yellow=WAITING_PAYMENT/PRINTED_BILLET/UNDER_ANALISYS, red=REFUNDED/CANCELLED/CHARGEBACK |
| Valor | `price` formatted as BRL currency |
| Comprador | `buyer_email` |
| Data da compra | `purchase_date` formatted pt-BR |
| Data aprovação | `approved_date` or `—` |

Export CSV button (same pattern as Instagram page).

### Navigation

Add Hotmart link to `src/components/layout/nav-links.tsx` between Instagram and Configurações.

---

## 7. Error Handling

- OAuth token fetch failure: throw with clear message, cron logs the error to `dash_gestao_cron_logs` (existing pattern)
- Hotmart API rate limit or 5xx: throw, cron logs error, retries on next daily run
- Empty sales response: upsert 0 records, return `{ salesRecords: 0 }` — not an error
- No account configured: dashboard shows "Nenhuma conta Hotmart cadastrada" with link to Configurações (same pattern as Instagram)

---

## 8. Settings / Account Registration

No new UI needed for account registration — the existing Settings page already handles adding accounts for any platform. The `credentials` field is stored as JSONB, so `HotmartCredentials` fits the existing pattern.

The account form (`src/components/settings/account-form.tsx`) needs to conditionally render two fields when `platform = hotmart`:
- **Client ID** — text input, maps to `credentials.client_id`
- **Client Secret** — password input (masked), maps to `credentials.client_secret`

These replace the existing platform-specific fields (YouTube shows `api_key` + `channel_id`, Instagram shows `access_token` + `user_id`).
