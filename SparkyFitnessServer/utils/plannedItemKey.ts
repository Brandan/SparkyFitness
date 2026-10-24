export interface PlannedItemKeyParts {
  item_type: string;
  meal_type_id: string;
  meal_id?: string | null;
  food_id?: string | null;
  variant_id?: string | null;
}

/**
 * Stable identity of one plan item on a weekday. It is built from what the
 * item is, not from the assignment row id, so it survives editing the plan
 * (which recreates the assignment rows).
 */
export function plannedItemKey(item: PlannedItemKeyParts): string {
  const subject = item.item_type === 'meal' ? item.meal_id : item.food_id;
  return [
    item.item_type,
    item.meal_type_id,
    subject ?? '',
    item.variant_id ?? '',
  ].join(':');
}
