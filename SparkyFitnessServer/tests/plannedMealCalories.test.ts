import { describe, it, expect, vi, beforeEach } from 'vitest';
import plannedMealRepository from '../models/plannedMealRepository.js';
import { getClient } from '../db/poolManager.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));

const templateId = '11111111-1111-4111-8111-111111111111';
const mealTypeId = '22222222-2222-4222-8222-222222222222';
const mealId = '33333333-3333-4333-8333-333333333333';
const foodId = '44444444-4444-4444-8444-444444444444';

const assignment = (overrides: Record<string, unknown>) => ({
  template_id: templateId,
  template_name: 'Plan',
  item_type: 'food',
  meal_type_id: mealTypeId,
  meal_type_name: 'Breakfast',
  meal_id: null,
  food_id: foodId,
  variant_id: 'v1',
  quantity: '1',
  unit: 'serving',
  meal_name: null,
  food_name: 'Oats',
  food_brand: null,
  variant_calories: null,
  variant_serving_size: null,
  variant: null,
  meal_serving_size: null,
  meal_total_servings: null,
  meal_images: null,
  food_images: null,
  ...overrides,
});

/** A client that answers the three queries getPlannedItemsForDay makes, in order. */
const mockQueries = (
  assignments: unknown[],
  components: unknown[] = []
): void => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: assignments })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: components });
  vi.mocked(getClient).mockResolvedValue({
    query,
    release: vi.fn(),
  } as never);
};

const caloriesOf = async () => {
  const [item] = await plannedMealRepository.getPlannedItemsForDay(
    'user-1',
    '2026-10-24',
    5
  );
  return item.calories;
};

describe('plannedMealRepository calories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scales a food by quantity over the variant serving size', async () => {
    mockQueries([
      assignment({
        quantity: '150',
        unit: 'g',
        variant_calories: '80',
        variant_serving_size: '100',
      }),
    ]);

    expect(await caloriesOf()).toBeCloseTo(120);
  });

  it('is null for a food whose variant is gone', async () => {
    mockQueries([assignment({})]);

    expect(await caloriesOf()).toBeNull();
  });

  it('scales a meal by quantity over serving size times total servings', async () => {
    mockQueries(
      [
        assignment({
          item_type: 'meal',
          meal_id: mealId,
          food_id: null,
          variant_id: null,
          quantity: '2',
          meal_name: 'Breakfast bowl',
          meal_serving_size: '1',
          meal_total_servings: '4',
        }),
      ],
      [
        {
          meal_id: mealId,
          name: 'Eggs',
          quantity: '2',
          unit: 'large',
          images: null,
          variant_calories: '70',
          variant_serving_size: '1',
        },
        {
          meal_id: mealId,
          name: 'Oats',
          quantity: '100',
          unit: 'g',
          images: null,
          variant_calories: '380',
          variant_serving_size: '100',
        },
      ]
    );

    // Foods total 140 + 380 = 520; 2 servings of a 4-serving meal is half.
    expect(await caloriesOf()).toBeCloseTo(260);
  });

  it('is null for a meal when any of its foods has no variant', async () => {
    mockQueries(
      [
        assignment({
          item_type: 'meal',
          meal_id: mealId,
          food_id: null,
          variant_id: null,
          meal_serving_size: '1',
          meal_total_servings: '1',
        }),
      ],
      [
        {
          meal_id: mealId,
          name: 'Eggs',
          quantity: '2',
          unit: 'large',
          images: null,
          variant_calories: '70',
          variant_serving_size: '1',
        },
        {
          meal_id: mealId,
          name: 'Mystery',
          quantity: '1',
          unit: 'serving',
          images: null,
          variant_calories: null,
          variant_serving_size: null,
        },
      ]
    );

    expect(await caloriesOf()).toBeNull();
  });
});

const nutritionOf = async () => {
  const [item] = await plannedMealRepository.getPlannedItemsForDay(
    'user-1',
    '2026-10-24',
    5
  );
  return item.nutrition;
};

describe('plannedMealRepository nutrition', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scales every nutrient of a food, custom ones included', async () => {
    mockQueries([
      assignment({
        quantity: '150',
        variant_serving_size: '100',
        variant: {
          calories: 80,
          protein: '10',
          carbs: 20,
          fat: null,
          custom_nutrients: { Choline: 40 },
        },
      }),
    ]);

    const nutrition = await nutritionOf();
    expect(nutrition?.calories).toBeCloseTo(120);
    expect(nutrition?.protein).toBeCloseTo(15);
    expect(nutrition?.carbs).toBeCloseTo(30);
    expect(nutrition?.fat).toBe(0);
    expect(nutrition?.custom_nutrients.Choline).toBeCloseTo(60);
  });

  it('is null for a food whose variant is gone', async () => {
    mockQueries([assignment({ variant: null })]);

    expect(await nutritionOf()).toBeNull();
  });

  it('sums a meal’s foods and scales to the planned servings', async () => {
    mockQueries(
      [
        assignment({
          item_type: 'meal',
          meal_id: mealId,
          food_id: null,
          variant_id: null,
          quantity: '2',
          meal_serving_size: '1',
          meal_total_servings: '4',
        }),
      ],
      [
        {
          meal_id: mealId,
          name: 'Eggs',
          quantity: '2',
          unit: 'large',
          images: null,
          variant_calories: '70',
          variant_serving_size: '1',
          variant: { calories: 70, protein: 6 },
        },
        {
          meal_id: mealId,
          name: 'Oats',
          quantity: '100',
          unit: 'g',
          images: null,
          variant_calories: '380',
          variant_serving_size: '100',
          variant: { calories: 380, protein: 13 },
        },
      ]
    );

    const nutrition = await nutritionOf();
    expect(nutrition?.calories).toBeCloseTo(260);
    // Protein 12 + 13 = 25, halved.
    expect(nutrition?.protein).toBeCloseTo(12.5);
  });

  it('is null for a meal when any of its foods has no variant', async () => {
    mockQueries(
      [
        assignment({
          item_type: 'meal',
          meal_id: mealId,
          food_id: null,
          variant_id: null,
          meal_serving_size: '1',
          meal_total_servings: '1',
        }),
      ],
      [
        {
          meal_id: mealId,
          name: 'Eggs',
          quantity: '2',
          unit: 'large',
          images: null,
          variant_serving_size: '1',
          variant: { calories: 70 },
        },
        {
          meal_id: mealId,
          name: 'Mystery',
          quantity: '1',
          unit: 'serving',
          images: null,
          variant_serving_size: null,
          variant: null,
        },
      ]
    );

    expect(await nutritionOf()).toBeNull();
  });
});
