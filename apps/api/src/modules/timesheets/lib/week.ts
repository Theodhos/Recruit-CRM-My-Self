/** Working weeks run Monday to Sunday and are kept as UTC midnight dates, so a week never shifts with the time zone. */
export const DAY_MS = 86_400_000;

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const utcMidnight = (input: string | Date) =>
  typeof input === 'string' ? new Date(`${input.slice(0, 10)}T00:00:00.000Z`) : new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));

/** The Monday on or before the given date (UTC). */
export function mondayOf(input: string | Date): Date {
  const date = utcMidnight(input);
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
}

export const isMonday = (input: string) => utcMidnight(input).getUTCDay() === 1;

export const sundayOf = (monday: Date) => new Date(monday.getTime() + 6 * DAY_MS);

/** The seven dates of the week, as YYYY-MM-DD, Monday first. */
export const weekDates = (monday: Date) => Array.from({ length: 7 }, (_, i) => isoDate(new Date(monday.getTime() + i * DAY_MS)));
