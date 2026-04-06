# Hotmart Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Hotmart sales data into the dashboard — daily cron collection, Supabase storage, and a new `/dashboard/hotmart` page with per-product tabs, date range filter, KPI cards, revenue chart, and sales table.

**Architecture:** One Hotmart account entry in `dash_gestao_accounts` holds `client_id` + `client_secret`. The daily cron fetches an OAuth token, paginates through the Hotmart sales history API, and upserts records into `dash_gestao_hotmart_sales`. The dashboard derives product tabs from distinct products already in the DB and filters sales client-side by the selected product and date range.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), TypeScript, Hotmart Payments API v1, OAuth 2.0 Client Credentials.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/types/accounts.ts` | Add `HotmartCredentials`, `HotmartSale` types; update `Account.platform` union |
| Create | `src/lib/services/hotmart.ts` | OAuth token fetch, paginated sales collection, upsert |
| Modify | `src/app/api/cron/collect/route.ts` | Add `hotmart` branch to platform loop |
| Create | `src/app/api/hotmart/sales/route.ts` | GET sales filtered by account, date range, product |
| Create | `src/app/api/hotmart/products/route.ts` | GET distinct products from stored sales |
| Modify | `src/components/settings/account-form.tsx` | Add Hotmart credential fields (client_id, client_secret) |
| Create | `src/app/dashboard/hotmart/page.tsx` | Dashboard page: tabs, date filter, KPIs, chart, table |
| Modify | `src/components/layout/nav-links.tsx` | Add Hotmart nav link |

---

## Task 1: Supabase — Create `dash_gestao_hotmart_sales` table

**Files:**
- No code file — run SQL directly in Supabase SQL Editor

- [ ] **Step 1: Open Supabase SQL Editor and run the migration**

Go to your Supabase project → SQL Editor → New query. Paste and run:

```sql
create table dash_gestao_hotmart_sales (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references dash_gestao_accounts(id) on delete cascade,
  transaction_code text not null,
  product_id text not null,
  product_name text not null,
  offer_code text,
  offer_name text,
  status text not null,
  price numeric not null,
  currency text not null default 'BRL',
  purchase_date timestamptz not null,
  approved_date timestamptz,
  buyer_email text not null,
  collected_at timestamptz not null default now(),
  constraint dash_gestao_hotmart_sales_transaction_unique unique (transaction_code)
);

create index on dash_gestao_hotmart_sales (account_id);
create index on dash_gestao_hotmart_sales (product_id);
create index on dash_gestao_hotmart_sales (status);
create index on dash_gestao_hotmart_sales (purchase_date);
```

- [ ] **Step 2: Verify the table was created**

In Supabase → Table Editor, confirm `dash_gestao_hotmart_sales` appears with the correct columns.

---

## Task 2: TypeScript types

**Files:**
- Modify: `src/types/accounts.ts`

- [ ] **Step 1: Add `HotmartCredentials` and `HotmartSale` interfaces, update `Account`**

Open `src/types/accounts.ts`. Add the following after the `InstagramCredentials` interface:

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
  offer_code: string | null;
  offer_name: string | null;
  status: string;
  price: number;
  currency: string;
  purchase_date: string;
  approved_date: string | null;
  buyer_email: string;
  collected_at: string;
}
```

- [ ] **Step 2: Update `Account.platform` union and `credentials` union**

Find the `Account` interface and update it:

```ts
export interface Account {
  id: string;
  platform: "youtube" | "instagram" | "hotmart";
  name: string;
  credentials: YouTubeCredentials | InstagramCredentials | HotmartCredentials;
  is_active: boolean;
  created_at: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/alberani/Documentos/IGT/DASH_GESTAO
npx tsc --noEmit
```

Expected: no errors related to `accounts.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/types/accounts.ts
git commit -m "feat(hotmart): add HotmartCredentials, HotmartSale types"
```

---

## Task 3: Hotmart service

**Files:**
- Create: `src/lib/services/hotmart.ts`

- [ ] **Step 1: Create the service file**

Create `src/lib/services/hotmart.ts` with the following content:

