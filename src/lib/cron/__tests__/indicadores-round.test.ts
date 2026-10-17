jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ fake: true })),
}));
jest.mock("@/lib/cron/lock", () => ({ acquireLock: jest.fn(), releaseLock: jest.fn() }));
jest.mock("@/lib/services/sync-platform", () => ({ syncPlatform: jest.fn() }));

import { parsePlatforms, parseWindow, runRound } from "../indicadores-round";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { releaseLock } from "@/lib/cron/lock";
import { syncPlatform } from "@/lib/services/sync-platform";

const release = releaseLock as jest.Mock;
const sync = syncPlatform as jest.Mock;
const LOCK = { name: "indicadores", token: "t" };

beforeEach(() => {
  jest.resetAllMocks();
  release.mockResolvedValue(true);
  sync.mockResolvedValue([]);
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({ fake: true });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("runRound", () => {
  it("roda cada plataforma com a janela pedida e libera o lock", async () => {
    await runRound(LOCK, ["hotmart", "meta-ads"], "3d");
    expect(sync.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ["hotmart", { window: "3d" }],
      ["meta-ads", { window: "3d" }],
    ]);
    expect(release).toHaveBeenCalledWith(LOCK);
  });

  it("erro numa plataforma não derruba a outra e é logado", async () => {
    sync.mockImplementation((p: string) =>
      p === "hotmart" ? Promise.reject(new Error("x")) : Promise.resolve([])
    );
    await expect(runRound(LOCK, ["hotmart", "meta-ads"], "24h")).resolves.toBeUndefined();
    expect(sync).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("hotmart"),
      expect.any(Error)
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("libera o lock mesmo se a coleta lançar de forma síncrona", async () => {
    sync.mockImplementation(() => {
      throw new Error("boom");
    });
    await expect(runRound(LOCK, ["hotmart"], "24h")).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledWith(LOCK);
  });

  it("libera o lock mesmo se criar o client do banco lançar", async () => {
    (createSupabaseServiceClient as jest.Mock).mockImplementation(() => {
      throw new Error("sem credenciais");
    });
    await runRound(LOCK, ["hotmart"], "24h");
    expect(sync).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(LOCK);
  });

  it("falha ao liberar o lock não rejeita", async () => {
    release.mockRejectedValue(new Error("db"));
    await expect(runRound(LOCK, ["hotmart"], "24h")).resolves.toBeUndefined();
  });
});

describe("parseWindow / parsePlatforms", () => {
  it("padrões e valores válidos", () => {
    expect(parseWindow(null)).toEqual({ value: "24h" });
    expect(parseWindow("3d")).toEqual({ value: "3d" });
    expect(parsePlatforms(null)).toEqual({ value: ["hotmart", "meta-ads"] });
    expect(parsePlatforms(" hotmart,hotmart ")).toEqual({ value: ["hotmart"] });
  });

  it("rejeita valores inválidos com a mensagem de sempre", () => {
    expect(parseWindow("7d").error).toBe("window inválido; use 24h ou 3d");
    expect(parsePlatforms("youtube").error).toBe(
      "platforms inválido (youtube); permitidas: hotmart, meta-ads"
    );
    expect(parsePlatforms(",").error).toBe("platforms inválido; permitidas: hotmart, meta-ads");
  });
});
