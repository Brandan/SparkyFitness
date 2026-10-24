export interface DayScopedAssignment {
  day_of_week: number;
  id?: string;
}

/**
 * Makes `toDays` look like `fromDay` in a weekly meal plan: whatever those days
 * held is replaced by a copy of what `fromDay` holds. Other days, and the order
 * of what stays, are untouched, and copies are appended after them in weekday
 * order. Run it on parallel lists (a plan's assignments and their display
 * copies) and they stay index-aligned.
 *
 * Copies drop `id` because they are new rows.
 */
export function copyDayAssignments<T extends DayScopedAssignment>(
  items: readonly T[],
  fromDay: number,
  toDays: readonly number[]
): T[] {
  const targets = [...new Set(toDays)]
    .filter((day) => day !== fromDay)
    .sort((a, b) => a - b);
  const replaced = new Set(targets);
  const source = items.filter((item) => item.day_of_week === fromDay);
  const kept = items.filter((item) => !replaced.has(item.day_of_week));
  const copies = targets.flatMap((day) =>
    source.map((item) => ({ ...item, id: undefined, day_of_week: day }))
  );
  return [...kept, ...copies];
}

/** How many items each day of the week holds (index 0 = Sunday). */
export function countAssignmentsByDay(
  items: readonly DayScopedAssignment[]
): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const item of items) {
    if (item.day_of_week >= 0 && item.day_of_week <= 6) {
      counts[item.day_of_week] = (counts[item.day_of_week] ?? 0) + 1;
    }
  }
  return counts;
}
