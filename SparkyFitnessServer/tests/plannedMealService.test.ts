import { describe, it, expect, vi, beforeEach } from 'vitest';
import plannedMealService, {
  PlannedMealNotFoundError,
} from '../services/plannedMealService.js';
import plannedMealRepository from '../models/plannedMealRepository.js';
import plannedFoodItemRepository from '../models/plannedFoodItemRepository.js';
import { createFoodEntriesFromTemplate } from '../models/foodTemplate.js';
import { createFoodEntry } from '../models/foodEntry.js';
import { ValidationError } from '../utils/errors.js';

vi.mock('../models/plannedMealRepository.js', () => ({
  default: {
    getPlannedItemsForDay: vi.fn(),
    recordOccurrence: vi.fn().mockResolvedValue(undefined),
    removeOccurrence: vi.fn().mockResolvedValue(undefined),
    deleteCreatedEntries: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../models/plannedFoodItemRepository.js', () => ({
  default: {
    getOpenItemsForDay: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    variantBelongsToFood: vi.fn().mockResolvedValue(true),
    mealTypeExists: vi.fn().mockResolvedValue(true),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    deleteEntry: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../models/foodEntry.js', () => ({
  createFoodEntry: vi.fn(),
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
  nutrition: null,
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

  describe('one-off planned foods', () => {
    const itemId = '44444444-4444-4444-8444-444444444444';
    const oneOff = {
      ...plannedItem,
      template_id: null,
      template_name: '',
      item_key: itemId,
      item_type: 'food' as const,
      meal_id: null,
      food_id: '55555555-5555-4555-8555-555555555555',
      variant_id: '66666666-6666-4666-8666-666666666666',
      name: 'Birthday cake',
      foods: [],
    };
    const record = {
      id: itemId,
      plan_date: day,
      meal_type_id: oneOff.meal_type_id,
      food_id: oneOff.food_id,
      variant_id: oneOff.variant_id,
      quantity: 1,
      unit: 'slice',
      status: 'planned' as const,
      food_entry_id: null,
    };
    const oneOffBody = { template_id: null, date: day, item_key: itemId };

    beforeEach(() => {
      vi.mocked(
        plannedFoodItemRepository.variantBelongsToFood
      ).mockResolvedValue(true);
      vi.mocked(plannedFoodItemRepository.getOpenItemsForDay).mockResolvedValue(
        [oneOff]
      );
      vi.mocked(plannedFoodItemRepository.getById).mockResolvedValue(record);
    });

    it('lists one-off foods after the plan items', async () => {
      const items = await plannedMealService.getPlannedMeals(userId, day);
      expect(items).toEqual([plannedItem, oneOff]);
    });

    it('add logs one entry on that day and remembers its id', async () => {
      vi.mocked(createFoodEntry).mockResolvedValue({ id: 'entry-1' });

      const result = await plannedMealService.addPlannedMeal(
        userId,
        oneOffBody
      );

      expect(createFoodEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          food_id: oneOff.food_id,
          variant_id: oneOff.variant_id,
          meal_type_id: oneOff.meal_type_id,
          quantity: 1,
          unit: 'slice',
          entry_date: day,
        }),
        userId
      );
      expect(plannedFoodItemRepository.setStatus).toHaveBeenCalledWith(
        userId,
        itemId,
        'added',
        'entry-1'
      );
      expect(createFoodEntriesFromTemplate).not.toHaveBeenCalled();
      expect(result).toEqual({
        food_entry_ids: ['entry-1'],
        food_entry_meal_ids: [],
      });
    });

    it('add removes the entry again when it cannot be recorded', async () => {
      vi.mocked(createFoodEntry).mockResolvedValue({ id: 'entry-1' });
      vi.mocked(plannedFoodItemRepository.setStatus).mockRejectedValueOnce(
        new Error('db down')
      );

      await expect(
        plannedMealService.addPlannedMeal(userId, oneOffBody)
      ).rejects.toThrow('db down');
      expect(plannedFoodItemRepository.deleteEntry).toHaveBeenCalledWith(
        userId,
        'entry-1'
      );
    });

    it('add refuses an item that is not planned for that day', async () => {
      vi.mocked(plannedFoodItemRepository.getOpenItemsForDay).mockResolvedValue(
        []
      );
      await expect(
        plannedMealService.addPlannedMeal(userId, oneOffBody)
      ).rejects.toBeInstanceOf(PlannedMealNotFoundError);
      expect(createFoodEntry).not.toHaveBeenCalled();
    });

    it('skip marks the item skipped', async () => {
      await plannedMealService.skipPlannedMeal(userId, oneOffBody);
      expect(plannedFoodItemRepository.setStatus).toHaveBeenCalledWith(
        userId,
        itemId,
        'skipped'
      );
      expect(plannedMealRepository.recordOccurrence).not.toHaveBeenCalled();
    });

    it('restore removes only the entry the item recorded, whatever ids are sent', async () => {
      await plannedMealService.restorePlannedMeal(userId, {
        ...oneOffBody,
        food_entry_ids: ['someone-elses-entry'],
        food_entry_meal_ids: [],
      });
      expect(plannedFoodItemRepository.restore).toHaveBeenCalledWith(
        userId,
        itemId
      );
      expect(plannedMealRepository.deleteCreatedEntries).not.toHaveBeenCalled();
    });

    it('restore refuses another day', async () => {
      await expect(
        plannedMealService.restorePlannedMeal(userId, {
          ...oneOffBody,
          date: '2026-10-22',
          food_entry_ids: [],
          food_entry_meal_ids: [],
        })
      ).rejects.toBeInstanceOf(PlannedMealNotFoundError);
    });

    it('create checks the serving belongs to the food', async () => {
      vi.mocked(
        plannedFoodItemRepository.variantBelongsToFood
      ).mockResolvedValue(false);
      await expect(
        plannedMealService.createPlannedFood(userId, {
          date: day,
          meal_type_id: oneOff.meal_type_id,
          food_id: oneOff.food_id,
          variant_id: oneOff.variant_id,
          quantity: 1,
          unit: 'slice',
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(plannedFoodItemRepository.create).not.toHaveBeenCalled();
    });

    it('create returns the new item as listed for the day', async () => {
      vi.mocked(plannedFoodItemRepository.create).mockResolvedValue(record);
      const created = await plannedMealService.createPlannedFood(userId, {
        date: day,
        meal_type_id: oneOff.meal_type_id,
        food_id: oneOff.food_id,
        variant_id: oneOff.variant_id,
        quantity: 1,
        unit: 'slice',
      });
      expect(created).toEqual(oneOff);
    });

    it('update refuses an item already added', async () => {
      vi.mocked(plannedFoodItemRepository.getById).mockResolvedValue({
        ...record,
        status: 'added',
      });
      await expect(
        plannedMealService.updatePlannedFood(userId, itemId, { quantity: 2 })
      ).rejects.toBeInstanceOf(PlannedMealNotFoundError);
      expect(plannedFoodItemRepository.update).not.toHaveBeenCalled();
    });

    it('update changes the quantity and returns the listed item', async () => {
      vi.mocked(plannedFoodItemRepository.update).mockResolvedValue({
        ...record,
        quantity: 2,
      });
      const updated = await plannedMealService.updatePlannedFood(
        userId,
        itemId,
        { quantity: 2 }
      );
      expect(plannedFoodItemRepository.update).toHaveBeenCalledWith(
        userId,
        itemId,
        { quantity: 2 }
      );
      expect(updated.item_key).toBe(itemId);
    });
  });
});
