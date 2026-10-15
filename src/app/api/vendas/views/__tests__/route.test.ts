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
  id: "view-1", name: "V", account_id: "acc-1", product_id: null, offer_codes: null,
  products: [{ product_id: "p1", offer_codes: ["A", "B"], created_at: "2026-01-01" }],
  folder_id: null, view_start_date: null, view_end_date: null, refresh_started_at: null,
  last_refresh_at: null, backfill_status: "pending", backfill_from: null,
  migrated_from_cycle_id: null, created_by: "user-1", created_at: "x", updated_at: "x",
};
// produto -> conta Hotmart (p3 é de outra conta)
const CATALOG: Record<string, string> = { p1: "acc-1", p2: "acc-1", p3: "acc-2" };

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
const viewInsert = () =>
  fake.calls.find((c) => c.op === "insert" && c.table === "dash_gestao_vendas_views");
const childInsert = () =>
  fake.calls.find((c) => c.op === "insert" && c.table === "dash_gestao_vendas_view_products");

function creationResolver(extra?: (c: FakeCall) => ReturnType<typeof resolver> | undefined) {
  return (c: FakeCall) => {
    const custom = extra?.(c);
    if (custom) return custom;
    if (c.table === "dash_gestao_hotmart_products") {
      const ids = (filterOf(c, "in")?.[1] ?? []) as string[];
      return { data: ids.filter((id) => id in CATALOG).map((id) => ({ product_id: id, account_id: CATALOG[id] })) };
    }
    if (c.table === "dash_gestao_accounts") return { data: { id: "acc-1", credentials: { client_id: "a", client_secret: "b" } } };
    if (c.table === "dash_gestao_vendas_views" && c.op === "insert") return { data: { ...VIEW, ...(c.payload as object) } };
    return {};
  };
}

const valid = { name: " Minha ", products: [{ product_id: "p1", offer_codes: [" A ", "B"] }] };
const two = {
  name: "Dois",
  products: [
    { product_id: "p1", offer_codes: ["A", "B"] },
    { product_id: "p2", offer_codes: ["C"] },
  ],
};

