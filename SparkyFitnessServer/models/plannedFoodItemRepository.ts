// @ts-expect-error TS(7016): Could not find a declaration file for module 'pg-format'.
import format from 'pg-format';
import type {
  CreatePlannedFoodBody,
  CreatePlannedMealBody,
  UpdatePlannedFoodBody,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import { createFoodEntryMealWithClient } from './foodEntryMealRepository.js';
import {
  loadMealDetails,
  plannedCalories,
  plannedNutrition,
  scaledCalories,
  scaledNutrition,
  usableImages,
  type PlannedItemRow,
} from './plannedMealRepository.js';
import type { NutrientSource } from '@workspace/shared';

export type PlannedFoodStatus = 'planned' | 'added' | 'skipped';

export interface PlannedFoodItemRecord {
  id: string;
  plan_date: string;
  meal_type_id: string;
  /** Set for a food, null for a meal. */
  food_id: string | null;
  variant_id: string | null;
  /** Set for a meal, null for a food. */
  meal_id: string | null;
  quantity: number;
  unit: string;
  status: PlannedFoodStatus;
  food_entry_id: string | null;
  food_entry_meal_id: string | null;
}

interface PlannedFoodJoinRow {
  id: string;
  meal_type_id: string;
  meal_type_name: string | null;
  food_id: string | null;
  variant_id: string | null;
  meal_id: string | null;
  quantity: string | number;
  unit: string;
  food_name: string | null;
  food_brand: string | null;
  food_images: string[] | null;
  variant_calories: string | number | null;
  variant_serving_size: string | number | null;
  variant: NutrientSource | null;
  meal_name: string | null;
  meal_serving_size: string | number | null;
  meal_total_servings: string | number | null;
  meal_images: string[] | null;
}

const RECORD_COLUMNS = `id, to_char(plan_date, 'YYYY-MM-DD') AS plan_date, meal_type_id,
  food_id, variant_id, meal_id, quantity, unit, status, food_entry_id, food_entry_meal_id`;

function toRecord(row: Record<string, unknown>): PlannedFoodItemRecord {
  return {
    id: row.id as string,
    plan_date: row.plan_date as string,
    meal_type_id: row.meal_type_id as string,
    food_id: (row.food_id as string | null) ?? null,
    variant_id: (row.variant_id as string | null) ?? null,
    meal_id: (row.meal_id as string | null) ?? null,
    quantity: Number(row.quantity),
    unit: row.unit as string,
    status: row.status as PlannedFoodStatus,
    food_entry_id: (row.food_entry_id as string | null) ?? null,
    food_entry_meal_id: (row.food_entry_meal_id as string | null) ?? null,
  };
}

/** One-off foods and meals still planned for `day`, in the order they were planned. */
async function getOpenItemsForDay(
  userId: string,
  day: string
): Promise<PlannedItemRow[]> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT
         p.id,
         p.meal_type_id,
         mt.name AS meal_type_name,
         p.food_id,
         p.variant_id,
         p.meal_id,
         p.quantity,
         p.unit,
         f.name AS food_name,
         f.brand AS food_brand,
         f.images AS food_images,
         fv.calories AS variant_calories,
         fv.serving_size AS variant_serving_size,
         to_jsonb(fv) AS variant,
         m.name AS meal_name,
         m.serving_size AS meal_serving_size,
         m.total_servings AS meal_total_servings,
         m.images AS meal_images
       FROM planned_food_items p
       LEFT JOIN foods f ON f.id = p.food_id
       LEFT JOIN meals m ON m.id = p.meal_id
       LEFT JOIN meal_types mt ON mt.id = p.meal_type_id
       LEFT JOIN food_variants fv ON fv.id = p.variant_id
       WHERE p.user_id = $1 AND p.plan_date = $2 AND p.status = 'planned'
       ORDER BY p.created_at ASC, p.id ASC`,
      [userId, day]
    );
    const rows = result.rows as PlannedFoodJoinRow[];
    const mealIds = [
      ...new Set(rows.flatMap((row) => (row.meal_id ? [row.meal_id] : []))),
    ];
    const {
      componentsByMeal,
      componentCaloriesByMeal,
      componentNutritionByMeal,
      componentImagesByMeal,
    } = await loadMealDetails(client, mealIds);
    return rows.map((row): PlannedItemRow => {
      const quantity = Number(row.quantity);
      const figureRow = {
        item_type: row.meal_id ? ('meal' as const) : ('food' as const),
        quantity,
        variant: row.variant,
        variant_calories: row.variant_calories,
        variant_serving_size: row.variant_serving_size,
        meal_serving_size: row.meal_serving_size,
        meal_total_servings: row.meal_total_servings,
      };
      if (row.meal_id) {
        const ownImages = usableImages(row.meal_images);
        return {
          template_id: null,
          template_name: '',
          item_key: row.id,
          item_type: 'meal',
          meal_type_id: row.meal_type_id,
          meal_type_name: row.meal_type_name,
          meal_id: row.meal_id,
          food_id: null,
          variant_id: null,
          name: row.meal_name ?? '',
          brand: null,
          quantity,
          unit: row.unit,
          foods: componentsByMeal.get(row.meal_id) ?? [],
          calories: plannedCalories(
            figureRow,
            componentCaloriesByMeal.get(row.meal_id)
          ),
          nutrition: plannedNutrition(
            figureRow,
            componentNutritionByMeal.get(row.meal_id)
          ),
          images:
            ownImages.length > 0
              ? ownImages
              : (componentImagesByMeal.get(row.meal_id) ?? []),
        };
      }
      return {
        template_id: null,
        template_name: '',
        item_key: row.id,
        item_type: 'food',
        meal_type_id: row.meal_type_id,
        meal_type_name: row.meal_type_name,
        meal_id: null,
        food_id: row.food_id,
        variant_id: row.variant_id,
        name: row.food_name ?? '',
        brand: row.food_brand,
        quantity,
        unit: row.unit,
        foods: [],
        calories: scaledCalories(
          row.variant_calories,
          row.variant_serving_size,
          quantity
        ),
        nutrition: scaledNutrition(
          row.variant,
          row.variant_serving_size,
          quantity
        ),
        images: usableImages(row.food_images),
      };
    });
  } finally {
    client.release();
  }
}

async function getById(
  userId: string,
  id: string
): Promise<PlannedFoodItemRecord | null> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT ${RECORD_COLUMNS} FROM planned_food_items WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

/** True when the variant belongs to the food, so a plan never mixes the two. */
async function variantBelongsToFood(
  userId: string,
  foodId: string,
  variantId: string
): Promise<boolean> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      'SELECT 1 FROM food_variants WHERE id = $1 AND food_id = $2',
      [variantId, foodId]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

async function mealTypeExists(
  userId: string,
  mealTypeId: string
): Promise<boolean> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      'SELECT 1 FROM meal_types WHERE id = $1',
      [mealTypeId]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

async function create(
  userId: string,
  body: CreatePlannedFoodBody
): Promise<PlannedFoodItemRecord> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `INSERT INTO planned_food_items
         (user_id, plan_date, meal_type_id, food_id, variant_id, quantity, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${RECORD_COLUMNS}`,
      [
        userId,
        body.date,
        body.meal_type_id,
        body.food_id,
        body.variant_id,
        body.quantity,
        body.unit,
      ]
    );
    return toRecord(result.rows[0]);
  } finally {
    client.release();
  }
}

async function mealExists(userId: string, mealId: string): Promise<boolean> {
  const client = await getClient(userId);
  try {
    const result = await client.query('SELECT 1 FROM meals WHERE id = $1', [
      mealId,
    ]);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

async function createMeal(
  userId: string,
  body: CreatePlannedMealBody
): Promise<PlannedFoodItemRecord> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `INSERT INTO planned_food_items
         (user_id, plan_date, meal_type_id, meal_id, quantity, unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${RECORD_COLUMNS}`,
      [
        userId,
        body.date,
        body.meal_type_id,
        body.meal_id,
        body.quantity,
        body.unit,
      ]
    );
    return toRecord(result.rows[0]);
  } finally {
    client.release();
  }
}

/** Changes a still-planned item; null when it is gone or already acted on. */
async function update(
  userId: string,
  id: string,
  patch: UpdatePlannedFoodBody
): Promise<PlannedFoodItemRecord | null> {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `UPDATE planned_food_items SET
         meal_type_id = COALESCE($3, meal_type_id),
         variant_id = COALESCE($4, variant_id),
         quantity = COALESCE($5, quantity),
         unit = COALESCE($6, unit),
         updated_at = now()
       WHERE id = $1 AND user_id = $2 AND status = 'planned'
       RETURNING ${RECORD_COLUMNS}`,
      [
        id,
        userId,
        patch.meal_type_id ?? null,
        patch.variant_id ?? null,
        patch.quantity ?? null,
        patch.unit ?? null,
      ]
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

async function setStatus(
  userId: string,
  id: string,
  status: PlannedFoodStatus,
  foodEntryId: string | null = null
): Promise<void> {
  const client = await getClient(userId);
  try {
    await client.query(
      `UPDATE planned_food_items
       SET status = $3, food_entry_id = $4, food_entry_meal_id = NULL, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [id, userId, status, foodEntryId]
    );
  } finally {
    client.release();
  }
}

