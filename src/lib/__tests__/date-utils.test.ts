import { today, dateSubtractDays, daysBetween, getDateRangeLabel } from "../date-utils";

describe("date-utils", () => {
  describe("today()", () => {
    it("returns a date in YYYY-MM-DD format", () => {
      const result = today();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns today's date", () => {
      const result = today();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      expect(result).toBe(expected);
    });
  });

  describe("dateSubtractDays()", () => {
    it("subtracts days correctly", () => {
      const result = dateSubtractDays("2026-05-08", 7);
      expect(result).toBe("2026-05-01");
    });

    it("handles month boundary", () => {
      const result = dateSubtractDays("2026-05-01", 1);
      expect(result).toBe("2026-04-30");
    });

    it("handles year boundary", () => {
      const result = dateSubtractDays("2026-01-01", 1);
      expect(result).toBe("2025-12-31");
    });
  });

  describe("daysBetween()", () => {
    it("calculates days between dates", () => {
      const result = daysBetween("2026-05-01", "2026-05-08");
      expect(result).toBe(7);
    });

    it("returns 0 for same date", () => {
      const result = daysBetween("2026-05-08", "2026-05-08");
      expect(result).toBe(0);
    });
  });

  describe("getDateRangeLabel()", () => {
    it("returns '7 dias' for 7-day range", () => {
      const result = getDateRangeLabel("2026-05-01", "2026-05-08");
      expect(result).toBe("Últimos 7 dias");
    });

    it("returns '30 dias' for 30-day range", () => {
      const result = getDateRangeLabel("2026-04-08", "2026-05-08");
      expect(result).toBe("Últimos 30 dias");
    });
  });
});
