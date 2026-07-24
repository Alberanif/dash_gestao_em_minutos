import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: jest.fn().mockResolvedValue({ error: null, userId: "test-user", role: "gestor" }),
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

// ── Mutable test state (reset per test) ───────────────────────────────────────
let cycleRow: Record<string, unknown> | null;
let cycleSelectError: { code?: string; message?: string } | null;
let lockData: unknown[];
let lockError: { message: string } | null;
let releaseError: { message: string } | null;
let accountRow: Record<string, unknown> | null;
let upsertError: { message: string } | null;

// Captura os payloads passados para cycles.update (lock e finally).
let cycleUpdatePayloads: Array<Record<string, unknown>>;
// Ordem em que os upserts de offers/sales aconteceram (verifica o pré-upsert de FK).
let upsertOrder: string[];

const offersUpsert = jest.fn((...args: unknown[]) => {
  upsertOrder.push("offers");
  return Promise.resolve({ error: null, args });
});
const salesUpsert = jest.fn((...args: unknown[]) => {
  upsertOrder.push("sales");
  return Promise.resolve({ error: upsertError, args });
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ultimates/cycles/cycle-1/refresh", {
    method: "POST",
  });
}

function callRoute() {
  return import("../route").then(({ POST }) =>
    POST(makeRequest(), { params: Promise.resolve({ id: "cycle-1" }) })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  cycleRow = null;
  cycleSelectError = null;
  lockData = [];
  lockError = null;
  releaseError = null;
  accountRow = { id: "acc-1", credentials: { client_id: "cid", client_secret: "csecret" } };
  upsertError = null;
  cycleUpdatePayloads = [];
  upsertOrder = [];

  (global.fetch as jest.Mock) = jest.fn();

  mockFrom.mockImplementation((table: string) => {
    if (table === "dash_gestao_ultimates_cycles") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: cycleRow, error: cycleSelectError }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          cycleUpdatePayloads.push(payload);
          const afterFirstEq = {
            // Aquisição de lock: update().eq("id").or().select()
            or: () => ({
              select: () => Promise.resolve({ data: lockData, error: lockError }),
            }),
            // finally: update().eq("id").eq("refresh_started_at") aguardado direto
            eq: () => ({
              then: (resolve: (v: { error: { message: string } | null }) => void) =>
                resolve({ error: releaseError }),
            }),
          };
          return { eq: () => afterFirstEq };
        },
      };
    }
    if (table === "dash_gestao_accounts") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: accountRow, error: null }),
          }),
        }),
      };
    }
    if (table === "dash_gestao_hotmart_offers") {
      return { upsert: offersUpsert };
    }
    if (table === "dash_gestao_hotmart_sales") {
      return { upsert: salesUpsert };
    }
    return {};
  });
});

function activeCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: "cycle-1",
    account_id: "acc-1",
    product_id: "prod-99",
    status: "ativo",
    created_at: "2026-01-01T00:00:00.000Z",
    last_refresh_at: null,
    ...overrides,
  };
}

function mockTokenAndSales(items: unknown[]) {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "tok-abc" }),
      text: () => Promise.resolve(""),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items, page_info: {} }),
      text: () => Promise.resolve(""),
    });
}

function saleItem(offer?: { code: string; name?: string }) {
  return {
    product: { id: 99, name: "Produto Ultimate" },
    buyer: { email: "buyer@example.com" },
    purchase: {
      transaction: "HP-TX-1",
      order_date: 1735689600000,
      status: "APPROVED",
      price: { value: 497, currency_code: "BRL" },
      hotmart_fee: { base: 497, total: 50, fixed: 1 },
      ...(offer ? { offer } : {}),
    },
  };
}