```ts
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, HotmartCredentials } from "@/types/accounts";

const HOTMART_TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";
const HOTMART_SALES_URL = "https://developers.hotmart.com/payments/api/v1/sales/history";

async function fetchHotmartToken(clientId: string, clientSecret: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(
    `${HOTMART_TOKEN_URL}?grant_type=client_credentials`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Hotmart OAuth error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

interface HotmartSaleItem {
  transaction: string;
  product: { id: string; name: string };
  offer?: { code?: string; payment_mode?: string };
  purchase: {
    status: string;
    price: { value: number; currency_value: string };
    transaction_date: number;
    approved_date?: number;
  };
  buyer: { email: string };
}

interface HotmartSalesResponse {
  items: HotmartSaleItem[];
  page_info?: {
    next_page_token?: string;
    total_results?: number;
  };
}

export async function collectHotmart(account: Account): Promise<{ salesRecords: number }> {
  const { client_id, client_secret } = account.credentials as HotmartCredentials;
  const supabase = createSupabaseServiceClient();
  const now = new Date();

  // Determine start date: most recent purchase_date or 90 days ago
  const { data: latest } = await supabase
    .from("dash_gestao_hotmart_sales")
    .select("purchase_date")
    .eq("account_id", account.id)
    .order("purchase_date", { ascending: false })
    .limit(1)
    .single();

  const startDate = latest?.purchase_date
    ? new Date(latest.purchase_date)
    : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const startMs = startDate.getTime();
  const endMs = now.getTime();

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
    transaction_code: item.transaction,
    product_id: item.product.id,
    product_name: item.product.name,
    offer_code: item.offer?.code ?? null,
    offer_name: item.offer?.payment_mode ?? null,
    status: item.purchase.status,
    price: item.purchase.price.value,
    currency: item.purchase.price.currency_value,
    purchase_date: new Date(item.purchase.transaction_date).toISOString(),
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/hotmart.ts
git commit -m "feat(hotmart): add Hotmart collection service with OAuth and pagination"
```

---

## Task 4: Cron integration

**Files:**
- Modify: `src/app/api/cron/collect/route.ts`

- [ ] **Step 1: Import `collectHotmart` and add hotmart branch**

Open `src/app/api/cron/collect/route.ts`.

Add the import at the top alongside the existing service imports:

```ts
import { collectHotmart } from "@/lib/services/hotmart";
```

Find the platform dispatch block inside the `for` loop:

```ts
if (account.platform === "youtube") {
  const result = await collectYouTube(account);
  records = result.channelRecords + result.videoRecords;
} else if (account.platform === "instagram") {
  const result = await collectInstagram(account);
  records = result.profileRecords + result.mediaRecords;
}
```

Replace it with:

```ts
if (account.platform === "youtube") {
  const result = await collectYouTube(account);
  records = result.channelRecords + result.videoRecords;
} else if (account.platform === "instagram") {
  const result = await collectInstagram(account);
  records = result.profileRecords + result.mediaRecords;
} else if (account.platform === "hotmart") {
  const result = await collectHotmart(account);
  records = result.salesRecords;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/collect/route.ts
git commit -m "feat(hotmart): add hotmart to cron collect route"
```

---

## Task 5: API routes

**Files:**
- Create: `src/app/api/hotmart/sales/route.ts`
- Create: `src/app/api/hotmart/products/route.ts`

- [ ] **Step 1: Create `src/app/api/hotmart/sales/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const params = request.nextUrl.searchParams;
  const accountId = params.get("account_id");
  const startDate = params.get("start_date");
  const endDate = params.get("end_date");
  const productId = params.get("product_id");

  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("dash_gestao_hotmart_sales")
    .select("*")
    .eq("account_id", accountId)
    .order("purchase_date", { ascending: false });

  if (startDate) query = query.gte("purchase_date", startDate);
  if (endDate) query = query.lte("purchase_date", endDate);
  if (productId) query = query.eq("product_id", productId);

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create `src/app/api/hotmart/products/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data, error: dbError } = await supabase
    .from("dash_gestao_hotmart_sales")
    .select("product_id, product_name")
    .eq("account_id", accountId);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate and sort
  const seen = new Set<string>();
  const products: { product_id: string; product_name: string }[] = [];
  for (const row of data ?? []) {
    if (!seen.has(row.product_id)) {
      seen.add(row.product_id);
      products.push({ product_id: row.product_id, product_name: row.product_name });
    }
  }
  products.sort((a, b) => a.product_name.localeCompare(b.product_name, "pt-BR"));

  return NextResponse.json(products);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify routes respond (requires dev server running)**

```bash
# In a separate terminal: npm run dev
# Then in another terminal (replace ACCOUNT_ID with a real hotmart account id):
curl "http://localhost:3000/api/hotmart/products?account_id=ACCOUNT_ID" \
  -H "Cookie: <your session cookie>"
```

