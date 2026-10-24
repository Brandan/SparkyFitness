import {
  FOOD_VARIANT_NUTRIENT_FIELDS,
  type FoodVariantNutrientField,
} from '../constants/foodVariantNutrients.ts';

/**
 * Nutrients of a planned item or a day's planned items: every food-variant
 * nutrient (calories in kcal) plus custom nutrients keyed by name.
 */
export type PlannedNutrition = Record<FoodVariantNutrientField, number> & {
  custom_nutrients: Record<string, number>;
};

/** Per-serving nutrient values as stored on a food variant (columns may be null). */
export type NutrientSource = Partial<
  Record<FoodVariantNutrientField, number | string | null>
> & {
  custom_nutrients?: unknown;
};

export const emptyPlannedNutrition = (): PlannedNutrition => {
  const nutrition = { custom_nutrients: {} } as PlannedNutrition;
  for (const field of FOOD_VARIANT_NUTRIENT_FIELDS) nutrition[field] = 0;
  return nutrition;
};

/** `source` multiplied by `factor`; missing or non-numeric values count as 0. */
export const scalePlannedNutrition = (
  source: NutrientSource | PlannedNutrition,
  factor: number
): PlannedNutrition => {
  const scaled = emptyPlannedNutrition();
  for (const field of FOOD_VARIANT_NUTRIENT_FIELDS) {
    scaled[field] = (Number(source[field]) || 0) * factor;
  }
  const custom = source.custom_nutrients;
  if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
    for (const [name, value] of Object.entries(custom)) {
      const amount = Number(value);
      if (Number.isFinite(amount))
        scaled.custom_nutrients[name] = amount * factor;
    }
  }
  return scaled;
};

/** `a + b`, as a new object. */
export const addPlannedNutrition = (
  a: PlannedNutrition,
  b: PlannedNutrition
): PlannedNutrition => {
  const sum = emptyPlannedNutrition();
  for (const field of FOOD_VARIANT_NUTRIENT_FIELDS)
    sum[field] = a[field] + b[field];
  for (const source of [a.custom_nutrients, b.custom_nutrients]) {
    for (const [name, value] of Object.entries(source)) {
      sum.custom_nutrients[name] = (sum.custom_nutrients[name] ?? 0) + value;
    }
  }
  return sum;
};

interface PlannedNutritionItem {
  calories?: number | null;
  nutrition?: PlannedNutrition | null;
}

/**
 * What the day's planned items add up to, for showing beside what is logged.
 * An item without `nutrition` (an older server) still counts its calories.
 */
export const sumPlannedNutrition = (
  items: readonly PlannedNutritionItem[]
): PlannedNutrition =>
  items.reduce<PlannedNutrition>((total, item) => {
    if (item.nutrition) return addPlannedNutrition(total, item.nutrition);
    if (typeof item.calories === 'number') {
      return addPlannedNutrition(
        total,
        scalePlannedNutrition({ calories: item.calories }, 1)
      );
    }
    return total;
  }, emptyPlannedNutrition());
