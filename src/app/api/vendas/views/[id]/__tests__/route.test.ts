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

const VIEW = {
  id: "view-1", name: "V", account_id: "acc-1", product_id: null, offer_codes: null,
  products: [
    { product_id: "p1", offer_codes: ["A", "B"], created_at: "2026-01-01" },
    { product_id: "p2", offer_codes: ["C"], created_at: "2026-01-02" },
  ],
  folder_id: null, view_start_date: null, view_end_date: null, refresh_started_at: null,
  last_refresh_at: null, backfill_status: "done", backfill_from: "2026-07-09",
  migrated_from_cycle_id: null, created_by: "user-1", created_at: "x", updated_at: "x",
};

// produto -> conta Hotmart (p4 é de outra conta)
const CATALOG: Record<string, string> = { p1: "acc-1", p2: "acc-1", p3: "acc-1", p4: "acc-2" };

let salesUrls: string[];

beforeEach(() => {
  jest.resetModules();
  role = "gestor";
  salesUrls = [];
  resolver = () => ({});
  fake = createFakeSupabase((c) => resolver(c));
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes("oauth/token")) {
      return { ok: true, json: async () => ({ access_token: "tok" }), text: async (): Promise<string> => "" };
    }
    salesUrls.push(String(url));
    return { ok: true, json: async () => ({ items: [], page_info: {} }), text: async (): Promise<string> => "" };
  }) as unknown as typeof fetch;
});

const ctx = { params: Promise.resolve({ id: "view-1" }) };
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/vendas/views/view-1", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const mod = () => import("../route");

function patchResolver(extra?: (c: FakeCall) => ReturnType<typeof resolver> | undefined) {
  return (c: FakeCall) => {
    const custom = extra?.(c);
    if (custom) return custom;
    if (c.table === "dash_gestao_accounts") return { data: { id: "acc-1", credentials: { client_id: "a", client_secret: "b" } } };
    if (c.table === "dash_gestao_hotmart_products") {
      const ids = (filterOf(c, "in")?.[1] ?? []) as string[];
      return { data: ids.filter((id) => id in CATALOG).map((id) => ({ product_id: id, account_id: CATALOG[id] })) };
    }
    if (c.table === "dash_gestao_vendas_views" && c.op === "select") return { data: VIEW };
    if (c.table === "dash_gestao_vendas_views" && c.op === "update" && c.single) {
      return { data: { ...VIEW, ...(c.payload as object) } };
    }
    return {};
  };
}
const writes = () => fake.calls.filter((c) => c.op !== "select" && c.op !== "rpc");

describe("GET /views/[id]", () => {
  it("devolve a view; 404 se não existe; analista pode", async () => {
    role = "analista";
    resolver = (c) => ({ data: c.op === "select" ? VIEW : null });
    const res = await (await mod()).GET(req("GET"), ctx);
    expect((await res.json()).view.id).toBe("view-1");

    resolver = () => ({ data: null });
    expect((await (await mod()).GET(req("GET"), ctx)).status).toBe(404);
  });
});

