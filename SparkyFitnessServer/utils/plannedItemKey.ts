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
 *
 * The same food can be on a meal more than once. `occurrence` is that copy's
 * place among identical items (0, 1, 2, …) in plan order. The first copy keeps
 * the unsuffixed key so an add or skip recorded before copies were distinct
 * still matches it. Later copies append `:${occurrence}`.
 */
export function plannedItemKey(
  item: PlannedItemKeyParts,
  occurrence = 0
): string {
  const subject = item.item_type === 'meal' ? item.meal_id : item.food_id;
  const base = [
    item.item_type,
    item.meal_type_id,
    subject ?? '',
    item.variant_id ?? '',
  ].join(':');
  if (!Number.isInteger(occurrence) || occurrence <= 0) return base;
  return `${base}:${occurrence}`;
}

/** Key without the copy suffix, so every copy of one food shares it. */
export function plannedItemBaseKey(itemKey: string): string {
  const parts = itemKey.split(':');
  const last = parts[parts.length - 1];
  if (parts.length >= 5 && last !== undefined && /^\d+$/.test(last)) {
    return parts.slice(0, -1).join(':');
  }
  return itemKey;
}

/**
 * Gives each item its key, numbering copies of the same food within `groupOf`
 * (a template, and a weekday when one list spans the week) in list order.
 */
export function assignPlannedItemKeys<T extends PlannedItemKeyParts>(
  items: readonly T[],
  groupOf: (item: T) => string = () => ''
): { item: T; itemKey: string }[] {
  const counts = new Map<string, number>();
  return items.map((item) => {
    const base = plannedItemKey(item);
    const bucket = `${groupOf(item)}|${base}`;
    const occurrence = counts.get(bucket) ?? 0;
    counts.set(bucket, occurrence + 1);
    return { item, itemKey: plannedItemKey(item, occurrence) };
  });
}