Expected: `[]` if no data yet, or a JSON array of products.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/hotmart/
git commit -m "feat(hotmart): add /api/hotmart/sales and /api/hotmart/products routes"
```

---

## Task 6: Account form — add Hotmart fields

**Files:**
- Modify: `src/components/settings/account-form.tsx`

- [ ] **Step 1: Add `hotmart` state variables**

Open `src/components/settings/account-form.tsx`.

After the `const [userId, setUserId]` state declaration (line ~36), add:

```ts
const [clientId, setClientId] = useState(
  isEditing && account.platform === "hotmart"
    ? (account.credentials as { client_id: string }).client_id
    : ""
);
const [clientSecret, setClientSecret] = useState(
  isEditing && account.platform === "hotmart"
    ? (account.credentials as { client_secret: string }).client_secret
    : ""
);
```

- [ ] **Step 2: Update `platform` state type and select options**

Find this line (around line 15):

```ts
const [platform, setPlatform] = useState<"youtube" | "instagram">(
  account?.platform ?? "youtube"
);
```

Replace with:

```ts
const [platform, setPlatform] = useState<"youtube" | "instagram" | "hotmart">(
  account?.platform ?? "youtube"
);
```

Find the `<select>` element and add the Hotmart option:

```tsx
<select
  value={platform}
  onChange={(e) =>
    setPlatform(e.target.value as "youtube" | "instagram" | "hotmart")
  }
  disabled={isEditing}
  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
>
  <option value="youtube">YouTube</option>
  <option value="instagram">Instagram</option>
  <option value="hotmart">Hotmart</option>
</select>
```

- [ ] **Step 3: Update credentials assembly in `handleSubmit`**

Find the `credentials` constant in `handleSubmit` (around line 46):

```ts
const credentials =
  platform === "youtube"
    ? { api_key: apiKey, channel_id: channelId }
    : { access_token: accessToken, user_id: userId };
```

Replace with:

```ts
const credentials =
  platform === "youtube"
    ? { api_key: apiKey, channel_id: channelId }
    : platform === "instagram"
    ? { access_token: accessToken, user_id: userId }
    : { client_id: clientId, client_secret: clientSecret };
