import { validateEventPeriod } from "../event-period";

describe("validateEventPeriod", () => {
  it("aceita início e fim válidos, inclusive no mesmo dia", () => {
    expect(validateEventPeriod("2026-06-01", "2026-06-20")).toEqual({
      ok: true,
      value: { start_date: "2026-06-01", end_date: "2026-06-20" },
    });
    expect(validateEventPeriod("2026-06-01", "2026-06-01").ok).toBe(true);
  });

  it.each([
    [undefined, undefined],
    [null, null],
    ["", ""],
  ])("sem datas (%p, %p) vira null nos dois", (a, b) => {
    expect(validateEventPeriod(a, b)).toEqual({ ok: true, value: { start_date: null, end_date: null } });
  });

  it.each([
    ["só o início", "2026-06-01", ""],
    ["só o fim", null, "2026-06-20"],
    ["formato errado", "01/06/2026", "2026-06-20"],
    ["data impossível", "2026-02-30", "2026-03-10"],
    ["início depois do fim", "2026-06-20", "2026-06-01"],
    ["tipo errado", 20260601, "2026-06-20"],
  ])("recusa %s", (_n, a, b) => {
    expect(validateEventPeriod(a, b).ok).toBe(false);
  });
});
