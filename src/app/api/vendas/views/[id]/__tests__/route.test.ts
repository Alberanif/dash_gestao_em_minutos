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
  id: "view-1", name: "V", account_id: "acc-1", product_id: "p1", offer_codes: ["A", "B"],
  folder_id: null, view_start_date: null, view_end_date: null, refresh_started_at: null,
  last_refresh_at: null, backfill_status: "done", backfill_from: "2026-07-09",
  migrated_from_cycle_id: null, created_by: "user-1", created_at: "x", updated_at: "x",
};

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

  it("product_id no body => 400 e nada é lido nem escrito", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(req("PATCH", { product_id: "p2", name: "x" }), ctx);
    expect(res.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it.each([
    ["body vazio", {}],
    ["remover a última oferta", { offer_codes: [] }],
    ["oferta duplicada", { offer_codes: ["A", "A"] }],
    ["nome vazio", { name: " " }],
    ["período incompleto", { view_end_date: "2026-01-31" }],
    ["período invertido", { view_start_date: "2026-02-01", view_end_date: "2026-01-01" }],
  ])("%s => 400 sem escrever", async (_n, body) => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(req("PATCH", body), ctx);
    expect(res.status).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it("404 quando a view não existe", async () => {
    resolver = () => ({ data: null });
    expect((await (await mod()).PATCH(req("PATCH", { name: "x" }), ctx)).status).toBe(404);
  });

  it("renomear/período não dispara backfill nem fetch", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(
      req("PATCH", { name: " Novo ", view_start_date: "2026-01-01", view_end_date: "2026-01-31" }),
      ctx
    );
    expect(res.status).toBe(200);
    const update = fake.calls.find((c) => c.op === "update")!;
    expect(update.payload).toEqual({ name: "Novo", view_start_date: "2026-01-01", view_end_date: "2026-01-31" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("adicionar oferta dispara backfill SÓ da oferta nova", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(req("PATCH", { offer_codes: ["A", "B", " C "] }), ctx);
    expect(res.status).toBe(200);
    expect(salesUrls.length).toBeGreaterThan(0);
    expect(salesUrls.every((u) => u.includes("offer_code=C"))).toBe(true);
    expect(salesUrls.some((u) => u.includes("offer_code=A") || u.includes("offer_code=B"))).toBe(false);
    expect((await res.json()).view.backfill_status).toBe("done");
  });

  it("remover oferta não busca na Hotmart e não apaga vendas", async () => {
    resolver = patchResolver();
    const res = await (await mod()).PATCH(req("PATCH", { offer_codes: ["A"] }), ctx);
    expect(res.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fake.calls.some((c) => c.table === "dash_gestao_hotmart_sales")).toBe(false);
    expect(fake.calls.some((c) => c.op === "delete")).toBe(false);
  });

  it("reenviar a mesma allowlist (outra ordem) não é oferta nova", async () => {
    resolver = patchResolver();
    await (await mod()).PATCH(req("PATCH", { offer_codes: ["B", "A"] }), ctx);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("CHECK/trigger do banco => 400", async () => {
    resolver = patchResolver((c) =>
      c.op === "update" && c.single ? { error: { message: "x", code: "UV001" } } : undefined
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
