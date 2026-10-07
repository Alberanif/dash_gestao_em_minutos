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
let resolver: Parameters<typeof createFakeSupabase>[0];
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => fake.client,
}));

const NOW = new Date("2026-10-07T12:00:00Z");
const VIEW = {
  id: "view-1", name: "V", account_id: "acc-1", product_id: "p1", offer_codes: ["A", "B"],
  folder_id: null, view_start_date: null, view_end_date: null, refresh_started_at: null,
  last_refresh_at: null, backfill_status: "pending", backfill_from: null,
  migrated_from_cycle_id: null, created_by: "user-1", created_at: "x", updated_at: "x",
};

let salesFetchCount: number;
let failSalesFrom: number | null; // a partir da N-ésima busca de vendas, estoura o orçamento
let salesUrls: string[];

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ["nextTick", "setImmediate", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask"],
  });
  role = "gestor";
  salesFetchCount = 0;
  failSalesFrom = null;
  salesUrls = [];
  resolver = () => ({});
  fake = createFakeSupabase((c) => resolver(c));
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes("oauth/token")) {
      return { ok: true, json: async () => ({ access_token: "tok" }), text: async (): Promise<string> => "" };
    }
    salesFetchCount += 1;
    salesUrls.push(String(url));
    if (failSalesFrom !== null && salesFetchCount >= failSalesFrom) {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    }
    return { ok: true, json: async () => ({ items: [], page_info: {} }), text: async (): Promise<string> => "" };
  }) as unknown as typeof fetch;
});
afterEach(() => jest.useRealTimers());

