/** How many nutrients beside calories a phone-width entry row shows. */
export const MOBILE_ENTRY_NUTRIENT_LIMIT = 4;

export const MOBILE_NUTRIENT_LABEL_OVERRIDES: Record<
  string,
  { label: string; defaultLabel: string }
> = {
  carbs: { label: 'nutrition.carbs', defaultLabel: 'Carbs' },
  dietary_fiber: { label: 'nutrition.fiber', defaultLabel: 'Fiber' },
};
