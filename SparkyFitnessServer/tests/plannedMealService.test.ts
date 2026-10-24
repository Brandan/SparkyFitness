import { describe, it, expect, vi, beforeEach } from 'vitest';
import plannedMealService, {
  PlannedMealNotFoundError,
} from '../services/plannedMealService.js';
import plannedMealRepository from '../models/plannedMealRepository.js';
import { createFoodEntriesFromTemplate } from '../models/foodTemplate.js';
import { ValidationError } from '../utils/errors.js';

vi.mock('../models/plannedMealRepository.js', () => ({
  default: {
    getPlannedItemsForDay: vi.fn(),
    recordOccurrence: vi.fn().mockResolvedValue(undefined),
    removeOccurrence: vi.fn().mockResolvedValue(undefined),
    deleteCreatedEntries: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../models/foodTemplate.js', () => ({
  createFoodEntriesFromTemplate: vi.fn(),
}));

vi.mock('../services/AdaptiveTdeeService.js', () => ({
  clearUserTdeeCache: vi.fn(),
}));

const userId = 'user-1';
// 2026-10-21 is a Wednesday.
const day = '2026-10-21';
const templateId = '11111111-1111-4111-8111-111111111111';
const itemKey = 'meal:type-1:meal-1:';

const plannedItem = {
  template_id: templateId,
  template_name: 'Daily breakfast',
  item_key: itemKey,
  item_type: 'meal' as const,
  meal_type_id: '22222222-2222-4222-8222-222222222222',
  meal_type_name: 'Breakfast',
  meal_id: '33333333-3333-4333-8333-333333333333',
  food_id: null,
  variant_id: null,
  name: 'Eggs and sausage',
  brand: null,
  quantity: 1,
  unit: 'serving',
  foods: [
    { name: 'Eggs', quantity: 2, unit: 'large' },
    { name: 'Sausage', quantity: 2, unit: 'link' },
  ],
  calories: 420,
  images: ['/uploads/food/eggs.jpg'],
};

const body = { template_id: templateId, date: day, item_key: itemKey };

describe('plannedMealService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(plannedMealRepository.getPlannedItemsForDay).mockResolvedValue([
      plannedItem,
    ]);
  });

  it('getPlannedMeals looks up the weekday of the requested day', async () => {
    const items = await plannedMealService.getPlannedMeals(userId, day);

    expect(items).toEqual([plannedItem]);
    expect(plannedMealRepository.getPlannedItemsForDay).toHaveBeenCalledWith(
      userId,
      day,
      3
    );
  });

  it('addPlannedMeal writes only that day and item, then remembers it', async () => {
    vi.mocked(createFoodEntriesFromTemplate).mockResolvedValue({
      foodEntryIds: ['e1', 'e2'],
      foodEntryMealIds: ['m1'],
    });

    const result = await plannedMealService.addPlannedMeal(userId, body);

    expect(createFoodEntriesFromTemplate).toHaveBeenCalledWith(
      templateId,
      userId,
      day,
      { onlyDay: day, itemKey }
    );
    expect(plannedMealRepository.recordOccurrence).toHaveBeenCalledWith(
      userId,
      templateId,
      day,
      itemKey,
      'added'
    );
    expect(result).toEqual({
      food_entry_ids: ['e1', 'e2'],
      food_entry_meal_ids: ['m1'],
    });
  });

  it('addPlannedMeal refuses an item that is no longer planned', async () => {
    vi.mocked(plannedMealRepository.getPlannedItemsForDay).mockResolvedValue(
      []
    );

    await expect(
      plannedMealService.addPlannedMeal(userId, body)
    ).rejects.toBeInstanceOf(PlannedMealNotFoundError);
    expect(createFoodEntriesFromTemplate).not.toHaveBeenCalled();
  });

  it('addPlannedMeal does not mark an empty item as added', async () => {
    vi.mocked(createFoodEntriesFromTemplate).mockResolvedValue({
      foodEntryIds: [],
      foodEntryMealIds: [],
    });

    await expect(
      plannedMealService.addPlannedMeal(userId, body)
    ).rejects.toBeInstanceOf(ValidationError);
    expect(plannedMealRepository.recordOccurrence).not.toHaveBeenCalled();
  });

  it('addPlannedMeal removes what it wrote if it cannot remember the add', async () => {
    vi.mocked(createFoodEntriesFromTemplate).mockResolvedValue({
      foodEntryIds: ['e1'],
      foodEntryMealIds: ['m1'],
    });
    vi.mocked(plannedMealRepository.recordOccurrence).mockRejectedValueOnce(
      new Error('db down')
    );

    await expect(
      plannedMealService.addPlannedMeal(userId, body)
    ).rejects.toThrow('db down');
    expect(plannedMealRepository.deleteCreatedEntries).toHaveBeenCalledWith(
      userId,
      day,
      templateId,
      ['e1'],
      ['m1']
    );
  });

  it('skipPlannedMeal records a skip and writes nothing', async () => {
    await plannedMealService.skipPlannedMeal(userId, body);

    expect(plannedMealRepository.recordOccurrence).toHaveBeenCalledWith(
      userId,
      templateId,
      day,
      itemKey,
      'skipped'
    );
    expect(createFoodEntriesFromTemplate).not.toHaveBeenCalled();
  });

  it('restorePlannedMeal removes the entries an add wrote and forgets the add', async () => {
    await plannedMealService.restorePlannedMeal(userId, {
      ...body,
      food_entry_ids: ['e1', 'e2'],
      food_entry_meal_ids: ['m1'],
    });

    expect(plannedMealRepository.deleteCreatedEntries).toHaveBeenCalledWith(
      userId,
      day,
      templateId,
      ['e1', 'e2'],
      ['m1']
    );
    expect(plannedMealRepository.removeOccurrence).toHaveBeenCalledWith(
      userId,
      templateId,
      day,
      itemKey
    );
  });

  it('restorePlannedMeal after a skip deletes no entries', async () => {
    await plannedMealService.restorePlannedMeal(userId, {
      ...body,
      food_entry_ids: [],
      food_entry_meal_ids: [],
    });

    expect(plannedMealRepository.deleteCreatedEntries).not.toHaveBeenCalled();
    expect(plannedMealRepository.removeOccurrence).toHaveBeenCalledTimes(1);
  });
});
