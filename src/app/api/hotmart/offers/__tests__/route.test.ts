import { NextRequest } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null }),
}));

const calls: Array<[string, ...unknown[]]> = [];
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const builder: Record<string, unknown> = {};
for (const m of ["select", "eq", "order"]) {
  builder[m] = (...args: unknown[]) => {
    calls.push([m, ...args]);
    return builder;
  };
}
builder.then = (resolve: (v: unknown) => unknown) => resolve(result);

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({ from: () => builder }),
}));

const BASE = "http://localhost/api/hotmart/offers?account_id=a1&product_id=p1";

beforeEach(() => {
  calls.length = 0;
  result = { data: [], error: null };
});

describe("GET /api/hotmart/offers", () => {
  it("sem include_inactive: filtra is_active=true e não seleciona is_active", async () => {
    const { GET } = await import("../route");
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(200);
    expect(calls).toContainEqual(["eq", "is_active", true]);
    const sel = calls.find((c) => c[0] === "select")![1] as string;
    expect(sel).not.toContain("is_active");
    expect(calls.filter((c) => c[0] === "order")).toEqual([
      ["order", "is_main_offer", { ascending: false }],
    ]);
  });

  it("include_inactive=false equivale ao comportamento padrão", async () => {
    const { GET } = await import("../route");
    await GET(new NextRequest(`${BASE}&include_inactive=false`));
    expect(calls).toContainEqual(["eq", "is_active", true]);
  });

  it("com include_inactive=true: não filtra is_active, traz is_active e ordena ativas primeiro", async () => {
    const { GET } = await import("../route");
    await GET(new NextRequest(`${BASE}&include_inactive=true`));
    expect(calls.find((c) => c[0] === "eq" && c[1] === "is_active")).toBeUndefined();
    const sel = calls.find((c) => c[0] === "select")![1] as string;
    expect(sel).toContain("is_active");
    expect(calls.filter((c) => c[0] === "order")).toEqual([
      ["order", "is_active", { ascending: false }],
      ["order", "is_main_offer", { ascending: false }],
    ]);
  });

  it("400 sem account_id/product_id", async () => {
    const { GET } = await import("../route");
    const res = await GET(new NextRequest("http://localhost/api/hotmart/offers"));
    expect(res.status).toBe(400);
  });

  it("500 em erro do banco", async () => {
    result = { data: null, error: { message: "boom" } };
    const { GET } = await import("../route");
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(500);
  });
});
