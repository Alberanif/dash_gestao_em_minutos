// Mock supabase before imports
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert });

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@/lib/utils/meta-ads-events", () => ({
  extractPurchases: jest.fn().mockReturnValue(0),
  extractCheckout: jest.fn().mockReturnValue(0),
}));

import type { Account } from "@/types/accounts";
import { collectMetaAdsCampaignsList } from "../meta-ads";

const testAccount: Account = {
  id: "acc-test-1",
  name: "Conta Teste",
  platform: "meta-ads",
  is_active: true,
  credentials: {
    access_token: "test_token_abc",
    ad_account_id: "act_123456789",
  },
} as unknown as Account;

const campaignData = { id: "c1", name: "Camp A", status: "ACTIVE", objective: "OUTCOME_LEADS" };

function makeFetchResponse(data: unknown[], nextUrl?: string): Response {
  const body = {
    data,
    paging: nextUrl ? { next: nextUrl } : undefined,
  };
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function make403Response(isTransient: boolean): Response {
  const body = JSON.stringify({ error: { is_transient: isTransient } });
  return {
    ok: false,
    status: 403,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("collectMetaAdsCampaignsList", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("Test 1: limit=500 included in first request URL", async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse([]));

    const p = collectMetaAdsCampaignsList(testAccount);
    await jest.runAllTimersAsync();
    await p;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const firstUrl: string = mockFetch.mock.calls[0][0];
    expect(firstUrl).toContain("limit=500");
  });

  it("Test 2: sleep(500ms) called between paginated requests", async () => {
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");
    mockFetch
      .mockResolvedValueOnce(makeFetchResponse([], "https://graph.facebook.com/page2"))
      .mockResolvedValueOnce(makeFetchResponse([campaignData]));

    const p = collectMetaAdsCampaignsList(testAccount);
    await jest.runAllTimersAsync();
    const result = await p;

    // setTimeout should have been called with 500 for the page delay
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
    expect(result.campaignsCollected).toBe(1);
  });

  it("Test 3: retry on transient 403 succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(makeFetchResponse([], "https://graph.facebook.com/page2"))
      .mockResolvedValueOnce(make403Response(true))
      .mockResolvedValueOnce(makeFetchResponse([campaignData]));

    const p = collectMetaAdsCampaignsList(testAccount);
    await jest.runAllTimersAsync();
    const result = await p;

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.campaignsCollected).toBe(1);
  });

  it("Test 4: non-transient 403 throws immediately without retry", async () => {
    mockFetch
      .mockResolvedValueOnce(makeFetchResponse([], "https://graph.facebook.com/page2"))
      .mockResolvedValueOnce(make403Response(false));

    // Attach .catch() early so rejection is never unhandled
    const p = collectMetaAdsCampaignsList(testAccount);
    const settled = p.catch((e: Error) => e);
    // Advance page-delay timer so the pagination fetch can happen
    await jest.runAllTimersAsync();
    const err = await settled;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Meta Ads API error (pagination)");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("Test 5: exhausts retries (1 initial + 3 retries) then throws", async () => {
    mockFetch
      .mockResolvedValueOnce(makeFetchResponse([], "https://graph.facebook.com/page2"))
      // 4 transient 403 responses: 1 initial attempt + 3 retries
      .mockResolvedValueOnce(make403Response(true))
      .mockResolvedValueOnce(make403Response(true))
      .mockResolvedValueOnce(make403Response(true))
      .mockResolvedValueOnce(make403Response(true));

    // Attach .catch() early so rejection is never unhandled during runAllTimersAsync
    const p = collectMetaAdsCampaignsList(testAccount);
    const settled = p.catch((e: Error) => e);
    // Advance all retry timers (30s, 60s, 120s) plus page delay (500ms)
    await jest.runAllTimersAsync();
    const err = await settled;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Meta Ads API error (pagination)");
    // 1 page-1 fetch + 4 attempts at page 2
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });
});
