import { getClient } from '../db/poolManager.js';
import { log } from '../config/logging.js';
import type { FoodEntryTimeChange } from '@workspace/shared';

/**
 * Sets entry_time on logged foods and logged meals, and nothing else.
 *
 * The diary sorts a meal by time, so reordering it means re-timing rows.
 * The ordinary update routes are not used for this: a web food-entry edit
 * refreshes the nutrition snapshot from the library, and a time-only edit of
 * a logged meal leaves its component foods on the old time (fasting and
 * caffeine read the component rows). This writes every change in one
 * transaction, carries a meal's time to its components, and rolls back if
 * any entry is missing, so a reorder lands whole or not at all.
 */
export async function setFoodEntryTimes(
  ownerUserId: string,
  actingUserId: string,
  changes: FoodEntryTimeChange[]
): Promise<number> {
  const client = await getClient(ownerUserId, actingUserId);
  const foodChanges = changes.filter((c) => c.kind === 'foodEntry');
  const mealChanges = changes.filter((c) => c.kind === 'foodEntryMeal');
  try {
    await client.query('BEGIN');
    let updated = 0;

    if (foodChanges.length > 0) {
      const result = await client.query(
        `UPDATE food_entries fe
            SET entry_time = c.entry_time::time,
                updated_by_user_id = $2
           FROM unnest($3::uuid[], $4::text[]) AS c(id, entry_time)
          WHERE fe.id = c.id AND fe.user_id = $1`,
        [
          ownerUserId,
          actingUserId,
          foodChanges.map((c) => c.id),
          foodChanges.map((c) => c.entry_time),
        ]
      );
      updated += result.rowCount ?? 0;
    }

    if (mealChanges.length > 0) {
      const ids = mealChanges.map((c) => c.id);
      const times = mealChanges.map((c) => c.entry_time);
      const result = await client.query(
        `UPDATE food_entry_meals fem
            SET entry_time = c.entry_time::time,
                updated_at = CURRENT_TIMESTAMP,
                updated_by_user_id = $2
           FROM unnest($3::uuid[], $4::text[]) AS c(id, entry_time)
          WHERE fem.id = c.id AND fem.user_id = $1`,
        [ownerUserId, actingUserId, ids, times]
      );
      updated += result.rowCount ?? 0;
      // The meal's foods carry its time; keep them on the same clock.
      await client.query(
        `UPDATE food_entries fe
            SET entry_time = c.entry_time::time,
                updated_by_user_id = $2
           FROM unnest($3::uuid[], $4::text[]) AS c(id, entry_time)
          WHERE fe.food_entry_meal_id = c.id AND fe.user_id = $1`,
        [ownerUserId, actingUserId, ids, times]
      );
    }

    if (updated !== changes.length) {
      await client.query('ROLLBACK');
      const error: Error & { statusCode?: number } = new Error(
        'One or more diary entries were not found.'
      );
      error.statusCode = 404;
      throw error;
    }

    await client.query('COMMIT');
    return updated;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 404) {
      await client.query('ROLLBACK').catch(() => undefined);
      log('error', 'setFoodEntryTimes failed:', error);
    }
    throw error;
  } finally {
    client.release();
  }
}
