/**
 * Returns today's date in YYYY-MM-DD format (local timezone)
 */
export function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Subtracts days from a date string and returns result in YYYY-MM-DD format
 * @param dateStr YYYY-MM-DD format date
 * @param days number of days to subtract
 */
export function dateSubtractDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - days);
  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, "0");
  const resultDay = String(date.getDate()).padStart(2, "0");
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

/**
 * Calculates the number of days between two dates
 * @param startStr YYYY-MM-DD format start date
 * @param endStr YYYY-MM-DD format end date
 */
export function daysBetween(startStr: string, endStr: string): number {
  const [startYear, startMonth, startDay] = startStr.split("-").map(Number);
  const [endYear, endMonth, endDay] = endStr.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns a human-readable label for a date range
 * @param startStr YYYY-MM-DD format start date
 * @param endStr YYYY-MM-DD format end date
 */
export function getDateRangeLabel(startStr: string, endStr: string): string {
  const days = daysBetween(startStr, endStr);
  if (days === 7) return "Últimos 7 dias";
  if (days === 30) return "Últimos 30 dias";
  if (days === 1) return "Hoje";
  return `${days} dias`;
}
