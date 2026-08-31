import {
  syncHotmartProducts,
  upsertPlaceholderOffers,
  HOTMART_OFFERS_FETCH_CONCURRENCY,
} from "@/lib/services/hotmart";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account } from "@/types/accounts";

// Mock fetch globally
global.fetch = jest.fn();

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockAccount: Account = {
  id: "acc-123",
  platform: "hotmart",
  name: "Test Hotmart Account",
  credentials: { client_id: "cid", client_secret: "csecret" },
  is_active: true,
  created_at: new Date().toISOString(),
};

function makeTokenFetch() {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ access_token: "tok-abc" }),
    text: () => Promise.resolve(""),
  });
}

function makeProductsFetch(items: { id: number; name: string; ucode: string }[], nextPageToken?: string) {
  const body = {
    items,
    page_info: nextPageToken ? { next_page_token: nextPageToken } : {},
  };
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function makeOffersFetch(items: unknown[]) {
  const body = { items };
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function buildMockSupabase(existingProductIds: string[] = []) {
  const upsertMock = jest.fn().mockResolvedValue({ error: null });
  const inMock = jest.fn().mockResolvedValue({ error: null });
  const notMock = jest.fn().mockResolvedValue({
    data: existingProductIds.map((pid) => ({ product_id: pid })),
    error: null,
  });

  const selectChain = {
    eq: jest.fn().mockReturnThis(),
    not: notMock,
  };
  selectChain.eq.mockReturnValue(selectChain);

  const updateChain = {
    eq: jest.fn().mockReturnValue({ in: inMock }),
  };

  const updateMock = jest.fn().mockReturnValue(updateChain);

  const fromMock = jest.fn().mockImplementation((table: string) => {
    if (table === "dash_gestao_hotmart_products") {
      return {
        upsert: upsertMock,
        select: jest.fn().mockReturnValue(selectChain),
        update: updateMock,
      };
    }
    if (table === "dash_gestao_hotmart_offers") {
      return { upsert: upsertMock };
    }
    return {
      upsert: upsertMock,
      select: jest.fn().mockReturnValue(selectChain),
      update: updateMock,
    };
  });

  const mockSupabase = { from: fromMock };
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase);

  return { fromMock, upsertMock, updateMock, inMock, notMock };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("syncHotmartProducts()", () => {
  it("upserts new products and returns correct productsRecords count", async () => {
    const { upsertMock } = buildMockSupabase([]);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTokenFetch()) // OAuth token
      .mockResolvedValueOnce(
        makeProductsFetch([
          { id: 1, name: "Product A", ucode: "uc-1" },
          { id: 2, name: "Product B", ucode: "uc-2" },
        ])
      ) // products page
      .mockResolvedValueOnce(makeOffersFetch([])) // offers for product 1
      .mockResolvedValueOnce(makeOffersFetch([])); // offers for product 2

    const result = await syncHotmartProducts(mockAccount);

    expect(result.productsRecords).toBe(2);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ product_id: "1", product_name: "Product A" }),
        expect.objectContaining({ product_id: "2", product_name: "Product B" }),
      ]),
      expect.objectContaining({ onConflict: "product_id" })
    );
  });

  it("fetches offers for each product and returns correct offersRecords count", async () => {
    const { upsertMock } = buildMockSupabase([]);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTokenFetch()) // OAuth token
      .mockResolvedValueOnce(
        makeProductsFetch([
          { id: 10, name: "Prod X", ucode: "uc-10" },
          { id: 20, name: "Prod Y", ucode: "uc-20" },
        ])
      )
      .mockResolvedValueOnce(
        makeOffersFetch([
          { offer_code: "off-1", name: "Oferta 1", price: { value: 97, currency_code: "BRL" }, is_main_offer: true },
          { offer_code: "off-2", name: "Oferta 2", price: { value: 197, currency_code: "BRL" }, is_main_offer: false },
        ])
      ) // offers for product 10
      .mockResolvedValueOnce(
        makeOffersFetch([
          { offer_code: "off-3", name: "Oferta 3", price: { value: 297, currency_code: "BRL" }, is_main_offer: true },
        ])
      ); // offers for product 20

    const result = await syncHotmartProducts(mockAccount);

    expect(result.offersRecords).toBe(3);
    const offerUpsertCalls = upsertMock.mock.calls.filter(
      (call) => call[1] && call[1].onConflict === "offer_code"
    );
    expect(offerUpsertCalls.length).toBeGreaterThan(0);
  });

  it("marks products in DB but absent from API as is_active = false (soft delete)", async () => {
    // DB has product_ids "1", "2", "3" but API only returns products 1 and 2
    const { updateMock } = buildMockSupabase(["1", "2", "3"]);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTokenFetch())
      .mockResolvedValueOnce(
        makeProductsFetch([
          { id: 1, name: "Prod A", ucode: "uc-1" },
          { id: 2, name: "Prod B", ucode: "uc-2" },
        ])
      )
      .mockResolvedValueOnce(makeOffersFetch([]))
      .mockResolvedValueOnce(makeOffersFetch([]));

    await syncHotmartProducts(mockAccount);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
  });

  it("handles products with empty offers without error", async () => {
    buildMockSupabase([]);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTokenFetch())
      .mockResolvedValueOnce(makeProductsFetch([{ id: 5, name: "Solo Prod", ucode: "uc-5" }]))
      .mockResolvedValueOnce(makeOffersFetch([])); // empty offers

    const result = await syncHotmartProducts(mockAccount);

    expect(result.productsRecords).toBe(1);
    expect(result.offersRecords).toBe(0);
  });

  it("handles multi-page product responses via next_page_token pagination", async () => {
    buildMockSupabase([]);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeTokenFetch())
      .mockResolvedValueOnce(
        makeProductsFetch([{ id: 100, name: "Prod Page1", ucode: "uc-100" }], "token-page2")
      ) // page 1 with next token
      .mockResolvedValueOnce(
        makeProductsFetch([{ id: 101, name: "Prod Page2", ucode: "uc-101" }]) // page 2, no next token
      )
      .mockResolvedValueOnce(makeOffersFetch([])) // offers for 100
      .mockResolvedValueOnce(makeOffersFetch([])); // offers for 101

    const result = await syncHotmartProducts(mockAccount);

    expect(result.productsRecords).toBe(2);
    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    // Filter to only the products listing URL (not per-product offer URLs)
    const productListingCalls = fetchCalls.filter((call) =>
      /\/products(\?|$)/.test(String(call[0]))
    );
    // 2 pages of products fetched
    expect(productListingCalls.length).toBe(2);
  });

  // Conta real tem 439 produtos ativos; a Hotmart leva ~600ms por chamada de
  // ofertas. Sequencial (1 por vez) estoura os ~100s do proxy/edge em frente à
  // função (524 Gateway Timeout — nunca chega a rodar o try/catch da rota).
  // Concorrência limitada é o que mantém o wall time da sincronização dentro
  // do orçamento sem estourar rate limit da API.
  it("fetches offers with bounded concurrency instead of one at a time", async () => {
    buildMockSupabase([]);

    const PRODUCT_COUNT = 30;
    const products = Array.from({ length: PRODUCT_COUNT }, (_, i) => ({
      id: i + 1,
      name: `Prod ${i + 1}`,
      ucode: `uc-${i + 1}`,
    }));

    let inFlight = 0;
    let peakInFlight = 0;

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("oauth/token")) return makeTokenFetch();
      if (/\/products\?/.test(url)) return makeProductsFetch(products);
      if (/\/offers$/.test(url)) {
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight--;
            resolve({
              ok: true,
              json: () => Promise.resolve({ items: [] }),
              text: () => Promise.resolve(JSON.stringify({ items: [] })),
            });
          }, 5);
        });
      }
      throw new Error(`unexpected fetch url in test: ${url}`);
    });

    const result = await syncHotmartProducts(mockAccount);

    expect(result.productsRecords).toBe(PRODUCT_COUNT);
    // Prova que roda em paralelo (não 1 por vez)...
    expect(peakInFlight).toBeGreaterThan(1);
    // ...mas com um teto, não os 30 de uma vez (rate limit da Hotmart).
    expect(peakInFlight).toBeLessThanOrEqual(HOTMART_OFFERS_FETCH_CONCURRENCY);
  });
});

