jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ error: null, userId: "u", role: "admin" }),
}));

const logsByKey: Record<string, unknown> = {};
const mockFrom = jest.fn((table: string) => {
  if (table === "dash_gestao_accounts") {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.in = () => chain;
    chain.eq = () => chain;
    chain.order = () =>
      Promise.resolve({
        data: [
          { id: "a1", name: "Hot A", platform: "hotmart", is_active: true },
          { id: "a2", name: "Inativa", platform: "hotmart", is_active: false },
        ],
        error: null,
      });
    return chain;
  }
  let acc = "";
  let status = "";
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (col: string, v: string) => {
    if (col === "account_id") acc = v;
    if (col === "status") status = v;
    return chain;
  };
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: logsByKey[`${acc}:${status}`] ?? null, error: null });
  return chain;
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({ from: mockFrom }),
}));

import { GET } from "../route";

describe("GET /api/indicadores/cron-status", () => {
  it("devolve ultimo sucesso e ultimo erro por conta ativa; ignora inativa", async () => {
    logsByKey["a1:success"] = { started_at: "2026-10-16T10:00:00Z", finished_at: "2026-10-16T10:01:00Z", error_message: null };
    logsByKey["a1:error"] = { started_at: "2026-10-16T11:00:00Z", finished_at: null, error_message: "boom" };
    const res = await GET();
    const body = await res.json();
    expect(body.accounts).toEqual([
      {
        account_id: "a1",
        name: "Hot A",
        platform: "hotmart",
        last_success_at: "2026-10-16T10:01:00Z",
        last_error_at: "2026-10-16T11:00:00Z",
        last_error_message: "boom",
      },
    ]);
  });

  it("conta sem logs volta com nulls", async () => {
    delete logsByKey["a1:success"];
    delete logsByKey["a1:error"];
    const body = await (await GET()).json();
    expect(body.accounts[0].last_success_at).toBeNull();
  });
});