describe("GET /api/vendas/views", () => {
  const get = async () => (await import("../route")).GET();

  it("gestor recebe as views (com products, sem created_at) e os ciclos ativos sem view", async () => {
    resolver = (c) => {
      if (c.table === "dash_gestao_vendas_views") return { data: [{ ...VIEW, migrated_from_cycle_id: "c1" }] };
      if (c.table === "dash_gestao_vendas_cycles") return { data: [{ id: "c1", name: "Migrado" }, { id: "c2", name: "Fora" }] };
      return {};
    };
    const body = await (await get()).json();
    expect(body.views).toHaveLength(1);
    expect(body.views[0].products).toEqual([{ product_id: "p1", offer_codes: ["A", "B"] }]);
    expect(body.unmigrated_cycles).toEqual([{ id: "c2", name: "Fora" }]);
    const cycles = fake.calls.find((c) => c.table === "dash_gestao_vendas_cycles")!;
    expect(filterOf(cycles, "eq")).toEqual(["status", "ativo"]);
  });

  it("pede os produtos da tabela filha no select", async () => {
    resolver = (c) => (c.table === "dash_gestao_vendas_views" ? { data: [VIEW] } : {});
    await get();
    const select = fake.calls.find((c) => c.table === "dash_gestao_vendas_views")!;
    expect(select.payload).toContain("dash_gestao_vendas_view_products");
  });

  it("view com 2 produtos devolve ambos na ordem de inclusão", async () => {
    resolver = (c) =>
      c.table === "dash_gestao_vendas_views"
        ? {
            data: [{
              ...VIEW,
              products: [
                { product_id: "p2", offer_codes: ["C"], created_at: "2026-02-01" },
                { product_id: "p1", offer_codes: ["A"], created_at: "2026-01-01" },
              ],
            }],
          }
        : {};
    const body = await (await get()).json();
    expect(body.views[0].products.map((p: { product_id: string }) => p.product_id)).toEqual(["p1", "p2"]);
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
    ["produto sem oferta", { ...valid, products: [{ product_id: "p1", offer_codes: [] }] }],
    ["oferta duplicada", { ...valid, products: [{ product_id: "p1", offer_codes: ["A", " A"] }] }],
    ["oferta vazia", { ...valid, products: [{ product_id: "p1", offer_codes: ["A", "  "] }] }],
    ["offer_codes ausente", { name: "x", products: [{ product_id: "p1" }] }],
    ["lista vazia", { ...valid, products: [] }],
    ["products ausente", { name: "x" }],
    ["contrato antigo (product_id/offer_codes soltos)", { name: "x", product_id: "p1", offer_codes: ["A"] }],
    [
      "produto duplicado",
      { ...valid, products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: " p1", offer_codes: ["B"] }] },
    ],
    [
      "segundo produto sem oferta",
      { ...valid, products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: "p2", offer_codes: [] }] },
    ],
    ["produto sem id", { ...valid, products: [{ product_id: "", offer_codes: ["A"] }] }],
    ["sem nome", { ...valid, name: "  " }],
    ["período só com início", { ...valid, view_start_date: "2026-01-01" }],
    ["período invertido", { ...valid, view_start_date: "2026-02-01", view_end_date: "2026-01-01" }],
  ])("%s => 400, sem insert", async (_n, body) => {
    resolver = creationResolver();
    const res = await call(post(body));
    expect(res.status).toBe(400);
    expect(fake.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("produto inexistente => 400, sem insert", async () => {
    resolver = creationResolver();
    const res = await call(
      post({ ...valid, products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: "nope", offer_codes: ["Z"] }] })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("nope");
    expect(fake.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("produtos de contas diferentes => 400, sem insert", async () => {
    resolver = creationResolver();
    const res = await call(
      post({ ...valid, products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: "p3", offer_codes: ["Z"] }] })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("mesma conta");
    expect(fake.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("cria com 2 produtos de ofertas distintas: view sem colunas legadas + 1 linha filha por produto", async () => {
    resolver = creationResolver();
    const res = await call(post(two));
    expect(res.status).toBe(201);
    const { view } = await res.json();
    expect(viewInsert()!.payload).not.toHaveProperty("product_id");
    expect(viewInsert()!.payload).not.toHaveProperty("offer_codes");
    expect(viewInsert()!.payload).toMatchObject({ account_id: "acc-1" });
    expect(childInsert()!.payload).toEqual([
      { view_id: "view-1", product_id: "p1", offer_codes: ["A", "B"] },
      { view_id: "view-1", product_id: "p2", offer_codes: ["C"] },
    ]);
    expect(view.products).toEqual(two.products);
    // 4 janelas x (2 + 1) ofertas, ordem janela -> produto -> oferta
    expect(salesFetchCount).toBe(12);
    const firstWindow = salesUrls.slice(0, 3).map((u) => {
      const q = new URL(u).searchParams;
      return `${q.get("product_id")}:${q.get("offer_code")}`;
    });
    expect(firstWindow).toEqual(["p1:A", "p1:B", "p2:C"]);
  });

  it("falha ao gravar os produtos desfaz a visualização e não faz backfill", async () => {
    resolver = creationResolver((c) =>
      c.op === "insert" && c.table === "dash_gestao_vendas_view_products"
        ? { error: { message: "fk", code: "23503" } }
        : undefined
    );
    const res = await call(post(valid));
    expect(res.status).toBe(400);
    const del = fake.calls.find((c) => c.op === "delete")!;
    expect(del.table).toBe("dash_gestao_vendas_views");
    expect(salesFetchCount).toBe(0);
  });

  it("cria com trim, account_id do produto, created_by e backfill de 90 dias => done", async () => {
    resolver = creationResolver();
    const res = await call(post(valid));
    expect(res.status).toBe(201);
    const { view } = await res.json();
    expect(viewInsert()!.payload).toMatchObject({ name: "Minha", account_id: "acc-1", created_by: "user-1" });
    expect(childInsert()!.payload).toEqual([{ view_id: "view-1", product_id: "p1", offer_codes: ["A", "B"] }]);
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

  it("2 produtos: ordem janela -> produto -> oferta (a janela recente fecha para os dois antes da próxima)", async () => {
    resolver = creationResolver();
    const res = await call(post(two));
    expect(res.status).toBe(201);
    const pairs = salesUrls.map((u) => {
      const q = new URL(u).searchParams;
      return `${q.get("product_id")}/${q.get("offer_code")}`;
    });
    // 4 janelas x (p1/A, p1/B, p2/C), na ordem de inclusão, sem produto atravessar janela
    expect(pairs).toEqual(Array(4).fill(["p1/A", "p1/B", "p2/C"]).flat());
    const windows = salesUrls.map((u) => new URL(u).searchParams.get("end_date"));
    expect(windows.slice(0, 3).every((w) => w === windows[0])).toBe(true);
    expect((await res.json()).view.backfill_status).toBe("done");
  });

  it("2 produtos e orçamento estourado no meio de uma janela => partial; a cauda coberta tem os DOIS produtos", async () => {
    resolver = creationResolver();
    // janela 1 = buscas 1-3 (p1/A, p1/B, p2/C); janela 2 estoura em p1/B (busca 5)
    failSalesFrom = 5;
    const { view } = await (await call(post(two))).json();
    expect(view.backfill_status).toBe("partial");
    // só a janela 1 foi coberta por inteiro (hoje - 30d), mesmo p2 não tendo rodado na janela 2
    expect(view.backfill_from).toBe("2026-09-07");
    const w1 = salesUrls.slice(0, 3).map((u) => new URL(u).searchParams.get("product_id"));
    expect(w1).toEqual(["p1", "p1", "p2"]);
  });

  it("nenhuma oferta para buscar => failed, sem chamar a Hotmart", async () => {
    resolver = creationResolver();
    const { runBackfill } = await import("@/lib/vendas/views-sync");
    const out = await runBackfill({
      supabase: fake.client as never,
      view: { id: "view-1", account_id: "acc-1", view_start_date: null },
      targets: [{ productId: "p1", offerCodes: [] }],
    });
    expect(out.status).toBe("failed");
    expect(salesFetchCount).toBe(0);
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
      c.op === "insert" && c.table === "dash_gestao_vendas_views"
        ? { error: { message: "check", code: "23514" } }
        : undefined
    );
    expect((await call(post(valid))).status).toBe(400);
  });
});
