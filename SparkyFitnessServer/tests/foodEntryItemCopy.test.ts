import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFoodEntryItem } from '../services/foodEntryService.js';
import foodRepository from '../models/foodRepository.js';
import foodEntryMealRepository from '../models/foodEntryMealRepository.js';
import mealTypeRepository from '../models/mealType.js';

vi.mock('../models/foodRepository');
vi.mock('../models/foodEntryMealRepository');
vi.mock('../models/mealType.js');
vi.mock('../config/logging', () => ({ log: vi.fn() }));

const USER = 'user-1';
const ACTOR = 'actor-1';
const LUNCH = 'meal-type-lunch';
const DINNER = 'meal-type-dinner';

const sourceEntry = {
  id: 'entry-1',
  user_id: USER,
  food_id: 'food-1',
  variant_id: 'variant-1',
  food_entry_meal_id: null,
  meal_type_id: LUNCH,
  entry_date: '2026-10-19',
  entry_time: '12:30:00',
  quantity: '1.5',
  unit: 'serving',
  food_name: 'Banana',
  brand_name: 'Fresh',
  serving_size: '100',
  serving_unit: 'g',
  calories: 105,
  protein: 1.3,
  carbs: 27,
  fat: 0.3,
  notes: 'ripe',
  custom_nutrients: {},
};

