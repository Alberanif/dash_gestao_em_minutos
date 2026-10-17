import { NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
}));

let lockRow: { expires_at: string } | null = null;
let lastFinished: string | null = null;
const logsByKey: Record<string, unknown> = {};
const lockGtArgs: unknown[][] = [];

const mockFrom = jest.fn((table: string) => {
  const chain: Record<string, unknown> = {};
  if (table === "dash_gestao_accounts") {
    chain.select = () => chain;
    chain.in = () => chain;
    chain.eq = () => chain;
    chain.order = () =>
      Promise.resolve({
        data: [
          { id: "a1", name: "Hot A", platform: "hotmart", is_active: true },
          { id: "a2", name: "Meta B", platform: "meta-ads", is_active: true },
        ],
        error: null,
      });
    return chain;
  }
  if (table === "dash_gestao_cron_locks") {
    chain.select = () => chain;
    chain.eq = (col: string, v: string) => {
      if (col === "name") expect(v).toBe("indicadores");
      return chain;
    };
    chain.gt = (...a: unknown[]) => {
      lockGtArgs.push(a);
      return chain;
    };
    chain.maybeSingle = () => Promise.resolve({ data: lockRow, error: null });
    return chain;
  }
  let acc = "";
  let status = "";
  let isLast = true;
  chain.select = (cols: string) => {
    isLast = cols === "finished_at";
    return chain;
  };
  chain.eq = (col: string, v: string) => {
    if (col === "account_id") acc = v;
    if (col === "status") status = v;
    return chain;
  };
  chain.in = () => chain;
  chain.not = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = () =>
    Promise.resolve({
      data: isLast ? (lastFinished ? { finished_at: lastFinished } : null) : (logsByKey[`${acc}:${status}`] ?? null),
      error: null,
    });
  return chain;
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({ from: mockFrom }),
}));

import { GET } from "../route";

const NOW = new Date("2026-10-16T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("GET /api/indicadores/refresh-status", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    mockFrom.mockClear();
    mockRequireRole.mockReset();
    mockRequireRole.mockResolvedValue({ error: null, userId: "u", role: "gestor" });
    lockRow = null;
    lastFinished = null;
    lockGtArgs.length = 0;
    for (const k of Object.keys(logsByKey)) delete logsByKey[k];
  });
  afterEach(() => jest.useRealTimers());

  it("sem sessão devolve 401 e não consulta o banco", async () => {
    mockRequireRole.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "pendente",
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("pede apenas gestor e analista (pendente/comum recebem 403 do requireRole)", async () => {
    mockRequireRole.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "comum",
    });
    expect((await GET()).status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("lock ativo: running true e can_refresh false; só considera lock não vencido", async () => {
    lockRow = { expires_at: ago(-60_000) };
    lastFinished = ago(60 * 60_000);
    const body = await (await GET()).json();
    expect(body.running).toBe(true);
    expect(body.can_refresh).toBe(false);
    expect(lockGtArgs).toEqual([["expires_at", NOW.toISOString()]]);
  });

  it("última coleta há < 5 min sem erro: formato exato e can_refresh false", async () => {
    lastFinished = ago(4 * 60_000 + 59_000);
    logsByKey["a1:success"] = { started_at: ago(5_000_000), finished_at: lastFinished, error_message: null };
    const body = await (await GET()).json();
    expect(body).toEqual({
      running: false,
      last_finished_at: lastFinished,
      has_current_error: false,
      errors: [],
      can_refresh: false,
    });
  });

  it("< 5 min com erro vigente: can_refresh true e errors por conta", async () => {
    lastFinished = ago(60_000);
    logsByKey["a1:success"] = { started_at: ago(900_000), finished_at: ago(900_000), error_message: null };
    logsByKey["a1:error"] = { started_at: ago(60_000), finished_at: ago(60_000), error_message: "boom" };
    const body = await (await GET()).json();
    expect(body.can_refresh).toBe(true);
    expect(body.has_current_error).toBe(true);
    expect(body.errors).toEqual([
      { account_id: "a1", name: "Hot A", platform: "hotmart", last_error_at: ago(60_000), last_error_message: "boom" },
    ]);
  });

  it("exatamente 5 min: can_refresh true", async () => {
    lastFinished = ago(5 * 60_000);
    expect((await (await GET()).json()).can_refresh).toBe(true);
  });

  it("erro antigo superado por sucesso posterior não é vigente", async () => {
    lastFinished = ago(60_000);
    logsByKey["a1:error"] = { started_at: ago(900_000), finished_at: ago(900_000), error_message: "velho" };
    logsByKey["a1:success"] = { started_at: ago(60_000), finished_at: ago(60_000), error_message: null };
    const body = await (await GET()).json();
    expect(body.has_current_error).toBe(false);
    expect(body.errors).toEqual([]);
    expect(body.can_refresh).toBe(false);
  });

  it("nunca coletou: last_finished_at null e can_refresh true", async () => {
    const body = await (await GET()).json();
    expect(body.last_finished_at).toBeNull();
    expect(body.can_refresh).toBe(true);
  });
});
