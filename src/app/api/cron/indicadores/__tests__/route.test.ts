import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/utils/api-auth", () => ({ validateCronApiKey: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ fake: true })),
}));
jest.mock("@/lib/cron/lock", () => ({ acquireLock: jest.fn(), releaseLock: jest.fn() }));
jest.mock("@/lib/services/sync-platform", () => ({ syncPlatform: jest.fn() }));

import { POST } from "../route";
import { validateCronApiKey } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { acquireLock, releaseLock } from "@/lib/cron/lock";
import { syncPlatform } from "@/lib/services/sync-platform";

const auth = validateCronApiKey as jest.Mock;
const acquire = acquireLock as jest.Mock;
const release = releaseLock as jest.Mock;
const sync = syncPlatform as jest.Mock;
const LOCK = { name: "indicadores", token: "t" };

function req(qs = "") {
  return new NextRequest(`http://localhost/api/cron/indicadores${qs}`, { method: "POST" });
}
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.resetAllMocks();
  auth.mockResolvedValue({ error: null });
  acquire.mockResolvedValue(LOCK);
  release.mockResolvedValue(true);
  sync.mockResolvedValue([]);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/cron/indicadores", () => {
  it("401 sem Bearer válido, sem tocar no lock", async () => {
    auth.mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) });
    expect((await POST(req())).status).toBe(401);
    expect(acquire).not.toHaveBeenCalled();
  });

  it.each(["?window=7d", "?platforms=youtube", "?platforms=hotmart,x", "?platforms=,"])(
    "400 para %s",
    async (qs) => {
      expect((await POST(req(qs))).status).toBe(400);
      expect(acquire).not.toHaveBeenCalled();
    }
  );

  it("202 antes de a coleta terminar", async () => {
    let finish!: () => void;
    sync.mockReturnValue(new Promise((r) => (finish = () => r([]))));
    const res = await POST(req());
    expect(res.status).toBe(202);
    await flush();
    expect(release).not.toHaveBeenCalled(); // coleta ainda em andamento
    finish();
    await flush();
    expect(release).toHaveBeenCalledWith(LOCK);
  });

  it("lock ativo: 202 skipped e nenhuma coleta", async () => {
    acquire.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ skipped: "em andamento" });
    await flush();
    expect(sync).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("erro de banco no acquire: 500, sem coleta", async () => {
    acquire.mockRejectedValue(new Error("db fora"));
    expect((await POST(req())).status).toBe(500);
    expect(sync).not.toHaveBeenCalled();
  });

  it("libera o lock mesmo se a coleta lançar", async () => {
    sync.mockRejectedValue(new Error("boom"));
    expect((await POST(req())).status).toBe(202);
    await flush();
    expect(release).toHaveBeenCalledWith(LOCK);
  });

  it("libera o lock mesmo se a própria rodada lançar (ex.: client do banco)", async () => {
    (createSupabaseServiceClient as jest.Mock).mockImplementationOnce(() => {
      throw new Error("sem credenciais");
    });
    expect((await POST(req())).status).toBe(202);
    await flush();
    expect(sync).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(LOCK);
  });

  it("passa window e restringe plataformas (padrão: hotmart e meta-ads, 24h)", async () => {
    await POST(req());
    await flush();
    expect(sync.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ["hotmart", { window: "24h" }],
      ["meta-ads", { window: "24h" }],
    ]);

    sync.mockClear();
    await POST(req("?window=3d&platforms=hotmart"));
    await flush();
    expect(sync.mock.calls.map((c) => [c[0], c[2]])).toEqual([["hotmart", { window: "3d" }]]);
  });

  it("falha de uma plataforma não impede a outra", async () => {
    sync.mockImplementation((p: string) =>
      p === "hotmart" ? Promise.reject(new Error("x")) : Promise.resolve([])
    );
    await POST(req());
    await flush();
    expect(sync).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("falha ao liberar o lock não vira rejeição não tratada", async () => {
    release.mockRejectedValue(new Error("db"));
    expect((await POST(req())).status).toBe(202);
    await flush();
    expect(release).toHaveBeenCalled();
  });
});
