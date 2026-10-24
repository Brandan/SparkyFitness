import { getClient } from '../db/poolManager.js';
import {
  assignPlannedItemKeys,
  plannedItemBaseKey,
  plannedItemKey,
} from '../utils/plannedItemKey.js';
import {
  addPlannedNutrition,
  emptyPlannedNutrition,
  scalePlannedNutrition,
  type NutrientSource,
  type PlannedNutrition,
} from '@workspace/shared';

export type PlannedOccurrenceStatus = 'added' | 'skipped';

export interface PlannedItemRow {
  /** Null for a one-off food planned outside any meal plan. */
  template_id: string | null;
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
  /** Calories Add to diary will write; null when a variant is missing. */
  calories: number | null;
  /** Every nutrient Add to diary will write; null when a variant is missing. */
  nutrition: PlannedNutrition | null;
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
  variant_calories: string | number | null;
  variant_serving_size: string | number | null;
  /** The whole food_variants row, null when the variant is missing. */
  variant: NutrientSource | null;
  meal_serving_size: string | number | null;
  meal_total_servings: string | number | null;
  meal_images: string[] | null;
  food_images: string[] | null;
}

interface MealFoodRow {
  meal_id: string;
  name: string;
  quantity: string | number;
  unit: string;
  images: string[] | null;
  variant_calories: string | number | null;
  variant_serving_size: string | number | null;
  variant: NutrientSource | null;
}

export const usableImages = (images: string[] | null | undefined): string[] =>
  Array.isArray(images)
    ? images.filter((image) => typeof image === 'string' && image.trim() !== '')
    : [];

/** Calories of `quantity` of a variant that lists `calories` per `servingSize`. */
export function scaledCalories(
  calories: string | number | null,
  servingSize: string | number | null,
  quantity: number
): number | null {
  const perServing = Number(servingSize);
  if (calories === null || !(perServing > 0)) return null;
  return (Number(calories) * quantity) / perServing;
}

/** Sums calories, staying null once any part is unknown. */
function addCalories(total: number | null, part: number | null): number | null {
  return total === null || part === null ? null : total + part;
}

/** Nutrients of `quantity` of a variant, or null when the variant is missing. */
export function scaledNutrition(
  variant: NutrientSource | null,
  servingSize: string | number | null,
  quantity: number
): PlannedNutrition | null {
  const perServing = Number(servingSize);
  if (!variant || !(perServing > 0)) return null;
  return scalePlannedNutrition(variant, quantity / perServing);
}

/** Sums nutrition, staying null once any part is unknown. */
function addNutrition(
  total: PlannedNutrition | null,
  part: PlannedNutrition | null
): PlannedNutrition | null {
  return total === null || part === null
    ? null
    : addPlannedNutrition(total, part);
}

/** Scale factor from one pass over a meal's foods to the planned quantity. */
function mealScale(row: PlannedAssignmentRow): number {
  const denominator =
    Number(row.meal_serving_size || 1) * Number(row.meal_total_servings || 1);
  return denominator > 0 ? Number(row.quantity ?? 1) / denominator : 1;
}

/** Like `plannedCalories`, for every nutrient. */
function plannedNutrition(
  row: PlannedAssignmentRow,
  mealFoodsNutrition: PlannedNutrition | null | undefined
): PlannedNutrition | null {
  if (row.item_type === 'food') {
    return scaledNutrition(
      row.variant,
      row.variant_serving_size,
      Number(row.quantity ?? 1)
    );
  }
  if (!mealFoodsNutrition) return null;
  return scalePlannedNutrition(mealFoodsNutrition, mealScale(row));
}

/**
 * What "Add to diary" will write, worked out like the entries themselves: a food
 * scales its variant by quantity over serving size; a meal scales its foods by
 * quantity over (serving size x total servings).
 */
