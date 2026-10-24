import type {
  CreatePlannedFoodBody,
  UpdatePlannedFoodBody,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import {
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
  food_id: string;
  variant_id: string;
  quantity: number;
  unit: string;
  status: PlannedFoodStatus;
  food_entry_id: string | null;
}

interface PlannedFoodJoinRow {
  id: string;
  meal_type_id: string;
  meal_type_name: string | null;
  food_id: string;
  variant_id: string;
  quantity: string | number;
  unit: string;
  food_name: string;
  food_brand: string | null;
  food_images: string[] | null;
  variant_calories: string | number | null;
  variant_serving_size: string | number | null;
  variant: NutrientSource | null;
}

const RECORD_COLUMNS = `id, to_char(plan_date, 'YYYY-MM-DD') AS plan_date, meal_type_id,
  food_id, variant_id, quantity, unit, status, food_entry_id`;

function toRecord(row: Record<string, unknown>): PlannedFoodItemRecord {
  return {
    id: row.id as string,
    plan_date: row.plan_date as string,
    meal_type_id: row.meal_type_id as string,
    food_id: row.food_id as string,
    variant_id: row.variant_id as string,
    quantity: Number(row.quantity),
    unit: row.unit as string,
    status: row.status as PlannedFoodStatus,
    food_entry_id: (row.food_entry_id as string | null) ?? null,
  };
}

/** One-off foods still planned for `day`, in the order they were planned. */
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
         p.quantity,
         p.unit,
         f.name AS food_name,
         f.brand AS food_brand,
         f.images AS food_images,
         fv.calories AS variant_calories,
         fv.serving_size AS variant_serving_size,
         to_jsonb(fv) AS variant
       FROM planned_food_items p
       JOIN foods f ON f.id = p.food_id
       LEFT JOIN meal_types mt ON mt.id = p.meal_type_id
       LEFT JOIN food_variants fv ON fv.id = p.variant_id
       WHERE p.user_id = $1 AND p.plan_date = $2 AND p.status = 'planned'
       ORDER BY p.created_at ASC, p.id ASC`,
      [userId, day]
    );
    return (result.rows as PlannedFoodJoinRow[]).map((row) => {
      const quantity = Number(row.quantity);
      return {
        template_id: null,
        template_name: '',
        item_key: row.id,
        item_type: 'food' as const,
        meal_type_id: row.meal_type_id,
        meal_type_name: row.meal_type_name,
        meal_id: null,
        food_id: row.food_id,
        variant_id: row.variant_id,
        name: row.food_name,
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
       SET status = $3, food_entry_id = $4, updated_at = now()
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
    await client.query(
      `UPDATE planned_food_items
       SET status = 'planned', food_entry_id = NULL, updated_at = now()
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
  create,
  update,
  setStatus,
  restore,
  deleteEntry,
};
export default {
  getOpenItemsForDay,
  getById,
  variantBelongsToFood,
  mealTypeExists,
  create,
  update,
  setStatus,
  restore,
  deleteEntry,
};
