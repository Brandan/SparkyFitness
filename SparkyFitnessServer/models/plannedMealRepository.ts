import { getClient } from '../db/poolManager.js';
import { plannedItemKey } from '../utils/plannedItemKey.js';

export type PlannedOccurrenceStatus = 'added' | 'skipped';

export interface PlannedItemRow {
  template_id: string;
  template_name: string;
  item_key: string;
  item_type: 'meal' | 'food';
  meal_type_id: string;
  meal_type_name: string | null;
  meal_id: string | null;
  food_id: string | null;
  variant_id: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  foods: { name: string; quantity: number; unit: string }[];
  /** Picture(s) to show: the meal's or food's own, else the first food in the meal that has one. */
  images: string[];
}

interface PlannedAssignmentRow {
  template_id: string;
  template_name: string;
  item_type: 'meal' | 'food';
  meal_type_id: string;
  meal_type_name: string | null;
  meal_id: string | null;
  food_id: string | null;
  variant_id: string | null;
  quantity: string | number | null;
  unit: string | null;
  meal_name: string | null;
  food_name: string | null;
  food_brand: string | null;
  meal_images: string[] | null;
  food_images: string[] | null;
}

interface MealFoodRow {
  meal_id: string;
  name: string;
  quantity: string | number;
  unit: string;
  images: string[] | null;
}

const usableImages = (images: string[] | null | undefined): string[] =>
  Array.isArray(images)
    ? images.filter((image) => typeof image === 'string' && image.trim() !== '')
    : [];

/**
 * Items of active "show as planned" meal plans that fall on `day` (with its
 * weekday `weekday`, 0 = Sunday) and that the person has not yet added to the
 * diary or skipped. Plans whose entries were already written for that day (a
 * plan switched from auto-add) are left out so nothing shows twice.
 */
async function getPlannedItemsForDay(
  userId: string,
  day: string,
  weekday: number
): Promise<PlannedItemRow[]> {
  const client = await getClient(userId);
  try {
    const assignmentResult = await client.query(
      `SELECT
         t.id AS template_id,
         t.plan_name AS template_name,
         a.item_type,
         a.meal_type_id,
         mt.name AS meal_type_name,
         a.meal_id,
         a.food_id,
         a.variant_id,
         a.quantity,
         a.unit,
         m.name AS meal_name,
         f.name AS food_name,
         f.brand AS food_brand,
         m.images AS meal_images,
         f.images AS food_images
       FROM meal_plan_templates t
       JOIN meal_plan_template_assignments a ON a.template_id = t.id
       LEFT JOIN meal_types mt ON mt.id = a.meal_type_id
       LEFT JOIN meals m ON m.id = a.meal_id
       LEFT JOIN foods f ON f.id = a.food_id
       WHERE t.user_id = $1
         AND t.is_active = TRUE
         AND t.auto_log = FALSE
         AND t.start_date <= $2
         AND (t.end_date IS NULL OR t.end_date >= $2)
         AND a.day_of_week = $3
         AND NOT EXISTS (
           SELECT 1 FROM food_entries fe
           WHERE fe.user_id = t.user_id
             AND fe.meal_plan_template_id = t.id
             AND fe.entry_date = $2
             AND fe.meal_type_id = a.meal_type_id
             AND (
               (a.item_type = 'food'
                 AND fe.food_id = a.food_id
                 AND fe.variant_id IS NOT DISTINCT FROM a.variant_id)
               OR (a.item_type = 'meal'
                 AND fe.food_entry_meal_id IN (
                   SELECT fem.id FROM food_entry_meals fem
                   WHERE fem.meal_template_id = a.meal_id
                     AND fem.entry_date = $2
                     AND fem.meal_type_id = a.meal_type_id))
             )
         )
       ORDER BY mt.sort_order ASC, t.start_date ASC, a.id ASC`,
      [userId, day, weekday]
    );
    const assignmentRows = assignmentResult.rows as PlannedAssignmentRow[];

    const handled = await client.query(
      `SELECT template_id, item_key
       FROM meal_plan_occurrences
       WHERE user_id = $1 AND plan_date = $2`,
      [userId, day]
    );
    const handledKeys = new Set(
      (handled.rows as { template_id: string; item_key: string }[]).map(
        (row) => `${row.template_id}|${row.item_key}`
      )
    );

    const seen = new Set<string>();
    const open = assignmentRows.flatMap((row) => {
      const itemKey = plannedItemKey(row);
      const identity = `${row.template_id}|${itemKey}`;
      if (handledKeys.has(identity) || seen.has(identity)) return [];
      seen.add(identity);
      return [{ row, itemKey }];
    });

    const mealIds = [
      ...new Set(
        open.flatMap(({ row }) =>
          row.item_type === 'meal' && row.meal_id ? [row.meal_id] : []
        )
      ),
    ];
    const componentsByMeal = new Map<string, PlannedItemRow['foods']>();
    const componentImagesByMeal = new Map<string, string[]>();
    if (mealIds.length > 0) {
      const components = await client.query(
        `SELECT mf.meal_id, f.name, mf.quantity, mf.unit, f.images
         FROM meal_foods mf
         JOIN foods f ON f.id = mf.food_id
         WHERE mf.meal_id = ANY($1::uuid[])
         ORDER BY mf.created_at ASC, f.name ASC, mf.id ASC`,
        [mealIds]
      );
      for (const component of components.rows as MealFoodRow[]) {
        const list = componentsByMeal.get(component.meal_id) ?? [];
        list.push({
          name: component.name,
          quantity: Number(component.quantity),
          unit: component.unit,
        });
        componentsByMeal.set(component.meal_id, list);
        // A meal with no picture of its own shows its first food that has one.
        const componentImages = usableImages(component.images);
        if (
          componentImages.length > 0 &&
          !componentImagesByMeal.has(component.meal_id)
        ) {
          componentImagesByMeal.set(component.meal_id, componentImages);
        }
      }
    }

    return open.map(({ row, itemKey }) => ({
      template_id: row.template_id,
      template_name: row.template_name,
      item_key: itemKey,
      item_type: row.item_type,
      meal_type_id: row.meal_type_id,
      meal_type_name: row.meal_type_name,
      meal_id: row.meal_id,
      food_id: row.food_id,
      variant_id: row.variant_id,
      name:
        (row.item_type === 'meal' ? row.meal_name : row.food_name) ??
        row.template_name,
      brand: row.item_type === 'food' ? row.food_brand : null,
      quantity: Number(row.quantity ?? 1),
      unit: row.unit ?? 'serving',
      foods:
        row.item_type === 'meal' && row.meal_id
          ? (componentsByMeal.get(row.meal_id) ?? [])
          : [],
      images:
        row.item_type === 'meal'
          ? usableImages(row.meal_images).length > 0
            ? usableImages(row.meal_images)
            : (row.meal_id && componentImagesByMeal.get(row.meal_id)) || []
          : usableImages(row.food_images),
    }));
  } finally {
    client.release();
  }
}

