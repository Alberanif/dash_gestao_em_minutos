import { syncHotmartProducts } from "@/lib/services/hotmart";
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

function makeProductsFetch(items: { product: { id: number; name: string } }[], nextPageToken?: string) {
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        items,
        page_info: nextPageToken ? { next_page_token: nextPageToken } : {},
      }),
    text: () => Promise.resolve(""),
  });
}

function makeOffersFetch(items: unknown[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ items }),
    text: () => Promise.resolve(""),
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
          { product: { id: 1, name: "Product A" } },
          { product: { id: 2, name: "Product B" } },
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
          { product: { id: 10, name: "Prod X" } },
          { product: { id: 20, name: "Prod Y" } },
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
          { product: { id: 1, name: "Prod A" } },
          { product: { id: 2, name: "Prod B" } },
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
      .mockResolvedValueOnce(makeProductsFetch([{ product: { id: 5, name: "Solo Prod" } }]))
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
        makeProductsFetch([{ product: { id: 100, name: "Prod Page1" } }], "token-page2")
      ) // page 1 with next token
      .mockResolvedValueOnce(
        makeProductsFetch([{ product: { id: 101, name: "Prod Page2" } }]) // page 2, no next token
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
});
