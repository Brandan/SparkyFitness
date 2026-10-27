import { dayOfWeek } from '@workspace/shared';
import type {
  AddedPlannedMeal,
  CreatePlannedFoodBody,
  UpdatePlannedFoodBody,
  PlannedMealActionBody,
  PlannedMealItem,
  PlannedMealRestoreBody,
} from '@workspace/shared';
import { createFoodEntriesFromTemplate } from '../models/foodTemplate.js';
import { createFoodEntry } from '../models/foodEntry.js';
import { setFoodEntryTimes } from '../models/foodEntryTimeRepository.js';
import plannedFoodItemRepository from '../models/plannedFoodItemRepository.js';
import plannedMealRepository from '../models/plannedMealRepository.js';
import { clearUserTdeeCache } from './AdaptiveTdeeService.js';
import { ValidationError } from '../utils/errors.js';

export class PlannedMealNotFoundError extends Error {
  constructor() {
    super('That planned item is no longer on the plan.');
    this.name = 'PlannedMealNotFoundError';
  }
}

/**
 * What is planned on `day` and not yet added or skipped: items of "show as
 * planned" plans, then one-off foods the person planned on their own.
 */
async function getPlannedMeals(
  userId: string,
  day: string
): Promise<PlannedMealItem[]> {
  const [fromPlans, oneOffs] = await Promise.all([
    plannedMealRepository.getPlannedItemsForDay(userId, day, dayOfWeek(day)),
    plannedFoodItemRepository.getOpenItemsForDay(userId, day),
  ]);
  return [...fromPlans, ...oneOffs];
}

async function requirePlannedItem(
  userId: string,
  { template_id, date, item_key }: PlannedMealActionBody
): Promise<PlannedMealItem> {
  const items = await getPlannedMeals(userId, date);
  const item = items.find(
    (candidate) =>
      candidate.template_id === template_id && candidate.item_key === item_key
  );
  if (!item) throw new PlannedMealNotFoundError();
  return item;
}

/** Logs a one-off planned food as a diary entry and remembers which one. */
async function addPlannedFood(
  userId: string,
  body: PlannedMealActionBody
): Promise<AddedPlannedMeal> {
  const item = await plannedFoodItemRepository.getById(userId, body.item_key);
  if (!item || item.status !== 'planned' || item.plan_date !== body.date) {
    throw new PlannedMealNotFoundError();
  }
  const entry = await createFoodEntry(
    {
      user_id: userId,
      food_id: item.food_id,
      variant_id: item.variant_id,
      meal_type_id: item.meal_type_id,
      quantity: item.quantity,
      unit: item.unit,
      entry_date: item.plan_date,
      entry_time: body.entry_time ?? null,
    },
    userId
  );
  try {
    await plannedFoodItemRepository.setStatus(
      userId,
      item.id,
      'added',
      entry.id
    );
  } catch (error) {
    // Without the record the item would show again next to what was just added.
    await plannedFoodItemRepository.deleteEntry(userId, entry.id);
    throw error;
  }
  clearUserTdeeCache(userId);
  return { food_entry_ids: [entry.id], food_entry_meal_ids: [] };
}

/** Writes the diary entries for one planned item, then remembers it was added. */
async function addPlannedMeal(
  userId: string,
  body: PlannedMealActionBody
): Promise<AddedPlannedMeal> {
  await requirePlannedItem(userId, body);

  if (body.template_id === null) return addPlannedFood(userId, body);

  const created = await createFoodEntriesFromTemplate(
    body.template_id,
    userId,
    body.date,
    { onlyDay: body.date, itemKey: body.item_key }
  );
  if (created.foodEntryIds.length === 0) {
    throw new ValidationError('Nothing to add: the planned item is empty.');
  }

  try {
    // Stamp when it was added, so the meal sorts by when it was really eaten.
    if (body.entry_time) {
      const entryTime = body.entry_time;
      await setFoodEntryTimes(userId, userId, [
        ...created.foodEntryMealIds.map((id) => ({
          kind: 'foodEntryMeal' as const,
          id,
          entry_time: entryTime,
        })),
        ...created.foodEntryIds.map((id) => ({
          kind: 'foodEntry' as const,
          id,
          entry_time: entryTime,
        })),
      ]);
    }
    await plannedMealRepository.recordOccurrence(
      userId,
      body.template_id,
      body.date,
      body.item_key,
      'added'
    );
  } catch (error) {
    // Without the record the item would show again next to what was just added.
    await plannedMealRepository.deleteCreatedEntries(
      userId,
      body.date,
      body.template_id,
      created.foodEntryIds,
      created.foodEntryMealIds
    );
    throw error;
  }

  clearUserTdeeCache(userId);
  return {
    food_entry_ids: created.foodEntryIds,
    food_entry_meal_ids: created.foodEntryMealIds,
  };
}