function plannedCalories(
  row: PlannedAssignmentRow,
  mealFoodsCalories: number | null | undefined
): number | null {
  const quantity = Number(row.quantity ?? 1);
  if (row.item_type === 'food') {
    return scaledCalories(
      row.variant_calories,
      row.variant_serving_size,
      quantity
    );
  }
  if (mealFoodsCalories === undefined || mealFoodsCalories === null) {
    return null;
  }
  const denominator =
    Number(row.meal_serving_size || 1) * Number(row.meal_total_servings || 1);
  return denominator > 0
    ? (mealFoodsCalories * quantity) / denominator
    : mealFoodsCalories;
}

interface LoggedCopyRow {
  template_id: string;
  meal_type_id: string;
  item_type: 'meal' | 'food';
  subject_id: string | null;
  variant_id: string | null;
  entry_count: string | number;
}

/**
 * Diary rows this plan already wrote, minus copies an "added" occurrence
 * accounts for. What remains was written by auto-add (a plan switched to
 * "show as planned" keeps today's entries) and hides that many copies, in
 * plan order, so one logged scoop does not hide the other scoops.
 */
function unexplainedLoggedCopies(
  loggedRows: LoggedCopyRow[],
  occurrences: { template_id: string; item_key: string; status: string }[]
): Map<string, number> {
  const logged = new Map<string, number>();
  for (const row of loggedRows) {
    if (!row.subject_id) continue;
    const base = plannedItemKey({
      item_type: row.item_type,
      meal_type_id: row.meal_type_id,
      meal_id: row.item_type === 'meal' ? row.subject_id : null,
      food_id: row.item_type === 'food' ? row.subject_id : null,
      variant_id: row.variant_id,
    });
    const identity = `${row.template_id}|${base}`;
    logged.set(identity, (logged.get(identity) ?? 0) + Number(row.entry_count));
  }
  const added = new Map<string, number>();
  for (const row of occurrences) {
    if (row.status !== 'added') continue;
    const identity = `${row.template_id}|${plannedItemBaseKey(row.item_key)}`;
    added.set(identity, (added.get(identity) ?? 0) + 1);
  }
  const unexplained = new Map<string, number>();
  for (const [identity, count] of logged) {
    const extra = count - (added.get(identity) ?? 0);
    if (extra > 0) unexplained.set(identity, extra);
  }
  return unexplained;
}

