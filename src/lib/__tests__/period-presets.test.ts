import { calcPresetDates, getActivePreset } from "../utils/period-presets";

describe("calcPresetDates()", () => {
  describe("7d preset", () => {
    it("returns last 7 days relative to today", () => {
      const result = calcPresetDates("7d", "2026-05-27");
      expect(result).toEqual({ startDate: "2026-05-20", endDate: "2026-05-27" });
    });

    it("handles month boundary", () => {
      const result = calcPresetDates("7d", "2026-05-05");
      expect(result).toEqual({ startDate: "2026-04-28", endDate: "2026-05-05" });
    });

    it("handles year boundary", () => {
      const result = calcPresetDates("7d", "2026-01-03");
      expect(result).toEqual({ startDate: "2025-12-27", endDate: "2026-01-03" });
    });
  });

  describe("28d preset", () => {
    it("returns last 28 days relative to today", () => {
      const result = calcPresetDates("28d", "2026-05-27");
      expect(result).toEqual({ startDate: "2026-04-29", endDate: "2026-05-27" });
    });

    it("handles year boundary", () => {
      const result = calcPresetDates("28d", "2026-01-20");
      expect(result).toEqual({ startDate: "2025-12-23", endDate: "2026-01-20" });
    });
  });

  describe("90d preset", () => {
    it("returns last 90 days relative to today", () => {
      const result = calcPresetDates("90d", "2026-05-27");
      expect(result).toEqual({ startDate: "2026-02-26", endDate: "2026-05-27" });
    });

    it("handles year boundary spanning two years", () => {
      const result = calcPresetDates("90d", "2026-03-01");
      expect(result).toEqual({ startDate: "2025-12-01", endDate: "2026-03-01" });
    });
  });

  describe("mes-atual preset", () => {
    it("returns from day 1 of current month to today", () => {
      const result = calcPresetDates("mes-atual", "2026-05-27");
      expect(result).toEqual({ startDate: "2026-05-01", endDate: "2026-05-27" });
    });

    it("works on first day of month (start equals today)", () => {
      const result = calcPresetDates("mes-atual", "2026-05-01");
      expect(result).toEqual({ startDate: "2026-05-01", endDate: "2026-05-01" });
    });

    it("works at start of January", () => {
      const result = calcPresetDates("mes-atual", "2026-01-15");
      expect(result).toEqual({ startDate: "2026-01-01", endDate: "2026-01-15" });
    });
  });

  describe("mes-anterior preset", () => {
    it("returns complete previous calendar month", () => {
      const result = calcPresetDates("mes-anterior", "2026-05-27");
      expect(result).toEqual({ startDate: "2026-04-01", endDate: "2026-04-30" });
    });

    it("returns December when today is in January", () => {
      const result = calcPresetDates("mes-anterior", "2026-01-15");
      expect(result).toEqual({ startDate: "2025-12-01", endDate: "2025-12-31" });
    });

    it("handles February in a non-leap year", () => {
      const result = calcPresetDates("mes-anterior", "2026-03-10");
      expect(result).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" });
    });

    it("handles February in a leap year", () => {
      const result = calcPresetDates("mes-anterior", "2024-03-10");
      expect(result).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" });
    });

    it("handles months with 31 days (March → end of March is 31)", () => {
      const result = calcPresetDates("mes-anterior", "2026-04-05");
      expect(result).toEqual({ startDate: "2026-03-01", endDate: "2026-03-31" });
    });
  });
});

describe("getActivePreset()", () => {
  describe("returns the matching preset key", () => {
    it("returns '7d' when dates match the 7-day window", () => {
      const result = getActivePreset("2026-05-20", "2026-05-27", "2026-05-27");
      expect(result).toBe("7d");
    });

    it("returns '28d' when dates match the 28-day window", () => {
      const result = getActivePreset("2026-04-29", "2026-05-27", "2026-05-27");
      expect(result).toBe("28d");
    });

    it("returns '90d' when dates match the 90-day window", () => {
      const result = getActivePreset("2026-02-26", "2026-05-27", "2026-05-27");
      expect(result).toBe("90d");
    });

    it("returns 'mes-atual' when dates match current month from day 1 to today", () => {
      const result = getActivePreset("2026-05-01", "2026-05-27", "2026-05-27");
      expect(result).toBe("mes-atual");
    });

    it("returns 'mes-anterior' when dates match previous complete month", () => {
      const result = getActivePreset("2026-04-01", "2026-04-30", "2026-05-27");
      expect(result).toBe("mes-anterior");
    });
  });

  describe("returns null for custom date ranges", () => {
    it("returns null when end date is not today (for day-based presets)", () => {
      const result = getActivePreset("2026-05-13", "2026-05-26", "2026-05-27");
      expect(result).toBe(null);
    });

    it("returns null for arbitrary date ranges not matching any preset", () => {
      const result = getActivePreset("2026-05-10", "2026-05-20", "2026-05-27");
      expect(result).toBe(null);
    });

    it("matches 'mes-atual' rather than null when start/end exactly covers current month up to today", () => {
      // On 2026-04-30, mes-atual = 2026-04-01 to 2026-04-30, so this DOES match mes-atual
      const result = getActivePreset("2026-04-01", "2026-04-30", "2026-04-30");
      expect(result).toBe("mes-atual");
    });
  });

  describe("edge cases", () => {
    it("returns 'mes-atual' correctly when on first day of month", () => {
      const result = getActivePreset("2026-05-01", "2026-05-01", "2026-05-01");
      expect(result).toBe("mes-atual");
    });

    it("returns '7d' correctly when spanning year boundary", () => {
      const result = getActivePreset("2025-12-27", "2026-01-03", "2026-01-03");
      expect(result).toBe("7d");
    });

    it("returns 'mes-anterior' for December correctly", () => {
      const result = getActivePreset("2025-12-01", "2025-12-31", "2026-01-15");
      expect(result).toBe("mes-anterior");
    });
  });
});
