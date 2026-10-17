import { hasCurrentError, type AccountCronStatus } from "../cron-freshness";
import { computeRefreshStatus, REFRESH_MIN_INTERVAL_MS } from "../refresh-status";

const NOW = new Date("2026-10-16T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function acc(p: Partial<AccountCronStatus> = {}): AccountCronStatus {
  return {
    account_id: "a1",
    name: "Hot A",
    platform: "hotmart",
    last_success_at: null,
    last_error_at: null,
    last_error_message: null,
    ...p,
  };
}
const okAcc = acc({ last_success_at: ago(1000) });
const errAcc = acc({ last_success_at: ago(60_000), last_error_at: ago(1000), last_error_message: "boom" });

describe("REFRESH_MIN_INTERVAL_MS", () => {
  it("vale 5 minutos", () => expect(REFRESH_MIN_INTERVAL_MS).toBe(300_000));
});

describe("hasCurrentError", () => {
  it("sem erro", () => expect(hasCurrentError(acc())).toBe(false));
  it("erro sem nenhum sucesso", () => expect(hasCurrentError(acc({ last_error_at: ago(5) }))).toBe(true));
  it("erro mais recente que o sucesso", () => expect(hasCurrentError(errAcc)).toBe(true));
  it("erro antigo superado por sucesso posterior", () =>
    expect(hasCurrentError(acc({ last_error_at: ago(60_000), last_success_at: ago(1000) }))).toBe(false));
});

describe("computeRefreshStatus", () => {
  const run = (o: { running?: boolean; last: string | null; accounts: AccountCronStatus[] }) =>
    computeRefreshStatus({ running: o.running ?? false, lastFinishedAt: o.last, accounts: o.accounts, now: NOW });

  it("lock ativo bloqueia, mesmo com erro vigente e coleta antiga", () => {
    const r = run({ running: true, last: ago(10 * 60_000), accounts: [errAcc] });
    expect(r.running).toBe(true);
    expect(r.can_refresh).toBe(false);
  });
  it("última coleta há < 5 min sem erro: bloqueia", () =>
    expect(run({ last: ago(REFRESH_MIN_INTERVAL_MS - 1), accounts: [okAcc] }).can_refresh).toBe(false));
  it("fronteira: exatamente 5 min libera", () =>
    expect(run({ last: ago(REFRESH_MIN_INTERVAL_MS), accounts: [okAcc] }).can_refresh).toBe(true));
  it("há > 5 min libera", () =>
    expect(run({ last: ago(REFRESH_MIN_INTERVAL_MS + 1), accounts: [okAcc] }).can_refresh).toBe(true));
  it("< 5 min com erro vigente libera", () => {
    const r = run({ last: ago(1000), accounts: [okAcc, errAcc] });
    expect(r.can_refresh).toBe(true);
    expect(r.has_current_error).toBe(true);
    expect(r.errors).toEqual([
      { account_id: "a1", name: "Hot A", platform: "hotmart", last_error_at: errAcc.last_error_at, last_error_message: "boom" },
    ]);
  });
  it("erro superado por sucesso posterior não conta", () => {
    const old = acc({ last_error_at: ago(120_000), last_success_at: ago(1000) });
    const r = run({ last: ago(1000), accounts: [old] });
    expect(r.has_current_error).toBe(false);
    expect(r.errors).toEqual([]);
    expect(r.can_refresh).toBe(false);
  });
  it("nunca coletou: libera", () => {
    const r = run({ last: null, accounts: [] });
    expect(r.last_finished_at).toBeNull();
    expect(r.can_refresh).toBe(true);
  });
});