describe('copyFoodEntryItem', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(mealTypeRepository.getAllMealTypes).mockResolvedValue([
      { id: LUNCH, name: 'Lunch', user_id: null },
      { id: DINNER, name: 'Dinner', user_id: null },
    ]);
    vi.mocked(foodRepository.bulkCreateFoodEntries).mockImplementation(
      async (rows: unknown[]) =>
        rows.map((row, index) => ({ ...(row as object), id: `new-${index}` }))
    );
  });

  describe('single food entry', () => {
    it('copies onto its own day and meal without skipping it as a duplicate', async () => {
      vi.mocked(foodRepository.getFoodEntryById).mockResolvedValue(sourceEntry);

      const result = await copyFoodEntryItem(
        USER,
        ACTOR,
        'foodEntry',
        'entry-1',
        '2026-10-19',
        'Lunch'
      );

      expect(foodRepository.getFoodEntryByDetails).not.toHaveBeenCalled();
      expect(foodRepository.bulkCreateFoodEntries).toHaveBeenCalledTimes(1);
      const [rows, userId] = vi.mocked(foodRepository.bulkCreateFoodEntries)
        .mock.calls[0];
      expect(userId).toBe(USER);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        user_id: USER,
        created_by_user_id: ACTOR,
        food_id: 'food-1',
        variant_id: 'variant-1',
        meal_type_id: LUNCH,
        entry_date: '2026-10-19',
        entry_time: '12:30:00',
        quantity: 1.5,
        serving_size: 100,
        food_name: 'Banana',
        calories: 105,
        notes: 'ripe',
        food_entry_meal_id: null,
        meal_plan_template_id: null,
      });
      expect(result).toHaveLength(1);
    });

    it('copies to a different day and meal, resolving the meal by name', async () => {
      vi.mocked(foodRepository.getFoodEntryById).mockResolvedValue(sourceEntry);

      await copyFoodEntryItem(
        USER,
        ACTOR,
        'foodEntry',
        'entry-1',
        '2026-10-21',
        'Dinner'
      );

      const [rows] = vi.mocked(foodRepository.bulkCreateFoodEntries).mock
        .calls[0];
      expect(rows[0]).toMatchObject({
        meal_type_id: DINNER,
        entry_date: '2026-10-21',
      });
    });

    it('copies a food that sat inside a logged meal as a standalone entry', async () => {
      vi.mocked(foodRepository.getFoodEntryById).mockResolvedValue({
        ...sourceEntry,
        food_entry_meal_id: 'meal-9',
      });

      await copyFoodEntryItem(
        USER,
        ACTOR,
        'foodEntry',
        'entry-1',
        '2026-10-19',
        'Lunch'
      );

      const [rows] = vi.mocked(foodRepository.bulkCreateFoodEntries).mock
        .calls[0];
      expect(rows[0].food_entry_meal_id).toBeNull();
      expect(
        foodEntryMealRepository.createFoodEntryMeal
      ).not.toHaveBeenCalled();
    });

    it('answers 404 when the entry is missing or belongs to someone else', async () => {
      vi.mocked(foodRepository.getFoodEntryById).mockResolvedValueOnce(
        undefined
      );
      await expect(
        copyFoodEntryItem(
          USER,
          ACTOR,
          'foodEntry',
          'nope',
          '2026-10-19',
          'Lunch'
        )
      ).rejects.toMatchObject({ statusCode: 404 });

      vi.mocked(foodRepository.getFoodEntryById).mockResolvedValueOnce({
        ...sourceEntry,
        user_id: 'someone-else',
      });
      await expect(
        copyFoodEntryItem(
          USER,
          ACTOR,
          'foodEntry',
          'entry-1',
          '2026-10-19',
          'Lunch'
        )
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(foodRepository.bulkCreateFoodEntries).not.toHaveBeenCalled();
    });

    it('answers 400 for an unknown meal type or a bad day', async () => {
      await expect(
        copyFoodEntryItem(
          USER,
          ACTOR,
          'foodEntry',
          'entry-1',
          '2026-10-19',
          'Brunch'
        )
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        copyFoodEntryItem(
          USER,
          ACTOR,
          'foodEntry',
          'entry-1',
          '2026-02-30',
          'Lunch'
        )
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(foodRepository.bulkCreateFoodEntries).not.toHaveBeenCalled();
    });
  });

  describe('logged meal', () => {
    const originalMeal = {
      id: 'meal-9',
      user_id: USER,
      meal_template_id: 'template-1',
      entry_time: '18:00:00',
      name: 'Chicken bowl',
      description: 'prep',
      notes: 'double rice',
      quantity: 2,
      unit: 'serving',
    };

    it('creates a new container and links every food to it', async () => {
      vi.mocked(foodEntryMealRepository.getFoodEntryMealById).mockResolvedValue(
        originalMeal
      );
      vi.mocked(
        foodRepository.getFoodEntryComponentsByFoodEntryMealId
      ).mockResolvedValue([
        { ...sourceEntry, id: 'c1', food_entry_meal_id: 'meal-9' },
        {
          ...sourceEntry,
          id: 'c2',
          food_id: 'food-2',
          food_entry_meal_id: 'meal-9',
        },
      ]);
      vi.mocked(foodEntryMealRepository.createFoodEntryMeal).mockResolvedValue({
        id: 'meal-new',
      });

      const result = await copyFoodEntryItem(
        USER,
        ACTOR,
        'foodEntryMeal',
        'meal-9',
        '2026-10-22',
        'Dinner'
      );

      expect(foodEntryMealRepository.createFoodEntryMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER,
          meal_template_id: 'template-1',
          meal_type_id: DINNER,
          entry_date: '2026-10-22',
          name: 'Chicken bowl',
          notes: 'double rice',
          quantity: 2,
        }),
        ACTOR
      );
      const [rows] = vi.mocked(foodRepository.bulkCreateFoodEntries).mock
        .calls[0];
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row).toMatchObject({
          food_entry_meal_id: 'meal-new',
          meal_type_id: DINNER,
          entry_date: '2026-10-22',
        });
      }
      expect(foodRepository.getFoodEntryByDetails).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('answers 404 when the logged meal belongs to someone else', async () => {
      vi.mocked(foodEntryMealRepository.getFoodEntryMealById).mockResolvedValue(
        { ...originalMeal, user_id: 'someone-else' }
      );
      await expect(
        copyFoodEntryItem(
          USER,
          ACTOR,
          'foodEntryMeal',
          'meal-9',
          '2026-10-22',
          'Dinner'
        )
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(
        foodEntryMealRepository.createFoodEntryMeal
      ).not.toHaveBeenCalled();
    });
  });
});
