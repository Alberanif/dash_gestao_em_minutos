import { NextRequest } from "next/server";
import { createFakeSupabase, type FakeCall } from "@/lib/vendas/__tests__/fake-supabase";

let role: "gestor" | "analista";
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: jest.fn(async (allowed: string[]) =>
    allowed.includes(role)
      ? { error: null, userId: "user-1", role }
      : { error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }), userId: null, role }
  ),
}));

let fake: ReturnType<typeof createFakeSupabase>;
let rpcData: unknown;
let viewExists: boolean;
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => fake.client,
}));

beforeEach(() => {
  jest.resetModules();
  role = "analista"; // leitura é de gestor E analista
  rpcData = [];
  viewExists = true;
  fake = createFakeSupabase((c: FakeCall) =>
    c.op === "rpc" ? { data: rpcData } : { data: viewExists ? { id: "view-1" } : null }
  );
});

const ctx = { params: Promise.resolve({ id: "view-1" }) };
const get = (qs = "") => new NextRequest(`http://localhost/api/vendas/views/view-1/x${qs}`);
const rpcCall = () => fake.calls.find((c) => c.op === "rpc")!;

const routes = [
  ["kpis", "dash_gestao_vendas_view_kpis"],
  ["daily", "dash_gestao_vendas_view_daily"],
  ["hourly", "dash_gestao_vendas_view_hourly"],
  ["offers", "dash_gestao_vendas_view_offers"],
] as const;

describe.each(routes)("GET /views/[id]/%s", (name, rpc) => {
  const handler = async () => (await import(`../${name}/route`)).GET;

  it("repassa start/end para a RPC certa, sem fuso no TS", async () => {
    await (await handler())(get("?start=2026-10-01&end=2026-10-07"), ctx);
    expect(rpcCall().rpc).toBe(rpc);
    expect(rpcCall().payload).toEqual({ p_view_id: "view-1", p_start: "2026-10-01", p_end: "2026-10-07" });
  });

  it("start/end são opcionais (null)", async () => {
    await (await handler())(get(), ctx);
    expect(rpcCall().payload).toEqual({ p_view_id: "view-1", p_start: null, p_end: null });
  });

  it.each(["?start=01-10-2026", "?end=2026-13-45x", "?start=2026-10-07&end=2026-10-01"])(
    "data inválida %s => 400 sem chamar a RPC",
    async (qs) => {
      const res = await (await handler())(get(qs), ctx);
      expect(res.status).toBe(400);
      expect(fake.calls).toHaveLength(0);
    }
  );

  it("view inexistente => 404 sem RPC", async () => {
    viewExists = false;
    const res = await (await handler())(get(), ctx);
    expect(res.status).toBe(404);
    expect(fake.calls.some((c) => c.op === "rpc")).toBe(false);
  });
});

describe("formato das respostas (bigint chega como string)", () => {
  it("kpis: objeto numérico; sem linha => zeros", async () => {
    rpcData = [{ sales: "12", refunded: "3" }];
    const GET = (await import("../kpis/route")).GET;
    expect(await (await GET(get(), ctx)).json()).toEqual({ sales: 12, refunded: 3 });
    rpcData = [];
    expect(await (await GET(get(), ctx)).json()).toEqual({ sales: 0, refunded: 0 });
  });

  it("daily/hourly: { rows } com sales numérico", async () => {
    rpcData = [{ day: "2026-10-01", sales: "5" }];
    expect(await (await (await import("../daily/route")).GET(get(), ctx)).json()).toEqual({
      rows: [{ day: "2026-10-01", sales: 5 }],
    });
    rpcData = [{ hour: "2026-10-01T09", sales: "2" }];
    expect(await (await (await import("../hourly/route")).GET(get(), ctx)).json()).toEqual({
      rows: [{ hour: "2026-10-01T09", sales: 2 }],
    });
  });

  it("offers: nome nulo é preservado", async () => {
    rpcData = [{ offer_code: "A", offer_name: null, sales: "0", refunded: "1" }];
    expect(await (await (await import("../offers/route")).GET(get(), ctx)).json()).toEqual({
      rows: [{ offer_code: "A", offer_name: null, sales: 0, refunded: 1 }],
    });
  });
});
