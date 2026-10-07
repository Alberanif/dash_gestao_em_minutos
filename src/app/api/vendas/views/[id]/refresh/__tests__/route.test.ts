import { NextRequest } from "next/server";
import { createFakeSupabase, filterOf, type FakeCall } from "@/lib/vendas/__tests__/fake-supabase";

let role: "gestor" | "analista";
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: jest.fn(async (allowed: string[]) =>
    allowed.includes(role)
      ? { error: null, userId: "user-1", role }
      : { error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }), userId: null, role }
  ),
}));

let fake: ReturnType<typeof createFakeSupabase>;
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => fake.client,
}));

let viewRow: Record<string, unknown> | null;
let lockCount: number;
let upsertError: { message: string } | null;

const VIEW = {
  id: "view-1", account_id: "acc-1", product_id: "prod-99", view_start_date: null,
  last_refresh_at: null, name: "V", offer_codes: ["A", "B"],
  backfill_status: "done", updated_at: "2020-01-01T00:00:00.000Z",
};

beforeEach(() => {
  jest.resetModules();
  role = "analista"; // refresh é de gestor E analista
  viewRow = VIEW;
  lockCount = 1;
  upsertError = null;
  fake = createFakeSupabase((c: FakeCall) => {
    if (c.table === "dash_gestao_vendas_views") {
      if (c.op === "select" && c.single === "single") return { data: viewRow };
      if (c.op === "select") return { data: viewRow }; // leitura final (maybeSingle)
      if (c.op === "update" && filterOf(c, "or")) return { count: lockCount };
    }
    if (c.table === "dash_gestao_accounts") return { data: { id: "acc-1", credentials: { client_id: "a", client_secret: "b" } } };
    if (c.table === "dash_gestao_hotmart_sales" && c.op === "upsert") return { error: upsertError };
    return {};
  });
  global.fetch = jest.fn();
});

const saleItem = {
  product: { id: 99, name: "P" },
  buyer: { email: "b@x.com" },
  purchase: {
    transaction: "HP-1", order_date: 1735689600000, status: "APPROVED",
    price: { value: 497, currency_code: "BRL" }, offer: { code: "A", name: "Oferta A" },
  },
};
function mockHotmart(items: unknown[] = [saleItem]) {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }), text: async () => "" })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items, page_info: {} }), text: async () => "" });
}

const call = async () =>
  (await import("../route")).POST(
    new NextRequest("http://localhost/api/vendas/views/view-1/refresh", { method: "POST" }),
    { params: Promise.resolve({ id: "view-1" }) }
  );
const viewUpdates = () => fake.calls.filter((c) => c.op === "update" && c.table === "dash_gestao_vendas_views");