async function recordOccurrence(
  userId: string,
  templateId: string,
  day: string,
  itemKey: string,
  status: PlannedOccurrenceStatus
): Promise<void> {
  const client = await getClient(userId);
  try {
    await client.query(
      `INSERT INTO meal_plan_occurrences (user_id, template_id, plan_date, item_key, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (template_id, plan_date, item_key)
       DO UPDATE SET status = EXCLUDED.status`,
      [userId, templateId, day, itemKey, status]
    );
  } finally {
    client.release();
  }
}

async function removeOccurrence(
  userId: string,
  templateId: string,
  day: string,
  itemKey: string
): Promise<void> {
  const client = await getClient(userId);
  try {
    await client.query(
      `DELETE FROM meal_plan_occurrences
       WHERE user_id = $1 AND template_id = $2 AND plan_date = $3 AND item_key = $4`,
      [userId, templateId, day, itemKey]
    );
  } finally {
    client.release();
  }
}

/** Removes entries a planned item just wrote, so "Undo" leaves no trace. */
async function deleteCreatedEntries(
  userId: string,
  day: string,
  templateId: string,
  foodEntryIds: string[],
  foodEntryMealIds: string[]
): Promise<void> {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM food_entries
       WHERE user_id = $1 AND entry_date = $2 AND meal_plan_template_id = $3
         AND id = ANY($4::uuid[])`,
      [userId, day, templateId, foodEntryIds]
    );
    await client.query(
      `DELETE FROM food_entry_meals
       WHERE user_id = $1 AND entry_date = $2 AND id = ANY($3::uuid[])`,
      [userId, day, foodEntryMealIds]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export {
  getPlannedItemsForDay,
  recordOccurrence,
  removeOccurrence,
  deleteCreatedEntries,
};
export default {
  getPlannedItemsForDay,
  recordOccurrence,
  removeOccurrence,
  deleteCreatedEntries,
};