describe("POST /api/ultimates/cycles/[id]/refresh", () => {
  it("returns 404 when cycle does not exist", async () => {
    cycleRow = null;
    cycleSelectError = { code: "PGRST116" };

    const res = await callRoute();
    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 409 when cycle is encerrado", async () => {
    cycleRow = activeCycle({ status: "encerrado" });

    const res = await callRoute();
    expect(res.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 429 with retryAfterSeconds when last_refresh_at is within throttle window", async () => {
    cycleRow = activeCycle({ last_refresh_at: new Date(Date.now() - 10_000).toISOString() });

    const res = await callRoute();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 409 without calling Hotmart when lock is lost (empty update result)", async () => {
    cycleRow = activeCycle();
    lockData = []; // perdedor da corrida

    const res = await callRoute();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("refresh em andamento");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("winner fetches product-scoped sales, upserts, returns 200 and clears lock", async () => {
    cycleRow = activeCycle();
    lockData = [activeCycle()]; // vencedor
    mockTokenAndSales([saleItem()]);

    const res = await callRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upserted).toBe(1);
    expect(body.lastRefreshAt).toEqual(expect.any(String));

    // Hotmart foi chamada (token + sales)
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
    // A URL de sales carrega o product_id do ciclo
    const salesUrl = String((global.fetch as jest.Mock).mock.calls[1][0]);
    expect(salesUrl).toContain("product_id=prod-99");

    // Upsert com onConflict: transaction_code
    expect(salesUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ transaction_code: "HP-TX-1" })]),
      expect.objectContaining({ onConflict: "transaction_code" })
    );

    // finally limpou o lock e gravou last_refresh_at
    const clearing = cycleUpdatePayloads.find((p) => p.refresh_started_at === null);
    expect(clearing).toBeDefined();
    expect(clearing?.last_refresh_at).toEqual(expect.any(String));
  });

  it("pre-upserts placeholder offers before the sales upsert when a sale has an offer_code", async () => {
    cycleRow = activeCycle();
    lockData = [activeCycle()];
    mockTokenAndSales([saleItem({ code: "OFF-NEW", name: "Oferta Nova" })]);

    const res = await callRoute();
    expect(res.status).toBe(200);

    // offers upsert aconteceu ANTES do sales upsert (evita violação de FK)
    expect(upsertOrder).toEqual(["offers", "sales"]);

    expect(offersUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ offer_code: "OFF-NEW", product_id: "99" }),
      ]),
      expect.objectContaining({ onConflict: "offer_code", ignoreDuplicates: true })
    );
  });

  it("skips offers upsert when no sale has an offer_code", async () => {
    cycleRow = activeCycle();
    lockData = [activeCycle()];
    mockTokenAndSales([saleItem()]);

    const res = await callRoute();
    expect(res.status).toBe(200);
    expect(offersUpsert).not.toHaveBeenCalled();
    expect(upsertOrder).toEqual(["sales"]);
  });

  it("clears the lock even when Hotmart fetch fails (502)", async () => {
    cycleRow = activeCycle();
    lockData = [activeCycle()];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve("boom"),
    });

    const res = await callRoute();
    expect(res.status).toBe(502);

    const clearing = cycleUpdatePayloads.find((p) => p.refresh_started_at === null);
    expect(clearing).toBeDefined();
  });

  it("passes an abort signal to every Hotmart fetch (bounds the call)", async () => {
    cycleRow = activeCycle();
    lockData = [activeCycle()];
    mockTokenAndSales([saleItem()]);

    await callRoute();

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls.length).toBe(2); // token + sales
    for (const [, options] of calls) {
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("returns 502 and clears the lock when a Hotmart fetch aborts (timeout)", async () => {
    cycleRow = activeCycle();
    lockData = [activeCycle()];
    // Sem timeout, este fetch pendurado travaria o handler e vazaria o lock — a
    // causa raiz do 409 "refresh em andamento". Agora vira 502 e libera o lock.
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" })
    );

    const res = await callRoute();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("não respondeu");

    const clearing = cycleUpdatePayloads.find((p) => p.refresh_started_at === null);
    expect(clearing).toBeDefined();
  });
});
