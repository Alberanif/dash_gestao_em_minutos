import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acquireLock, releaseLock, DEFAULT_LOCK_TTL_MS, type LockRpcClient } from "../lock";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient: jest.fn() }));

// Fake em memória que reproduz a semântica do SQL da migration 073.
function fakeDb(now: () => number) {
  const rows = new Map<string, { token: string; expiresAt: number }>();
  const client: LockRpcClient = {
    async rpc(fn, args) {
      const name = args.p_name as string;
      const token = args.p_token as string;
      if (fn === "dash_gestao_cron_acquire_lock") {
        const cur = rows.get(name);
        if (cur && cur.expiresAt > now()) return { data: false, error: null };
        rows.set(name, { token, expiresAt: now() + (args.p_ttl_seconds as number) * 1000 });
        return { data: true, error: null };
      }
      if (fn === "dash_gestao_cron_release_lock") {
        const cur = rows.get(name);
        if (!cur || cur.token !== token) return { data: false, error: null };
        rows.delete(name);
        return { data: true, error: null };
      }
      return { data: null, error: { message: "rpc desconhecida" } };
    },
  };
  return client;
}

describe("cron lock", () => {
  let t = 1_000_000;
  const now = () => t;
  beforeEach(() => {
    t = 1_000_000;
  });

  it("duas aquisições do mesmo nome: só uma vence", async () => {
    const db = fakeDb(now);
    const [a, b] = await Promise.all([acquireLock("x", 1000, db), acquireLock("x", 1000, db)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("nomes diferentes não competem", async () => {
    const db = fakeDb(now);
    expect(await acquireLock("x", 1000, db)).not.toBeNull();
    expect(await acquireLock("y", 1000, db)).not.toBeNull();
  });

  it("lock ativo não é assumido; vencido é assumido", async () => {
    const db = fakeDb(now);
    await acquireLock("x", 60_000, db);
    t += 59_000;
    expect(await acquireLock("x", 60_000, db)).toBeNull();
    t += 2_000;
    expect(await acquireLock("x", 60_000, db)).not.toBeNull();
  });

  it("TTL padrão é 45 min, enviado em segundos", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    await acquireLock("x", undefined, { rpc });
    expect(DEFAULT_LOCK_TTL_MS).toBe(45 * 60 * 1000);
    expect(rpc).toHaveBeenCalledWith(
      "dash_gestao_cron_acquire_lock",
      expect.objectContaining({ p_name: "x", p_ttl_seconds: 2700 }),
    );
  });

  it("releaseLock só libera o dono e é idempotente", async () => {
    const db = fakeDb(now);
    const mine = (await acquireLock("x", 1000, db))!;
    expect(await releaseLock({ name: "x", token: "outro" }, db)).toBe(false);
    expect(await acquireLock("x", 1000, db)).toBeNull();
    expect(await releaseLock(mine, db)).toBe(true);
    expect(await releaseLock(mine, db)).toBe(false);
    expect(await acquireLock("x", 1000, db)).not.toBeNull();
  });

  it("release de lock vencido e assumido não derruba o novo dono", async () => {
    const db = fakeDb(now);
    const old = (await acquireLock("x", 1000, db))!;
    t += 2000;
    await acquireLock("x", 1000, db);
    expect(await releaseLock(old, db)).toBe(false);
    expect(await acquireLock("x", 1000, db)).toBeNull();
  });

  it("erro de banco lança em vez de parecer lock ocupado", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(acquireLock("x", 1000, { rpc })).rejects.toThrow("boom");
    await expect(releaseLock({ name: "x", token: "t" }, { rpc })).rejects.toThrow("boom");
  });

  it("rejeita TTL inválido", async () => {
    await expect(acquireLock("x", 0, { rpc: jest.fn() })).rejects.toThrow();
  });
});

describe("migration 073 (atomicidade vive no SQL)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/073_cron_locks.sql"), "utf8");
  it("adquire com INSERT ... ON CONFLICT condicionado ao vencimento", () => {
    expect(sql).toMatch(/on conflict \(name\) do update[\s\S]*where l\.expires_at <= now\(\)/i);
  });
  it("libera só com name e token", () => {
    expect(sql).toMatch(/where name = p_name and token = p_token/i);
  });
  it("RLS ligada e execute só para service_role", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/grant\s+execute on function public\.dash_gestao_cron_acquire_lock[^;]*to service_role/i);
  });
});