describe("upsertPlaceholderOffers()", () => {
  function buildOrderTrackingSupabase() {
    const callOrder: string[] = [];
    const upsertMock = jest.fn().mockImplementation((_rows, opts) => {
      callOrder.push(opts.onConflict);
      return Promise.resolve({ error: null });
    });
    const fromMock = jest.fn().mockImplementation(() => ({ upsert: upsertMock }));
    return { from: fromMock, upsertMock, callOrder } as unknown as ReturnType<
      typeof createSupabaseServiceClient
    > & { upsertMock: jest.Mock; callOrder: string[] };
  }

  // dash_gestao_hotmart_sales.product_id tem FK própria para
  // dash_gestao_hotmart_products (migration 038), independente de offer_code
  // ser nulo. Sem o placeholder de produto, um lote sem nenhum offer_code
  // (offerMap vazio) pularia direto pro upsert de vendas e quebraria a FK caso
  // o produto ainda não estivesse sincronizado.
  it("upserts a placeholder product even when no row has an offer_code", async () => {
    const supabase = buildOrderTrackingSupabase();

    await upsertPlaceholderOffers(
      supabase,
      [
        {
          account_id: "acc-1",
          product_id: "999",
          product_name: "Produto Novo",
          offer_code: null,
          offer_name: null,
        },
      ],
      "2026-08-24T00:00:00.000Z"
    );

    expect(supabase.upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          account_id: "acc-1",
          product_id: "999",
          product_name: "Produto Novo",
        }),
      ],
      expect.objectContaining({ onConflict: "product_id", ignoreDuplicates: true })
    );
  });

  it("upserts the placeholder product before the placeholder offer", async () => {
    const supabase = buildOrderTrackingSupabase();

    await upsertPlaceholderOffers(
      supabase,
      [
        {
          account_id: "acc-1",
          product_id: "999",
          product_name: "Produto Novo",
          offer_code: "off-novo",
          offer_name: "Oferta Nova",
        },
      ],
      "2026-08-24T00:00:00.000Z"
    );

    expect(supabase.callOrder).toEqual(["product_id", "offer_code"]);
  });

  it("does nothing when there are no rows", async () => {
    const supabase = buildOrderTrackingSupabase();

    await upsertPlaceholderOffers(supabase, [], "2026-08-24T00:00:00.000Z");

    expect(supabase.upsertMock).not.toHaveBeenCalled();
  });
});
