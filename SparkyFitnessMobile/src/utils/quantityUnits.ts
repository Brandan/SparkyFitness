import { getConversionFactor, getUnitCategory } from '@workspace/shared';

/**
 * Units offered when entering a food quantity, per measurement category. A
 * food's own unit is always included first if it is not in the list (mg, or an
 * alias such as `lbs`). Quantity-style units (serving, piece, ...) have no
 * automatic conversion and offer nothing.
 */
const QUANTITY_UNIT_CHOICES = {
  weight: ['g', 'oz', 'lb', 'kg'],
  volume: ['ml', 'fl oz', 'cup', 'tbsp', 'tsp', 'l'],
} as const;

const UNIT_ALIASES: Record<string, string> = {
  lbs: 'lb',
  cups: 'cup',
  liter: 'l',
  liters: 'l',
  floz: 'fl oz',
  fl_oz: 'fl oz',
};

/** How far the +/- buttons move while entering in a unit other than the food's own. */
const QUANTITY_UNIT_STEP: Record<string, number> = {
  g: 5,
  oz: 0.5,
  lb: 0.25,
  kg: 0.1,
  ml: 10,
  'fl oz': 0.5,
  cup: 0.25,
  tbsp: 0.5,
  tsp: 0.5,
  l: 0.1,
};

export function canonicalQuantityUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  return UNIT_ALIASES[normalized] ?? normalized;
}

/** Units a quantity can be entered in for a food measured in `baseUnit`; empty when none convert. */
export function quantityUnitChoices(
  baseUnit: string | null | undefined
): string[] {
  if (!baseUnit) return [];
  const category = getUnitCategory(baseUnit);
  if (!category) return [];
  const base = canonicalQuantityUnit(baseUnit);
  const choices: readonly string[] = QUANTITY_UNIT_CHOICES[category];
  return choices.includes(base) ? [...choices] : [base, ...choices];
}

export function quantityUnitStep(unit: string): number {
  return QUANTITY_UNIT_STEP[canonicalQuantityUnit(unit)] ?? 1;
}

/** Converts an amount between two compatible units; returned unchanged when they are not. */
export function convertQuantity(
  value: number,
  fromUnit: string,
  toUnit: string
): number {
  const factor = getConversionFactor(fromUnit, toUnit);
  return factor ? value / factor : value;
}

/** Two decimals, trailing zeros dropped: 11.85, 12. */
export function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}
