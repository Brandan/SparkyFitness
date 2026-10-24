import { dayOfWeek } from '@workspace/shared';
import type {
  AddedPlannedMeal,
  PlannedMealActionBody,
  PlannedMealItem,
  PlannedMealRestoreBody,
} from '@workspace/shared';
import { createFoodEntriesFromTemplate } from '../models/foodTemplate.js';
import plannedMealRepository from '../models/plannedMealRepository.js';
import { clearUserTdeeCache } from './AdaptiveTdeeService.js';
import { ValidationError } from '../utils/errors.js';

export class PlannedMealNotFoundError extends Error {
  constructor() {
    super('That planned item is no longer on the plan.');
    this.name = 'PlannedMealNotFoundError';
  }
}

/** What a "show as planned" plan has on `day` that is not yet added or skipped. */
async function getPlannedMeals(
  userId: string,
  day: string
): Promise<PlannedMealItem[]> {
  return plannedMealRepository.getPlannedItemsForDay(
    userId,
    day,
    dayOfWeek(day)
  );
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

/** Writes the diary entries for one planned item, then remembers it was added. */
async function addPlannedMeal(
  userId: string,
  body: PlannedMealActionBody
): Promise<AddedPlannedMeal> {
  await requirePlannedItem(userId, body);

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

export { getPlannedMeals, addPlannedMeal, skipPlannedMeal, restorePlannedMeal };
export default {
  getPlannedMeals,
  addPlannedMeal,
  skipPlannedMeal,
  restorePlannedMeal,
};