```

- [ ] **Step 4: Add Hotmart fields block after the Instagram block**

After the closing `)}` of the `{platform === "instagram" && (...)}` block, add:

```tsx
{platform === "hotmart" && (
  <>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Client ID
      </label>
      <input
        type="text"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        placeholder="Ex: a1b2c3d4-..."
        required
        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Client Secret
      </label>
      <input
        type="password"
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
        placeholder="••••••••"
        required
        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Verify manually**

Start the dev server (`npm run dev`), go to `/dashboard/settings`, click "Nova conta", select "Hotmart" from the platform dropdown. Confirm Client ID and Client Secret fields appear.

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/account-form.tsx
git commit -m "feat(hotmart): add Hotmart credential fields to account form"
```

---

## Task 7: Dashboard page

**Files:**
- Create: `src/app/dashboard/hotmart/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `src/app/dashboard/hotmart/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";
import type { Account, HotmartSale } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Vendas"];

const STATUS_APPROVED = ["COMPLETE"];
const STATUS_PENDING = ["WAITING_PAYMENT", "PRINTED_BILLET", "UNDER_ANALISYS"];
const STATUS_CANCELLED = ["REFUNDED", "CANCELLED", "CHARGEBACK", "BLOCKED", "EXPIRED"];

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  let style: React.CSSProperties;
  if (STATUS_APPROVED.includes(status)) {
    style = { background: "#DCFCE7", color: "#15803D", fontWeight: 600 };
  } else if (STATUS_PENDING.includes(status)) {
    style = { background: "#FEF3C7", color: "#B45309", fontWeight: 600 };
  } else {
    style = { background: "#FEE2E2", color: "#B91C1C", fontWeight: 600 };
  }
  const labels: Record<string, string> = {
    COMPLETE: "Aprovada",
    WAITING_PAYMENT: "Aguardando",
    PRINTED_BILLET: "Boleto emitido",
    UNDER_ANALISYS: "Em análise",
    REFUNDED: "Reembolsada",
    CANCELLED: "Cancelada",
    CHARGEBACK: "Chargeback",
    BLOCKED: "Bloqueada",
    EXPIRED: "Expirada",
  };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs" style={style}>
      {labels[status] ?? status}
    </span>
  );
}

const IconMoney = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconCart = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const IconTag = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

export default function HotmartPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [products, setProducts] = useState<{ product_id: string; product_name: string }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [appliedStart, setAppliedStart] = useState(daysAgo(30));
  const [appliedEnd, setAppliedEnd] = useState(today());
  const [sales, setSales] = useState<HotmartSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState("Visão Geral");

  // Load accounts
  useEffect(() => {
    fetch("/api/accounts?platform=hotmart")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccountId(accs[0].id);
      });
  }, []);

  // Load products when account changes
  useEffect(() => {
    if (!selectedAccountId) return;
    fetch(`/api/hotmart/products?account_id=${selectedAccountId}`)
      .then((r) => r.json())
      .then((prods: { product_id: string; product_name: string }[]) => {
        setProducts(prods);
        if (prods.length > 0) setSelectedProductId(prods[0].product_id);
        else setSelectedProductId("");
      });
  }, [selectedAccountId]);

  // Load sales when account, product, or date range changes
  useEffect(() => {
    if (!selectedAccountId) return;
    setLoading(true);
    const params = new URLSearchParams({
      account_id: selectedAccountId,
      start_date: new Date(appliedStart).toISOString(),
      end_date: new Date(appliedEnd + "T23:59:59").toISOString(),
    });
    if (selectedProductId) params.set("product_id", selectedProductId);

    fetch(`/api/hotmart/sales?${params}`)
      .then((r) => r.json())
      .then((data: HotmartSale[]) => setSales(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedAccountId, selectedProductId, appliedStart, appliedEnd]);

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  // KPI computations
  const approved = sales.filter((s) => STATUS_APPROVED.includes(s.status));
  const revenue = approved.reduce((sum, s) => sum + s.price, 0);
  const salesCount = approved.length;
  const ticketMedio = salesCount > 0 ? revenue / salesCount : 0;

  const pendingCount = sales.filter((s) => STATUS_PENDING.includes(s.status)).length;
  const cancelledCount = sales.filter((s) => STATUS_CANCELLED.includes(s.status)).length;

  // Chart data: group approved sales by day
  const revenueByDay: Record<string, number> = {};
  for (const s of approved) {
    const day = s.purchase_date.slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] ?? 0) + s.price;
  }
  const chartData = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));

  function exportCsv() {
    const headers = "Oferta,Status,Valor,Comprador,Data da compra,Data aprovação\n";
    const rows = sales
      .map((s) =>
        `"${s.offer_name ?? s.offer_code ?? "—"}","${s.status}",${s.price},"${s.buyer_email}","${s.purchase_date}","${s.approved_date ?? ""}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hotmart_vendas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--color-text-muted)" }}>
        <p className="text-lg mb-2">Nenhuma conta Hotmart cadastrada</p>
        <a href="/dashboard/settings" style={{ color: "var(--color-primary)" }} className="text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-8 pt-8 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--color-text)" }}>Hotmart</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Vendas e receita de produtos</p>
      </div>

      {/* Account tabs */}
      <div className="px-8 pt-4">
        <AccountTabs
          accounts={accounts}
          selectedId={selectedAccountId}
          onSelect={(id) => {
            setSelectedAccountId(id);
            setSelectedSection("Visão Geral");
          }}
        />
      </div>

      {/* Product tabs */}
      {products.length > 0 && (
        <div className="px-8 pt-2 flex gap-2 flex-wrap">
          {products.map((p) => (
            <button
              key={p.product_id}
              onClick={() => setSelectedProductId(p.product_id)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={
                selectedProductId === p.product_id
                  ? { background: "var(--color-primary)", color: "#fff" }
                  : { background: "var(--color-border)", color: "var(--color-text-muted)" }
              }
            >
              {p.product_name}
            </button>
          ))}
        </div>
      )}

      {/* Date range filter */}
      <div className="px-8 pt-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>De:</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Até:</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={applyDateFilter}
          className="px-4 py-1.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          Aplicar
        </button>
      </div>

      {/* Section tabs */}
      <div className="px-8 pt-4">
        <SectionTabs
          sections={SECTIONS}
          selected={selectedSection}
          onSelect={setSelectedSection}
        />
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* === VISÃO GERAL === */}
        {selectedSection === "Visão Geral" && (
          <>
            {loading ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard
                    title="Receita Total"
                    value={formatBRL(revenue)}
                    icon={IconMoney}
                    accentColor="#F97316"
                  />
                  <KpiCard
                    title="Vendas Aprovadas"
                    value={salesCount}
                    format="number"
                    icon={IconCart}
                    accentColor="#22C55E"
                  />
                  <KpiCard
                    title="Ticket Médio"
                    value={formatBRL(ticketMedio)}
                    icon={IconTag}
                    accentColor="#8B5CF6"
                  />
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Aprovadas", count: salesCount, color: "#15803D", bg: "#DCFCE7" },
                    { label: "Pendentes", count: pendingCount, color: "#B45309", bg: "#FEF3C7" },
                    { label: "Canceladas/Reemb.", count: cancelledCount, color: "#B91C1C", bg: "#FEE2E2" },
                    { label: "Total", count: sales.length, color: "var(--color-text)", bg: "var(--color-border)" },
                  ].map(({ label, count, color, bg }) => (
                    <div
                      key={label}
                      className="rounded-[10px] p-4"
                      style={{ background: bg, border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}
                    >
                      <p className="text-xs font-medium mb-1" style={{ color }}>{label}</p>
                      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{formatCompact(count)}</p>
                    </div>
                  ))}
                </div>

                {/* Revenue chart */}
                {chartData.length > 1 ? (
                  <LineChart
                    data={chartData}
                    xKey="date"
                    lines={[{ key: "revenue", color: "#F97316", label: "Receita (R$)" }]}
                    height={280}
                    title="Receita por dia"
                    subtitle="Vendas aprovadas no período selecionado"
                  />
                ) : (
                  <div
                    className="rounded-[10px] p-8 text-center text-sm"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", boxShadow: "var(--shadow-card)", background: "white" }}
                  >
                    Dados insuficientes para o gráfico. Amplie o período ou aguarde o cron coletar dados.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === VENDAS === */}
        {selectedSection === "Vendas" && (
          <>
            {loading ? (
              <SkeletonTable />
            ) : (
              <DataTable
                data={sales}
                columns={[
                  {
                    key: "offer_name",
                    label: "Oferta",
                    render: (v, row) => (
                      <span className="text-sm" style={{ color: "var(--color-text)" }}>
                        {(v as string) ?? (row.offer_code as string) ?? "—"}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (v) => <StatusBadge status={v as string} />,
                  },
                  {
                    key: "price",
                    label: "Valor",
                    render: (v) => (
                      <span className="text-sm tabular-nums font-medium">{formatBRL(v as number)}</span>
                    ),
                  },
                  {
                    key: "buyer_email",
                    label: "Comprador",
                    render: (v) => (
                      <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>{v as string}</span>
                    ),
                  },
                  {
                    key: "purchase_date",
                    label: "Data da compra",
                    render: (v) =>
                      v ? (
                        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                          {new Date(v as string).toLocaleDateString("pt-BR")}
                        </span>
                      ) : "—",
                  },
                  {
                    key: "approved_date",
                    label: "Data aprovação",
                    render: (v) =>
                      v ? (
                        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                          {new Date(v as string).toLocaleDateString("pt-BR")}
                        </span>
                      ) : <span style={{ color: "var(--color-text-muted)" }}>—</span>,
                  },
                ]}
                onExportCsv={exportCsv}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/hotmart/
git commit -m "feat(hotmart): add Hotmart dashboard page"
```

---

## Task 8: Navigation link

**Files:**
- Modify: `src/components/layout/nav-links.tsx`

- [ ] **Step 1: Add Hotmart link to the LINKS array**

Open `src/components/layout/nav-links.tsx`. Find the `LINKS` array and add the Hotmart entry between Instagram and Configurações:

```ts
{
  href: "/dashboard/hotmart",
  label: "Hotmart",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
},
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify manually**

Start the dev server (`npm run dev`) and confirm "Hotmart" appears in the sidebar between Instagram and Configurações. Clicking it should navigate to `/dashboard/hotmart`.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/nav-links.tsx
git commit -m "feat(hotmart): add Hotmart nav link to sidebar"
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Register a Hotmart account**

Go to `/dashboard/settings`, add a new account with platform = Hotmart, enter valid `client_id` and `client_secret` from the Hotmart developer portal.

- [ ] **Step 2: Trigger the cron manually**

```bash
curl -X POST http://localhost:3000/api/cron/collect \
  -H "x-cron-secret: <your CRON_SECRET from .env>"
```

Expected response: `{"results":[{"account_name":"...","platform":"hotmart","status":"success","records":N}]}`

- [ ] **Step 3: Verify data in Supabase**

In Supabase Table Editor → `dash_gestao_hotmart_sales`, confirm rows were inserted.

- [ ] **Step 4: Open the dashboard**

Navigate to `/dashboard/hotmart`. Confirm:
- Product tabs appear (one per distinct product)
- KPI cards show correct revenue, sales count, ticket médio
- Revenue chart renders
- Vendas section shows the data table with correct status badges
- CSV export works

- [ ] **Step 5: Final commit if any last fixes were needed**

```bash
git add -p
git commit -m "fix(hotmart): post-verification fixes"
```
