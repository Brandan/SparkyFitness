export type MealPercentages = Record<string, number>;

export const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;

export const sumPercentages = (
  percentages: MealPercentages,
  keys: string[]
): number => keys.reduce((sum, key) => sum + (percentages[key] ?? 0), 0);

/**
 * Splits whatever the locked meals leave of the 100% budget evenly across the
 * unlocked meals. The last unlocked meal takes the rounding remainder so the
 * total lands on exactly 100 (or 0 for the rest when locked meals already
 * exceed it).
 */
export const distributeRemaining = (
  percentages: MealPercentages,
  keys: string[],
  locked: Record<string, boolean>
): MealPercentages => {
  const unlocked = keys.filter((key) => !locked[key]);
  if (unlocked.length === 0) return percentages;
  const lockedTotal = sumPercentages(
    percentages,
    keys.filter((key) => locked[key])
  );
  const budget = Math.max(0, 100 - lockedTotal);
  const base = Math.floor(budget / unlocked.length);
  let remainder = budget - base * unlocked.length;
  const next = { ...percentages };
  for (const key of unlocked) {
    // Spread the leftover one point at a time rather than piling it on one meal.
    next[key] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return next;
};

/** A meal's share of the daily calories, in whole kcal. */
export const caloriesFromPercent = (
  percent: number,
  totalCalories: number
): number => Math.round((percent / 100) * totalCalories);

/**
 * The share of the daily calories a kcal amount makes up, to one decimal so a
 * typed calorie amount lands within about 3 kcal of what was entered.
 */
export const percentFromCalories = (
  calories: number,
  totalCalories: number
): number => {
  if (!Number.isFinite(calories) || !(totalCalories > 0)) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((calories / totalCalories) * 1000) / 10)
  );
};

/** Percent text for display: whole numbers stay whole, others get one decimal. */
export const formatPercent = (percent: number): string =>
  String(Math.round(percent * 10) / 10);

/**
 * Nudges the largest meal so the shares add up to exactly 100. Calorie entry
 * rounds each meal to a tenth of a percent, so a split can total 99.9 or
 * 100.1; the web editor only shows a total as valid when it is exactly 100.
 */
export const normalizeToHundred = (
  percentages: MealPercentages,
  keys: string[]
): MealPercentages => {
  if (keys.length === 0) return percentages;
  const diff = Math.round((100 - sumPercentages(percentages, keys)) * 10) / 10;
  if (diff === 0) return percentages;
  const largest = keys.reduce((best, key) =>
    (percentages[key] ?? 0) > (percentages[best] ?? 0) ? key : best
  );
  return {
    ...percentages,
    [largest]: Math.round(((percentages[largest] ?? 0) + diff) * 10) / 10,
  };
};