/**
 * Items of active "show as planned" meal plans that fall on `day` (with its
 * weekday `weekday`, 0 = Sunday) and that the person has not yet added to the
 * diary or skipped. The same food planned twice is two items. Copies already
 * written for that day by auto-add are left out so nothing shows twice.
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
         fv.calories AS variant_calories,
         fv.serving_size AS variant_serving_size,
         to_jsonb(fv) AS variant,
         m.serving_size AS meal_serving_size,
         m.total_servings AS meal_total_servings,
         m.images AS meal_images,
         f.images AS food_images
       FROM meal_plan_templates t
       JOIN meal_plan_template_assignments a ON a.template_id = t.id
       LEFT JOIN meal_types mt ON mt.id = a.meal_type_id
       LEFT JOIN meals m ON m.id = a.meal_id
       LEFT JOIN foods f ON f.id = a.food_id
       LEFT JOIN food_variants fv ON fv.id = a.variant_id
       WHERE t.user_id = $1
         AND t.is_active = TRUE
         AND t.auto_log = FALSE
         AND t.start_date <= $2
         AND (t.end_date IS NULL OR t.end_date >= $2)
         AND a.day_of_week = $3
       ORDER BY mt.sort_order ASC, t.start_date ASC, a.sort_order ASC, a.id ASC`,
      [userId, day, weekday]
    );
    const assignmentRows = assignmentResult.rows as PlannedAssignmentRow[];

    const handled = await client.query(
      `SELECT template_id, item_key, status
       FROM meal_plan_occurrences
       WHERE user_id = $1 AND plan_date = $2`,
      [userId, day]
    );
    const occurrences = handled.rows as {
      template_id: string;
      item_key: string;
      status: string;
    }[];
    const handledKeys = new Set(
      occurrences.map((row) => `${row.template_id}|${row.item_key}`)
    );
    // Standalone foods count as themselves. Foods inside a logged meal count
    // as that meal, once, so one meal does not look like several foods.
    const logged = await client.query(
      `SELECT
         fe.meal_plan_template_id AS template_id,
         fe.meal_type_id,
         CASE WHEN fe.food_entry_meal_id IS NULL THEN 'food' ELSE 'meal' END AS item_type,
         CASE
           WHEN fe.food_entry_meal_id IS NULL THEN fe.food_id
           ELSE fem.meal_template_id
         END AS subject_id,
         CASE WHEN fe.food_entry_meal_id IS NULL THEN fe.variant_id ELSE NULL END AS variant_id,
         COUNT(DISTINCT COALESCE(fe.food_entry_meal_id, fe.id))::int AS entry_count
       FROM food_entries fe
       LEFT JOIN food_entry_meals fem ON fem.id = fe.food_entry_meal_id
       WHERE fe.user_id = $1
         AND fe.entry_date = $2
         AND fe.meal_plan_template_id IS NOT NULL
         AND (fe.food_entry_meal_id IS NULL OR fem.meal_template_id IS NOT NULL)
       GROUP BY 1, 2, 3, 4, 5`,
      [userId, day]
    );
    const unexplained = unexplainedLoggedCopies(
      logged.rows as LoggedCopyRow[],
      occurrences
    );

    const open = assignPlannedItemKeys(
      assignmentRows,
      (row) => row.template_id
    ).flatMap(({ item: row, itemKey }) => {
      const identity = `${row.template_id}|${itemKey}`;
      if (handledKeys.has(identity)) return [];
      const baseIdentity = `${row.template_id}|${plannedItemBaseKey(itemKey)}`;
      const leftover = unexplained.get(baseIdentity) ?? 0;
      if (leftover > 0) {
        unexplained.set(baseIdentity, leftover - 1);
        return [];
      }
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
    // Calories of one full pass over a meal's foods, before scaling to the plan.
    const componentCaloriesByMeal = new Map<string, number | null>();
    const componentNutritionByMeal = new Map<string, PlannedNutrition | null>();
    const componentImagesByMeal = new Map<string, string[]>();
    if (mealIds.length > 0) {
      const components = await client.query(
        `SELECT mf.meal_id, f.name, mf.quantity, mf.unit, f.images,
                fv.calories AS variant_calories,
                fv.serving_size AS variant_serving_size,
                to_jsonb(fv) AS variant
         FROM meal_foods mf
         JOIN foods f ON f.id = mf.food_id
         LEFT JOIN food_variants fv ON fv.id = mf.variant_id
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
        componentCaloriesByMeal.set(
          component.meal_id,
          addCalories(
            componentCaloriesByMeal.has(component.meal_id)
              ? (componentCaloriesByMeal.get(component.meal_id) ?? null)
              : 0,
            scaledCalories(
              component.variant_calories,
              component.variant_serving_size,
              Number(component.quantity)
            )
          )
        );
        componentNutritionByMeal.set(
          component.meal_id,
          addNutrition(
            componentNutritionByMeal.has(component.meal_id)
              ? (componentNutritionByMeal.get(component.meal_id) ?? null)
              : emptyPlannedNutrition(),
            scaledNutrition(
              component.variant,
              component.variant_serving_size,
              Number(component.quantity)
            )
          )
        );
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
      calories: plannedCalories(
        row,
        row.meal_id ? componentCaloriesByMeal.get(row.meal_id) : undefined
      ),
      nutrition: plannedNutrition(
        row,
        row.meal_id ? componentNutritionByMeal.get(row.meal_id) : undefined
      ),
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
