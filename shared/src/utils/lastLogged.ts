import { daysBetween, isDayString } from './timezone.ts';

/** Past this many days a food's last log reads better as a date than a count. */
const RELATIVE_WINDOW_DAYS = 14;

export type LastLoggedAge =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'daysAgo'; days: number }
  | { kind: 'date'; day: string };

/**
 * Describes how long ago a food was last logged, as data rather than text so
 * web and mobile can each localize and format it.
 *
 * Both arguments are `YYYY-MM-DD` calendar days; `today` is the viewer's day.
 * Returns null when the food was never logged (or the day is unusable).
 */
export function describeLastLogged(
  lastUsedDay: string | null | undefined,
  today: string
): LastLoggedAge | null {
  if (!lastUsedDay || !isDayString(lastUsedDay) || !isDayString(today)) {
    return null;
  }
  const days = daysBetween(lastUsedDay, today);
  if (days <= 0) return { kind: 'today' };
  if (days === 1) return { kind: 'yesterday' };
  if (days <= RELATIVE_WINDOW_DAYS) return { kind: 'daysAgo', days };
  return { kind: 'date', day: lastUsedDay };
}
