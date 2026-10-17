import { NextResponse } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({ requireRole: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ fake: true })),
}));
jest.mock("@/lib/cron/lock", () => ({
  INDICADORES_LOCK_NAME: "indicadores",
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
}));
jest.mock("@/lib/services/sync-platform", () => ({ syncPlatform: jest.fn() }));
jest.mock("@/lib/indicadores/load-refresh-inputs", () => ({ loadRefreshInputs: jest.fn() }));

import { POST } from "../route";
import { requireRole } from "@/lib/utils/api-auth";
import { acquireLock, releaseLock } from "@/lib/cron/lock";
import { syncPlatform } from "@/lib/services/sync-platform";
import { loadRefreshInputs } from "@/lib/indicadores/load-refresh-inputs";

const auth = requireRole as jest.Mock;
const acquire = acquireLock as jest.Mock;
const release = releaseLock as jest.Mock;
const sync = syncPlatform as jest.Mock;
const load = loadRefreshInputs as jest.Mock;
const LOCK = { name: "indicadores", token: "t" };
const NOW = new Date("2026-10-16T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const flush = () => new Promise((r) => setImmediate(r));

function inputs(over: Record<string, unknown> = {}) {
  return { inputs: { running: false, lastFinishedAt: ago(60 * 60_000), accounts: [], ...over } };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] }).setSystemTime(NOW);
  auth.mockResolvedValue({ error: null, userId: "u", role: "gestor" });
  load.mockResolvedValue(inputs());
  acquire.mockResolvedValue(LOCK);
  release.mockResolvedValue(true);
  sync.mockResolvedValue([]);
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.useRealTimers());

describe("POST /api/indicadores/refresh", () => {
  it("401 sem sessão, sem consultar banco nem lock", async () => {
    auth.mockResolvedValue({ error: NextResponse.json({}, { status: 401 }), userId: null, role: "pendente" });
    expect((await POST()).status).toBe(401);
    expect(load).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
  });

  it("403 para pendente/comum; exige só gestor e analista", async () => {
    auth.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }), userId: null, role: "comum" });
    expect((await POST()).status).toBe(403);
    expect(auth).toHaveBeenCalledWith(["gestor", "analista"]);
    expect(acquire).not.toHaveBeenCalled();
  });

  it("não lê CRON_SECRET", async () => {
    const original = process.env.CRON_SECRET;
    let read = false;
    Object.defineProperty(process.env, "CRON_SECRET", {
      configurable: true,
      get: () => ((read = true), "x"),
    });
    try {
      await POST();
    } finally {
      delete process.env.CRON_SECRET;
      if (original !== undefined) process.env.CRON_SECRET = original;
    }
    expect(read).toBe(false);
  });

  it("429 com last_finished_at dentro do intervalo sem erro; nenhuma coleta", async () => {
    const last = ago(60_000);
    load.mockResolvedValue(inputs({ lastFinishedAt: last }));
    const res = await POST();
    expect(res.status).toBe(429);
    expect((await res.json()).last_finished_at).toBe(last);
    expect(acquire).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it("dentro do intervalo mas com erro vigente: segue para a coleta", async () => {
    load.mockResolvedValue(
      inputs({
        lastFinishedAt: ago(60_000),
        accounts: [
          {
            account_id: "a1",
            name: "Hot",
            platform: "hotmart",
            last_success_at: ago(900_000),
            last_error_at: ago(60_000),
            last_error_message: "boom",
          },
        ],
      }),
    );
    expect((await POST()).status).toBe(202);
    expect(acquire).toHaveBeenCalled();
  });

  it("lock ativo na leitura (running) não vira 429: responde 202 skipped via lock", async () => {
    load.mockResolvedValue(inputs({ running: true }));
    acquire.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ skipped: "em andamento" });
    await flush();
    expect(sync).not.toHaveBeenCalled();
  });

  it("500 se o acquire falha por erro de banco", async () => {
    acquire.mockRejectedValue(new Error("db"));
    const res = await POST();
    expect(res.status).toBe(500);
    expect(sync).not.toHaveBeenCalled();
  });

  it("500 se a leitura do status falha", async () => {
    load.mockResolvedValue({ error: "db" });
    expect((await POST()).status).toBe(500);
    expect(acquire).not.toHaveBeenCalled();
  });

  it("caso feliz: 202 antes de a coleta terminar; janela 24h, Hotmart e Meta Ads; libera ao fim", async () => {
    let finish!: () => void;
    sync.mockReturnValue(new Promise((r) => (finish = () => r([]))));
    const res = await POST();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: true });
    await flush();
    expect(sync.mock.calls.map((c) => c[0]).sort()).toEqual(["hotmart", "meta-ads"]);
    expect(sync.mock.calls.every((c) => c[2].window === "24h")).toBe(true);
    expect(release).not.toHaveBeenCalled();
    finish();
    await flush();
    expect(release).toHaveBeenCalledWith(LOCK);
  });

  it("libera o lock mesmo quando a coleta lança", async () => {
    sync.mockRejectedValue(new Error("falhou"));
    expect((await POST()).status).toBe(202);
    await flush();
    expect(release).toHaveBeenCalledWith(LOCK);
  });
});