/**
 * Puts a one-off item back to planned. If an add wrote a diary entry, that one
 * entry is removed, so undo leaves no trace.
 */
async function restore(userId: string, id: string): Promise<void> {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM food_entries
       WHERE user_id = $1
         AND id = (SELECT food_entry_id FROM planned_food_items WHERE id = $2 AND user_id = $1)`,
      [userId, id]
    );
    // Its component foods go with it (ON DELETE CASCADE).
    await client.query(
      `DELETE FROM food_entry_meals
       WHERE user_id = $1
         AND id = (SELECT food_entry_meal_id FROM planned_food_items WHERE id = $2 AND user_id = $1)`,
      [userId, id]
    );
    await client.query(
      `UPDATE planned_food_items
       SET status = 'planned', food_entry_id = NULL, food_entry_meal_id = NULL, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export interface PlannedMealEntries {
  foodEntryMealId: string;
  foodEntryIds: string[];
}

/**
 * Logs a planned meal as a diary meal with a snapshot of each of its foods,
 * scaled like a meal plan does (quantity over serving size times total
 * servings), and marks the item added, all in one transaction.
 */
async function addMealToDiary(
  userId: string,
  item: PlannedFoodItemRecord,
  entryTime: string | null
): Promise<PlannedMealEntries | null> {
  if (!item.meal_id) return null;
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const mealResult = await client.query('SELECT * FROM meals WHERE id = $1', [
      item.meal_id,
    ]);
    const meal = mealResult.rows[0];
    if (!meal) {
      await client.query('ROLLBACK');
      return null;
    }
    const foods = await client.query(
      `SELECT mf.food_id, mf.variant_id, mf.quantity, mf.unit,
              f.name AS food_name, f.brand AS brand_name,
              to_jsonb(fv) AS variant
       FROM meal_foods mf
       JOIN foods f ON f.id = mf.food_id
       JOIN food_variants fv ON fv.id = mf.variant_id
       WHERE mf.meal_id = $1
       ORDER BY mf.created_at ASC, f.name ASC, mf.id ASC`,
      [item.meal_id]
    );
    if (foods.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const addedAt = new Date();
    const foodEntryMeal = await createFoodEntryMealWithClient(
      client,
      {
        user_id: userId,
        meal_template_id: item.meal_id,
        meal_type_id: item.meal_type_id,
        entry_date: item.plan_date,
        entry_time: entryTime,
        name: meal.name,
        description: meal.description || '',
        quantity: item.quantity,
        unit: item.unit,
        legacy_serving_unit_math: false,
        created_at: addedAt,
      },
      userId
    );
    const denominator =
      Number(meal.serving_size || 1) * Number(meal.total_servings || 1);
    const multiplier = denominator > 0 ? item.quantity / denominator : 1;
    const rows = (
      foods.rows as {
        food_id: string;
        variant_id: string;
        quantity: string | number;
        unit: string;
        food_name: string;
        brand_name: string | null;
        variant: Record<string, unknown>;
      }[]
    ).map((food) => {
      const v = food.variant;
      return [
        userId,
        food.food_id,
        item.meal_type_id,
        Number(food.quantity) * multiplier,
        food.unit,
        item.plan_date,
        food.variant_id,
        null,
        food.food_name,
        food.brand_name,
        v.serving_size,
        v.serving_unit,
        v.calories,
        v.protein,
        v.carbs,
        v.fat,
        v.saturated_fat,
        v.polyunsaturated_fat,
        v.monounsaturated_fat,
        v.trans_fat,
        v.cholesterol,
        v.sodium,
        v.potassium,
        v.dietary_fiber,
        v.sugars,
        v.vitamin_a,
        v.vitamin_c,
        v.calcium,
        v.iron,
        null,
        userId,
        foodEntryMeal.id,
        v.custom_nutrients ?? {},
        v.caffeine_mg,
        v.water_ml,
        v.alcohol_g,
        addedAt,
        entryTime,
      ];
    });
    const inserted = await client.query(
      format(
        `INSERT INTO food_entries (
           user_id, food_id, meal_type_id, quantity, unit, entry_date, variant_id, meal_plan_template_id,
           food_name, brand_name, serving_size, serving_unit,
           calories, protein, carbs, fat,
           saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
           cholesterol, sodium, potassium, dietary_fiber, sugars,
           vitamin_a, vitamin_c, calcium, iron, meal_id, created_by_user_id, food_entry_meal_id, custom_nutrients, caffeine_mg, water_ml, alcohol_g, created_at, entry_time
         ) VALUES %L RETURNING id`,
        rows
      )
    );
    await client.query(
      `UPDATE planned_food_items
       SET status = 'added', food_entry_id = NULL, food_entry_meal_id = $3, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [item.id, userId, foodEntryMeal.id]
    );
    await client.query('COMMIT');
    return {
      foodEntryMealId: foodEntryMeal.id,
      foodEntryIds: inserted.rows.map((row: { id: string }) => row.id),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteEntry(userId: string, entryId: string): Promise<void> {
  const client = await getClient(userId);
  try {
    await client.query(
      'DELETE FROM food_entries WHERE id = $1 AND user_id = $2',
      [entryId, userId]
    );
  } finally {
    client.release();
  }
}

export {
  getOpenItemsForDay,
  getById,
  variantBelongsToFood,
  mealTypeExists,
  mealExists,
  create,
  createMeal,
  update,
  setStatus,
  restore,
  addMealToDiary,
  deleteEntry,
};
export default {
  getOpenItemsForDay,
  getById,
  variantBelongsToFood,
  mealTypeExists,
  mealExists,
  create,
  createMeal,
  update,
  setStatus,
  restore,
  addMealToDiary,
  deleteEntry,
};
