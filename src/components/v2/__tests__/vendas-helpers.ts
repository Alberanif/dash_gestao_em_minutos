import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";
import type { ProdutoHotmart } from "../vendas/tipos";

export const PRODUCTS: ProdutoHotmart[] = [{ product_id: "p1", product_name: "Produto Um", account_id: "acc-1" }];

export function makeView(overrides: Partial<VendasViewRecord> = {}): VendasViewRecord {
  const productId = overrides.product_id ?? "p1";
  const offerCodes = overrides.offer_codes ?? ["OF-1", "OF-2"];
  return {
    id: "v1",
    name: "Visão 1",
    account_id: "acc-1",
    product_id: productId,
    offer_codes: offerCodes,
    // PRD #213: quem manda é `products`; sem ele, deriva do par legado dos testes antigos.
    products: [{ product_id: productId, offer_codes: offerCodes }],
    folder_id: null,
    view_start_date: null,
    view_end_date: null,
    refresh_started_at: null,
    last_refresh_at: null,
    backfill_status: "done",
    backfill_from: null,
    migrated_from_cycle_id: null,
    created_by: "u1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

export const PASTA = {
  id: "f1",
  name: "Lançamentos",
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as unknown as VendasFolderRecord;

export interface Mock {
  views: VendasViewRecord[];
  unmigrated?: { id: string; name: string }[];
  folders?: VendasFolderRecord[];
  viewsStatus?: number;
  kpis?: { sales: number; refunded: number };
  daily?: { day: string; sales: number }[];
  offers?: { product_id?: string; product_name?: string; offer_code: string; offer_name: string | null; sales: number; refunded: number }[];
  overrides?: Record<string, { status?: number; body: unknown }>;
}

export function instalaFetch(m: Mock) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const respond = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    const over = m.overrides?.[`${method} ${url}`];
    if (over) return respond(over.body, over.status ?? 200);
    if (url === "/api/vendas/views") {
      return m.viewsStatus && m.viewsStatus >= 400
        ? respond({ error: "x" }, m.viewsStatus)
        : respond({ views: m.views, unmigrated_cycles: m.unmigrated ?? [] });
    }
    if (url === "/api/vendas/folders") return respond({ folders: m.folders ?? [] });
    const path = url.split("?")[0];
    if (path === "/api/vendas/offer-options") {
      if (url.includes("product_id=p2")) return respond({ offers: [{ offer_code: "OF-9", offer_name: "Oferta Nove", sales_count: 1 }] });
      return respond({
        offers: [
          { offer_code: "OF-1", offer_name: "Oferta Um", sales_count: 10 },
          { offer_code: "OF-2", offer_name: "Oferta Dois", sales_count: 3 },
        ],
      });
    }
    if (/\/kpis$/.test(path)) return respond(m.kpis ?? { sales: 7, refunded: 2 });
    if (/\/daily$/.test(path)) return respond({ rows: m.daily ?? [{ day: "2026-08-01", sales: 3 }, { day: "2026-08-02", sales: 4 }] });
    if (/\/hourly$/.test(path)) return respond({ rows: [{ hour: "2026-08-01T10", sales: 7 }] });
    if (/\/offers$/.test(path))
      return respond({
        rows: m.offers ?? [
          { product_id: "p1", product_name: "Produto Um", offer_code: "OF-1", offer_name: "Oferta Um", sales: 7, refunded: 2 },
          { product_id: "p1", product_name: "Produto Um", offer_code: "OF-2", offer_name: null, sales: 0, refunded: 0 },
        ],
      });
    return respond({ error: "sem mock" }, 404);
  }) as unknown as typeof global.fetch;
  return calls;
}


/** O Radix Select e o Dialog usam APIs que o jsdom não implementa. */
export function polyfillsDoRadix() {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
}