function post(body: unknown) {
  return new NextRequest("http://localhost/api/vendas/views", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const call = async (req: NextRequest) => (await import("../route")).POST(req);
const statusWrites = () =>
  fake.calls.filter((c) => c.op === "update" && c.table === "dash_gestao_vendas_views");

function creationResolver(extra?: (c: FakeCall) => ReturnType<typeof resolver> | undefined) {
  return (c: FakeCall) => {
    const custom = extra?.(c);
    if (custom) return custom;
    if (c.table === "dash_gestao_hotmart_products") return { data: { product_id: "p1", account_id: "acc-1" } };
    if (c.table === "dash_gestao_accounts") return { data: { id: "acc-1", credentials: { client_id: "a", client_secret: "b" } } };
    if (c.table === "dash_gestao_vendas_views" && c.op === "insert") return { data: { ...VIEW, ...(c.payload as object) } };
    return {};
  };
}

const valid = { name: " Minha ", product_id: "p1", offer_codes: [" A ", "B"] };

describe("GET /api/vendas/views", () => {
  const get = async () => (await import("../route")).GET();

  it("gestor recebe as views e os ciclos ativos sem view", async () => {
    resolver = (c) => {
      if (c.table === "dash_gestao_vendas_views") return { data: [{ ...VIEW, migrated_from_cycle_id: "c1" }] };
      if (c.table === "dash_gestao_vendas_cycles") return { data: [{ id: "c1", name: "Migrado" }, { id: "c2", name: "Fora" }] };
      return {};
    };
    const body = await (await get()).json();
    expect(body.views).toHaveLength(1);
    expect(body.unmigrated_cycles).toEqual([{ id: "c2", name: "Fora" }]);
    const cycles = fake.calls.find((c) => c.table === "dash_gestao_vendas_cycles")!;
    expect(filterOf(cycles, "eq")).toEqual(["status", "ativo"]);
  });

  it("analista lê as views mas unmigrated_cycles vem [] (sem nem consultar ciclos)", async () => {
    role = "analista";
    resolver = (c) => (c.table === "dash_gestao_vendas_views" ? { data: [VIEW] } : {});
    const body = await (await get()).json();
    expect(body.views).toHaveLength(1);
    expect(body.unmigrated_cycles).toEqual([]);
    expect(fake.calls.some((c) => c.table === "dash_gestao_vendas_cycles")).toBe(false);
  });
});

describe("POST /api/vendas/views", () => {
  it("analista recebe 403 e nada é escrito", async () => {
    role = "analista";
    const res = await call(post(valid));
    expect(res.status).toBe(403);
    expect(fake.calls).toHaveLength(0);
  });

  it.each([
    ["sem oferta", { ...valid, offer_codes: [] }],
    ["oferta duplicada", { ...valid, offer_codes: ["A", " A"] }],
    ["oferta vazia", { ...valid, offer_codes: ["A", "  "] }],
    ["offer_codes ausente", { name: "x", product_id: "p1" }],
    ["sem nome", { ...valid, name: "  " }],
    ["sem produto", { ...valid, product_id: "" }],
    ["período só com início", { ...valid, view_start_date: "2026-01-01" }],
    ["período invertido", { ...valid, view_start_date: "2026-02-01", view_end_date: "2026-01-01" }],
  ])("%s => 400, sem insert", async (_n, body) => {
    resolver = creationResolver();
    const res = await call(post(body));
    expect(res.status).toBe(400);
    expect(fake.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("produto inexistente => 400", async () => {
    resolver = (c) => (c.table === "dash_gestao_hotmart_products" ? { data: null } : {});
    expect((await call(post(valid))).status).toBe(400);
  });

  it("cria com trim, account_id do produto, created_by e backfill de 90 dias => done", async () => {
    resolver = creationResolver();
    const res = await call(post(valid));
    expect(res.status).toBe(201);
    const { view } = await res.json();
    const insert = fake.calls.find((c) => c.op === "insert")!;
    expect(insert.payload).toMatchObject({
      name: "Minha", account_id: "acc-1", product_id: "p1", offer_codes: ["A", "B"], created_by: "user-1",
    });
    expect(view.backfill_status).toBe("done");
    expect(view.backfill_from).toBe("2026-07-09"); // hoje - 90d
    // 4 janelas (90,5 dias em passos de 30) x 2 ofertas, uma busca por oferta
    expect(salesFetchCount).toBe(8);
    expect(salesUrls.every((u) => u.includes("product_id=p1"))).toBe(true);
    expect(salesUrls.filter((u) => u.includes("offer_code=A"))).toHaveLength(4);
    expect(statusWrites().map((c) => (c.payload as { backfill_status: string }).backfill_status)).toEqual(["running", "done"]);
  });

  it("com período, o backfill começa em view_start_date", async () => {
    resolver = creationResolver();
    const res = await call(post({ ...valid, view_start_date: "2026-10-01", view_end_date: "2026-10-31" }));
    expect((await res.json()).view.backfill_from).toBe("2026-10-01");
    expect(salesFetchCount).toBe(2); // 1 janela x 2 ofertas
  });

  it("orçamento estourado no meio => partial com a data inicial da cauda coberta, nunca done", async () => {
    resolver = creationResolver();
    failSalesFrom = 5; // 1ª e 2ª janelas (A,B cada = 4 buscas) completas; 3ª estoura
    const res = await call(post(valid));
    expect(res.status).toBe(201);
    const { view } = await res.json();
    expect(view.backfill_status).toBe("partial");
    expect(view.backfill_from).toBe("2026-08-08");
    const finalWrite = statusWrites().at(-1)!.payload as Record<string, unknown>;
    expect(finalWrite).toEqual({ backfill_status: "partial", backfill_from: "2026-08-08" });
  });

  it("estouro sem nenhuma janela coberta => failed (não há cauda a declarar)", async () => {
    resolver = creationResolver();
    failSalesFrom = 1;
    const { view } = await (await call(post(valid))).json();
    expect(view.backfill_status).toBe("failed");
    expect(view.backfill_from).toBeNull();
  });

  it("falha da Hotmart => failed e a criação continua 201", async () => {
    resolver = creationResolver();
    (global.fetch as jest.Mock).mockImplementation(async (url: string) =>
      String(url).includes("oauth/token")
        ? { ok: true, json: async () => ({ access_token: "tok" }), text: async (): Promise<string> => "" }
        : { ok: false, status: 500, text: async () => "boom" }
    );
    const res = await call(post(valid));
    expect(res.status).toBe(201);
    expect((await res.json()).view.backfill_status).toBe("failed");
  });

  it("CHECK do banco violada => 400", async () => {
    resolver = creationResolver((c) =>
      c.op === "insert" ? { error: { message: "check", code: "23514" } } : undefined
    );
    expect((await call(post(valid))).status).toBe(400);
  });
});