describe("PATCH /views/[id]", () => {
  it("analista recebe 403 em PATCH (inclusive de período) e nada é escrito", async () => {
    role = "analista";
    const m = await mod();
    expect((await m.PATCH(req("PATCH", { name: "x" }), ctx)).status).toBe(403);
    expect(
      (await m.PATCH(req("PATCH", { view_start_date: "2026-01-01", view_end_date: "2026-01-31" }), ctx)).status
    ).toBe(403);
    expect(fake.calls).toHaveLength(0);
  });

  it.each([
    ["product_id solto", { product_id: "p2", name: "x" }],
    ["offer_codes solto", { offer_codes: ["A"] }],
  ])("%s (contrato antigo) => 400 e nada é lido nem escrito", async (_n, body) => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(req("PATCH", body), ctx);
    expect(res.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it.each([
    ["body vazio", {}],
    ["remover o último produto (lista vazia)", { products: [] }],
    ["produto sem oferta", { products: [{ product_id: "p1", offer_codes: [] }] }],
    ["oferta duplicada", { products: [{ product_id: "p1", offer_codes: ["A", "A"] }] }],
    ["produto duplicado", { products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: "p1", offer_codes: ["B"] }] }],
    ["products não é array", { products: "p1" }],
    ["nome vazio", { name: " " }],
    ["período incompleto", { view_end_date: "2026-01-31" }],
    ["período invertido", { view_start_date: "2026-02-01", view_end_date: "2026-01-01" }],
  ])("%s => 400 sem escrever", async (_n, body) => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(req("PATCH", body), ctx);
    expect(res.status).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it("produto inexistente => 400 sem escrever", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(
      req("PATCH", { products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: "nope", offer_codes: ["Z"] }] }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it("produto de outra conta => 400 sem escrever", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(
      req("PATCH", { products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: "p4", offer_codes: ["Z"] }] }),
      ctx
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("mesma conta");
    expect(writes()).toHaveLength(0);
  });

  it("produtos todos de outra conta que não a da visualização => 400 sem escrever", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(req("PATCH", { products: [{ product_id: "p4", offer_codes: ["Z"] }] }), ctx);
    expect(res.status).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it("404 quando a view não existe", async () => {
    resolver = () => ({ data: null });
    expect((await (await mod()).PATCH(req("PATCH", { name: "x" }), ctx)).status).toBe(404);
  });

  it("renomear/período não dispara backfill, fetch nem mexe nos produtos", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(
      req("PATCH", { name: " Novo ", view_start_date: "2026-01-01", view_end_date: "2026-01-31" }),
      ctx
    );
    expect(res.status).toBe(200);
    const update = fake.calls.find((c) => c.op === "update")!;
    expect(update.payload).toEqual({ name: "Novo", view_start_date: "2026-01-01", view_end_date: "2026-01-31" });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(writes().some((c) => c.table === "dash_gestao_vendas_view_products")).toBe(false);
    expect((await res.json()).view.products).toHaveLength(2);
  });

  it("adicionar produto: grava na filha e faz backfill SÓ do produto novo", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(
      req("PATCH", {
        products: [
          { product_id: "p1", offer_codes: ["A", "B"] },
          { product_id: "p2", offer_codes: ["C"] },
          { product_id: "p3", offer_codes: [" D "] },
        ],
      }),
      ctx
    );
    expect(res.status).toBe(200);
    const upsert = fake.calls.find((c) => c.op === "upsert")!;
    expect(upsert.table).toBe("dash_gestao_vendas_view_products");
    expect(upsert.payload).toEqual([
      { view_id: "view-1", product_id: "p1", offer_codes: ["A", "B"] },
      { view_id: "view-1", product_id: "p2", offer_codes: ["C"] },
      { view_id: "view-1", product_id: "p3", offer_codes: ["D"] },
    ]);
    expect(upsert.options).toEqual({ onConflict: "view_id,product_id" });
    expect(fake.calls.some((c) => c.op === "delete")).toBe(false);
    expect(salesUrls.length).toBeGreaterThan(0);
    expect(salesUrls.every((u) => u.includes("product_id=p3") && u.includes("offer_code=D"))).toBe(true);
    const { view } = await res.json();
    expect(view.products).toHaveLength(3);
    expect(view.backfill_status).toBe("done");
  });

  it("adicionar oferta a produto existente: backfill SÓ da oferta nova", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(
      req("PATCH", {
        products: [
          { product_id: "p1", offer_codes: ["A", "B", " E "] },
          { product_id: "p2", offer_codes: ["C"] },
        ],
      }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(salesUrls.length).toBeGreaterThan(0);
    expect(salesUrls.every((u) => u.includes("product_id=p1") && u.includes("offer_code=E"))).toBe(true);
  });

  it.each(["partial", "failed", "pending"])(
    "adicionar produto com histórico %s: refaz TODOS os produtos (nunca declara done só pelo novo)",
    async (st) => {
      resolver = patchResolver((c) =>
        c.table === "dash_gestao_vendas_views" && c.op === "select" ? { data: { ...VIEW, backfill_status: st } } : undefined
      );
      const res = await (await mod()).PATCH(
        req("PATCH", {
          products: [
            { product_id: "p1", offer_codes: ["A", "B"] },
            { product_id: "p2", offer_codes: ["C"] },
            { product_id: "p3", offer_codes: ["D"] },
          ],
        }),
        ctx
      );
      expect(res.status).toBe(200);
      const seen = new Set(salesUrls.map((u) => new URL(u).searchParams.get("product_id")));
      expect([...seen].sort()).toEqual(["p1", "p2", "p3"]);
    }
  );

  it("adicionar produto: orçamento estourado => partial com backfill_from da cauda coberta", async () => {
    resolver = patchResolver();
    let n = 0;
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (String(url).includes("oauth/token")) {
        return { ok: true, json: async () => ({ access_token: "tok" }), text: async (): Promise<string> => "" };
      }
      n += 1;
      if (n >= 2) throw Object.assign(new Error("t"), { name: "TimeoutError" });
      return { ok: true, json: async () => ({ items: [], page_info: {} }), text: async (): Promise<string> => "" };
    });
    const res = await (await mod()).PATCH(
      req("PATCH", {
        products: [
          { product_id: "p1", offer_codes: ["A", "B"] },
          { product_id: "p2", offer_codes: ["C"] },
          { product_id: "p3", offer_codes: ["D"] },
        ],
      }),
      ctx
    );
    const { view } = await res.json();
    expect(view.backfill_status).toBe("partial");
    expect(view.backfill_from).not.toBeNull();
  });

  it("remover produto: apaga só a linha filha dele, sem fetch e sem tocar em hotmart_sales", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(
      req("PATCH", { products: [{ product_id: "p1", offer_codes: ["A", "B"] }] }),
      ctx
    );
    expect(res.status).toBe(200);
    const del = fake.calls.find((c) => c.op === "delete")!;
    expect(del.table).toBe("dash_gestao_vendas_view_products");
    expect(del.filters).toEqual(
      expect.arrayContaining([
        ["eq", ["view_id", "view-1"]],
        ["in", ["product_id", ["p2"]]],
      ])
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fake.calls.some((c) => c.table === "dash_gestao_hotmart_sales")).toBe(false);
    expect((await res.json()).view.products).toEqual([{ product_id: "p1", offer_codes: ["A", "B"] }]);
  });

  it("substituir o conjunto grava (upsert) ANTES de remover, para nunca ficar sem produto", async () => {
    resolver = patchResolver();
    await (await mod()).PATCH(req("PATCH", { products: [{ product_id: "p3", offer_codes: ["D"] }] }), ctx);
    const ops = writes().map((c) => c.op);
    expect(ops.indexOf("upsert")).toBeGreaterThanOrEqual(0);
    expect(ops.indexOf("upsert")).toBeLessThan(ops.indexOf("delete"));
    const del = fake.calls.find((c) => c.op === "delete")!;
    expect(filterOf(del, "in")).toEqual(["product_id", ["p1", "p2"]]);
  });

  it("remover oferta de um produto não busca na Hotmart", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(
      req("PATCH", { products: [{ product_id: "p1", offer_codes: ["A"] }, { product_id: "p2", offer_codes: ["C"] }] }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fake.calls.some((c) => c.op === "delete")).toBe(false);
  });

  it("reenviar a mesma allowlist (outra ordem) não é oferta nova", async () => {
    resolver = patchResolver();
    await (await mod()).PATCH(
      req("PATCH", { products: [{ product_id: "p2", offer_codes: ["C"] }, { product_id: "p1", offer_codes: ["B", "A"] }] }),
      ctx
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("erro do banco na filha (CHECK/FK/mínimo de 1) => 400", async () => {
    for (const code of ["23514", "23503", "UV002"]) {
      jest.resetModules();
      fake = createFakeSupabase((c) => patchResolver((x) => (x.op === "upsert" ? { error: { message: "x", code } } : undefined))(c));
      const res = await (await mod()).PATCH(
        req("PATCH", { products: [{ product_id: "p1", offer_codes: ["A"] }] }),
        ctx
      );
      expect(res.status).toBe(400);
    }
  });

  it("CHECK do banco no período => 400", async () => {
    resolver = patchResolver((c) =>
      c.op === "update" && c.single ? { error: { message: "x", code: "23514" } } : undefined
    );
    expect((await (await mod()).PATCH(req("PATCH", { name: "x" }), ctx)).status).toBe(400);
  });
});

describe("DELETE /views/[id]", () => {
  it("analista => 403", async () => {
    role = "analista";
    expect((await (await mod()).DELETE(req("DELETE"), ctx)).status).toBe(403);
    expect(fake.calls).toHaveLength(0);
  });

  it("apaga só a view (nunca hotmart_sales) e responde { ok: true }", async () => {
    resolver = () => ({ data: [{ id: "view-1" }] });
    const res = await (await mod()).DELETE(req("DELETE"), ctx);
    expect(await res.json()).toEqual({ ok: true });
    const deletes = fake.calls.filter((c) => c.op === "delete");
    expect(deletes.map((c) => c.table)).toEqual(["dash_gestao_vendas_views"]);
    expect(filterOf(deletes[0], "eq")).toEqual(["id", "view-1"]);
  });

  it("404 se não existia", async () => {
    resolver = () => ({ data: [] });
    expect((await (await mod()).DELETE(req("DELETE"), ctx)).status).toBe(404);
  });
});