/** Removes the item from this day for good; it can be put back with restore. */
async function skipPlannedMeal(
  userId: string,
  body: PlannedMealActionBody
): Promise<void> {
  await requirePlannedItem(userId, body);
  if (body.template_id === null) {
    await plannedFoodItemRepository.setStatus(userId, body.item_key, 'skipped');
    return;
  }
  await plannedMealRepository.recordOccurrence(
    userId,
    body.template_id,
    body.date,
    body.item_key,
    'skipped'
  );
}

/**
 * Undo for add and skip. Removes only what an add just wrote (by id), then
 * forgets the add or skip so the item is planned again.
 */
async function restorePlannedMeal(
  userId: string,
  body: PlannedMealRestoreBody
): Promise<void> {
  if (body.template_id === null) {
    // Only the entry this item's own add recorded is removed, never ids from the request.
    const item = await plannedFoodItemRepository.getById(userId, body.item_key);
    if (!item || item.plan_date !== body.date)
      throw new PlannedMealNotFoundError();
    await plannedFoodItemRepository.restore(userId, item.id);
    clearUserTdeeCache(userId);
    return;
  }
  if (body.food_entry_ids.length > 0 || body.food_entry_meal_ids.length > 0) {
    await plannedMealRepository.deleteCreatedEntries(
      userId,
      body.date,
      body.template_id,
      body.food_entry_ids,
      body.food_entry_meal_ids
    );
    clearUserTdeeCache(userId);
  }
  await plannedMealRepository.removeOccurrence(
    userId,
    body.template_id,
    body.date,
    body.item_key
  );
}

/** Plans one food on one day and meal, outside any meal plan. */
async function createPlannedFood(
  userId: string,
  body: CreatePlannedFoodBody
): Promise<PlannedMealItem> {
  await assertUsable(userId, body.meal_type_id, body.food_id, body.variant_id);
  const record = await plannedFoodItemRepository.create(userId, body);
  return requireOneOff(userId, record.id, record.plan_date);
}

/** Changes the quantity, serving or meal of a still-planned one-off food. */
async function updatePlannedFood(
  userId: string,
  id: string,
  patch: UpdatePlannedFoodBody
): Promise<PlannedMealItem> {
  const current = await plannedFoodItemRepository.getById(userId, id);
  if (!current || current.status !== 'planned') {
    throw new PlannedMealNotFoundError();
  }
  await assertUsable(
    userId,
    patch.meal_type_id ?? current.meal_type_id,
    current.food_id,
    patch.variant_id ?? current.variant_id
  );
  const updated = await plannedFoodItemRepository.update(userId, id, patch);
  if (!updated) throw new PlannedMealNotFoundError();
  return requireOneOff(userId, updated.id, updated.plan_date);
}

async function assertUsable(
  userId: string,
  mealTypeId: string,
  foodId: string,
  variantId: string
): Promise<void> {
  if (!(await plannedFoodItemRepository.mealTypeExists(userId, mealTypeId))) {
    throw new ValidationError('Unknown meal.');
  }
  if (
    !(await plannedFoodItemRepository.variantBelongsToFood(
      userId,
      foodId,
      variantId
    ))
  ) {
    throw new ValidationError('That serving does not belong to this food.');
  }
}

async function requireOneOff(
  userId: string,
  id: string,
  day: string
): Promise<PlannedMealItem> {
  const items = await plannedFoodItemRepository.getOpenItemsForDay(userId, day);
  const item = items.find((candidate) => candidate.item_key === id);
  if (!item) throw new PlannedMealNotFoundError();
  return item;
}

export {
  getPlannedMeals,
  addPlannedMeal,
  skipPlannedMeal,
  restorePlannedMeal,
  createPlannedFood,
  updatePlannedFood,
};
export default {
  getPlannedMeals,
  addPlannedMeal,
  skipPlannedMeal,
  restorePlannedMeal,
  createPlannedFood,
  updatePlannedFood,
};
