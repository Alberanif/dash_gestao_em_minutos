export type PresetKey = "7d" | "28d" | "90d" | "mes-atual" | "mes-anterior";

export interface PresetDates {
  startDate: string;
  endDate: string;
}

/**
 * Pads a number to 2 digits with leading zero
 */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Returns YYYY-MM-DD for a given year, month (1-based), day
 */
function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Subtracts N days from a YYYY-MM-DD date string.
 * Uses local calendar arithmetic (no UTC drift issues).
 */
function subtractDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() - days);
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Returns the last day of a given month (1-based) in a given year.
 * Handles leap years automatically.
 */
function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this month
  return new Date(year, month, 0).getDate();
}

/**
 * Calculates the start and end dates for a named preset,
 * given `today` as a YYYY-MM-DD reference date.
 */
export function calcPresetDates(preset: PresetKey, today: string): PresetDates {
  const [year, month] = today.split("-").map(Number);

  switch (preset) {
    case "7d":
      return { startDate: subtractDays(today, 7), endDate: today };

    case "28d":
      return { startDate: subtractDays(today, 28), endDate: today };

    case "90d":
      return { startDate: subtractDays(today, 90), endDate: today };

    case "mes-atual":
      return { startDate: ymd(year, month, 1), endDate: today };

    case "mes-anterior": {
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const lastDay = lastDayOfMonth(prevYear, prevMonth);
      return {
        startDate: ymd(prevYear, prevMonth, 1),
        endDate: ymd(prevYear, prevMonth, lastDay),
      };
    }
  }
}

/**
 * Given a selected date range (startDate, endDate) and today,
 * returns the matching preset key or null if no preset matches.
 */
export function getActivePreset(
  startDate: string,
  endDate: string,
  today: string
): PresetKey | null {
  const presets: PresetKey[] = ["7d", "28d", "90d", "mes-atual", "mes-anterior"];

  for (const preset of presets) {
    const { startDate: expectedStart, endDate: expectedEnd } = calcPresetDates(
      preset,
      today
    );
    if (startDate === expectedStart && endDate === expectedEnd) {
      return preset;
    }
  }

  return null;
}
