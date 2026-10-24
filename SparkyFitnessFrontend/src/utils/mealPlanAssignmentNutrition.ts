import { getConversionFactor } from '@workspace/shared';

/**
 * A food serving the meal-plan dialog can scale a logged quantity against.
 * Nutrition fields arrive as numbers from the client and sometimes as numeric
 * strings from the API.
 */
export interface PlanFoodVariant {
  id?: string;
  serving_size?: number | string | null;
  serving_unit?: string | null;
  is_default?: boolean | null;
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
}

export interface ScaledPlanNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ScalableAssignment {
  quantity?: number | string | null;
  unit?: string | null;
  serving_size?: number | string | null;
  serving_unit?: string | null;
  total_servings?: number | string | null;
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
}

function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? '').trim().toLowerCase();
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `value || 1` for a missing or zero amount. Negatives are kept. */
function amountOrOne(value: unknown): number {
  const parsed = finiteNumber(value);
  if (parsed === null || parsed === 0) return 1;
  return parsed;
}

/**
 * True when `quantityUnit` can be applied to a serving measured in
 * `servingUnit`: same unit, a missing unit, or a weight/volume conversion.
 * Ounces do not convert to millilitres.
 */
function unitsAreScalable(
  quantityUnit: string | null | undefined,
  servingUnit: string | null | undefined
): boolean {
  const from = normalizeUnit(quantityUnit);
  const to = normalizeUnit(servingUnit);
  if (!from || !to || from === to) return true;
  return getConversionFactor(to, from) !== null;
}

/**
 * How many of the reference servings `quantity` of `quantityUnit` is.
 * `totalServings` is the meal's recipe yield; foods leave it unset.
 * Compatible units are converted (1 oz against a gram serving). Incompatible
 * units stay on the raw quantity, matching the previous same-unit division.
 */
export function nutritionMultiplier(
  quantity: number | string | null | undefined,
  quantityUnit: string | null | undefined,
  servingSize: number | string | null | undefined,
  servingUnit: string | null | undefined,
  totalServings?: number | string | null
): number {
  const denominator =
    amountOrOne(servingSize) * amountOrOne(totalServings ?? 1);
  let amount = amountOrOne(quantity);
  const from = normalizeUnit(quantityUnit);
  const to = normalizeUnit(servingUnit);
  if (from && to && from !== to) {
    const factor = getConversionFactor(to, from);
    if (factor !== null) amount *= factor;
  }
  return amount / denominator;
}

/**
 * The serving whose unit the row can actually be scaled against.
 * Prefer the variant the plan saved, then the default, then any convertible
 * sibling. A "1 oz" row must not be divided into a 15 ml default serving.
 */
export function selectVariantForQuantity<T extends PlanFoodVariant>(
  variants: readonly T[],
  variantId: string | null | undefined,
  quantityUnit: string | null | undefined
): T | undefined {
  if (variants.length === 0) return undefined;

  const usable = (variant: T) =>
    unitsAreScalable(quantityUnit, variant.serving_unit);
  const assigned = variantId
    ? variants.find((variant) => variant.id === variantId)
    : undefined;
  if (assigned && usable(assigned)) return assigned;

  const defaultVariant = variants.find(
    (variant) => variant.is_default && usable(variant)
  );
  if (defaultVariant) return defaultVariant;

  const convertible = variants.find(usable);
  if (convertible) return convertible;

  return (
    assigned ?? variants.find((variant) => variant.is_default) ?? variants[0]
  );
}

/** Per-row calories and macros, in the assignment's own quantity and unit. */
export function scaleAssignmentNutrition(
  assignment: ScalableAssignment
): ScaledPlanNutrition {
  const scale = nutritionMultiplier(
    assignment.quantity,
    assignment.unit,
    assignment.serving_size,
    assignment.serving_unit,
    assignment.total_servings
  );
  const scaled = (value: number | string | null | undefined) =>
    (finiteNumber(value) ?? 0) * scale;
  return {
    calories: scaled(assignment.calories),
    protein: scaled(assignment.protein),
    carbs: scaled(assignment.carbs),
    fat: scaled(assignment.fat),
  };
}
