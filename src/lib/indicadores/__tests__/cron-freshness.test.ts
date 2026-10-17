import {
  summarizeFreshness,
  isMonitoredAccount,
  formatAge,
} from "../cron-freshness";

const NOW = new Date("2026-10-16T12:00:00.000Z");
const minAgo = (m: number) => ({ last_success_at: new Date(NOW.getTime() - m * 60_000).toISOString() });

describe("summarizeFreshness - fronteiras de cor", () => {
  it.each([
    [59, "green"],
    [60, "green"],
    [61, "amber"],
    [119, "amber"],
    [120, "amber"],
    [121, "red"],
  ])("sucesso ha %i min -> %s", (m, level) => {
    expect(summarizeFreshness([minAgo(m)], NOW).level).toBe(level);
  });

  it("vale a pior conta", () => {
    expect(summarizeFreshness([minAgo(5), minAgo(90)], NOW)).toEqual({ level: "amber", minutes: 90 });
  });

  it("conta ativa sem nenhum log conta como vermelho", () => {
    expect(summarizeFreshness([minAgo(5), { last_success_at: null }], NOW)).toEqual({ level: "red", minutes: null });
  });

  it("sem contas = none", () => {
    expect(summarizeFreshness([], NOW).level).toBe("none");
  });
});

describe("isMonitoredAccount", () => {
  it("ignora conta inativa", () => {
    expect(isMonitoredAccount({ platform: "hotmart", is_active: false })).toBe(false);
  });
  it("so hotmart e meta-ads", () => {
    expect(isMonitoredAccount({ platform: "meta-ads", is_active: true })).toBe(true);
    expect(isMonitoredAccount({ platform: "youtube", is_active: true })).toBe(false);
  });
});

describe("formatAge", () => {
  it("formata minutos e horas", () => {
    expect(formatAge(12)).toBe("há 12 min");
    expect(formatAge(65)).toBe("há 1h 5min");
    expect(formatAge(120)).toBe("há 2h");
    expect(formatAge(null)).toBe("sem coleta registrada");
  });
});