describe("POST /views/[id]/refresh", () => {
  it("gestor e analista podem; 404 para view inexistente", async () => {
    viewRow = null;
    expect((await call()).status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("429 com retryAfterSeconds dentro do throttle, sem lock nem Hotmart", async () => {
    viewRow = { ...VIEW, last_refresh_at: new Date(Date.now() - 10_000).toISOString() };
    const res = await call();
    expect(res.status).toBe(429);
    expect((await res.json()).retryAfterSeconds).toBeGreaterThan(0);
    expect(viewUpdates()).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("409 quando perde o lock, sem chamar a Hotmart e sem release", async () => {
    lockCount = 0;
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("refresh em andamento");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(viewUpdates()).toHaveLength(1); // só a tentativa de lock
  });

  it("o lock pede { count: 'exact' } e nunca .select() (RETURNING reavaliaria o filtro)", async () => {
    mockHotmart();
    await call();
    const lock = viewUpdates()[0];
    expect(lock.options).toEqual({ count: "exact" });
    expect(lock.filters.some(([n]) => n === "select")).toBe(false);
  });

  it("sucesso: busca só o produto, grava em hotmart_sales, devolve view e libera o lock", async () => {
    mockHotmart();
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upserted).toBe(1);
    expect(body.lastRefreshAt).toEqual(expect.any(String));
    expect(body.view).toMatchObject({ id: "view-1", refresh_started_at: null, last_refresh_at: body.lastRefreshAt });

    const salesUrl = String((global.fetch as jest.Mock).mock.calls[1][0]);
    expect(salesUrl).toContain("product_id=prod-99");

    const upsert = fake.calls.find((c) => c.table === "dash_gestao_hotmart_sales")!;
    expect(upsert.options).toEqual({ onConflict: "transaction_code" });
    expect(upsert.payload).toEqual([expect.objectContaining({ transaction_code: "HP-1" })]);

    const release = viewUpdates().at(-1)!;
    expect(release.payload).toMatchObject({ refresh_started_at: null });
    expect(filterOf(release, "eq")).toEqual(["id", "view-1"]);
    // release condicional: segundo eq() amarra ao NOSSO lock
    expect(release.filters.filter(([n]) => n === "eq")[1][1][0]).toBe("refresh_started_at");
  });

  it("NÃO materializa compradores (nenhuma RPC sync_buyers_from_sales, nenhuma tabela de buyers)", async () => {
    mockHotmart();
    await call();
    expect(fake.calls.filter((c) => c.op === "rpc")).toHaveLength(0);
    expect(fake.calls.some((c) => /buyers|cycle/.test(c.table ?? ""))).toBe(false);
  });

  it("respeita view_start_date mais recente que a janela padrão", async () => {
    const start = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    viewRow = { ...VIEW, view_start_date: start };
    mockHotmart([]);
    await call();
    const url = new URL(String((global.fetch as jest.Mock).mock.calls[1][0]));
    expect(Number(url.searchParams.get("start_date"))).toBe(Date.parse(`${start}T00:00:00.000Z`));
  });

  it("fetch pendurado (TimeoutError) => 502 e o lock é liberado", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }), text: async () => "" })
      .mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    const res = await call();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/demorou demais/);
    expect(viewUpdates().at(-1)!.payload).toMatchObject({ refresh_started_at: null });
  });

  it("todo fetch carrega um AbortSignal (sem isso o handler pendura)", async () => {
    mockHotmart();
    await call();
    for (const [, init] of (global.fetch as jest.Mock).mock.calls) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("erro de upsert => 502 e lock liberado", async () => {
    upsertError = { message: "db down" };
    mockHotmart();
    const res = await call();
    expect(res.status).toBe(502);
    expect(viewUpdates().at(-1)!.payload).toMatchObject({ refresh_started_at: null });
  });

  describe("recuperação de backfill", () => {
    const salesCalls = () => (global.fetch as jest.Mock).mock.calls.slice(1);
    const backfillStatusWrites = () =>
      viewUpdates().filter((c) => c.payload && "backfill_status" in (c.payload as object));

    it.each(["failed", "pending", "partial"])("%s => refaz o backfill completo (todas as ofertas, histórico todo)", async (st) => {
      viewRow = { ...VIEW, backfill_status: st, view_start_date: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10) };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }), text: async () => "" })
        .mockResolvedValue({ ok: true, json: async () => ({ items: [], page_info: {} }), text: async () => "" });
      const res = await call();
      expect(res.status).toBe(200);
      const offers = salesCalls().map(([u]) => new URL(String(u)).searchParams.get("offer_code"));
      expect(offers).toEqual(["A", "B"]); // allowlist inteira, não só a janela de 30 dias
      expect(backfillStatusWrites().map((c) => (c.payload as { backfill_status: string }).backfill_status)).toEqual(["running", "done"]);
      expect(viewUpdates().at(-1)!.payload).toMatchObject({ refresh_started_at: null });
    });

    it("running órfão (updated_at antigo) é recuperado", async () => {
      viewRow = { ...VIEW, backfill_status: "running", updated_at: new Date(Date.now() - 10 * 60_000).toISOString() };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }), text: async () => "" })
        .mockResolvedValue({ ok: true, json: async () => ({ items: [], page_info: {} }), text: async () => "" });
      expect((await call()).status).toBe(200);
      expect(backfillStatusWrites().length).toBeGreaterThan(0);
    });

    it("running vivo => 409 sem lock nem Hotmart", async () => {
      viewRow = { ...VIEW, backfill_status: "running", updated_at: new Date(Date.now() - 5_000).toISOString() };
      expect((await call()).status).toBe(409);
      expect(viewUpdates()).toHaveLength(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("done continua no incremental (sem escrita de backfill_status)", async () => {
      mockHotmart();
      await call();
      expect(backfillStatusWrites()).toHaveLength(0);
    });

    it("backfill que falha => 502 e lock liberado", async () => {
      viewRow = { ...VIEW, backfill_status: "failed" };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok" }), text: async () => "" })
        .mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
      const res = await call();
      expect(res.status).toBe(502);
      expect(viewUpdates().at(-1)!.payload).toMatchObject({ refresh_started_at: null });
    });

    it("respeita o lock: 409 quando perde, sem backfill", async () => {
      viewRow = { ...VIEW, backfill_status: "failed" };
      lockCount = 0;
      expect((await call()).status).toBe(409);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
