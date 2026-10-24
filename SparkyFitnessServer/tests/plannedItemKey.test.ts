import { describe, it, expect } from 'vitest';
import { plannedItemKey } from '../utils/plannedItemKey.js';

describe('plannedItemKey', () => {
  it('identifies a meal by its meal type and meal, ignoring row ids', () => {
    expect(
      plannedItemKey({
        item_type: 'meal',
        meal_type_id: 'breakfast',
        meal_id: 'm1',
        food_id: null,
        variant_id: null,
      })
    ).toBe('meal:breakfast:m1:');
  });

  it('identifies a food by food and variant', () => {
    expect(
      plannedItemKey({
        item_type: 'food',
        meal_type_id: 'snack',
        meal_id: null,
        food_id: 'f1',
        variant_id: 'v1',
      })
    ).toBe('food:snack:f1:v1');
  });

  it('gives the same food in a different meal type a different key', () => {
    const base = {
      item_type: 'food',
      meal_id: null,
      food_id: 'f1',
      variant_id: 'v1',
    };
    expect(plannedItemKey({ ...base, meal_type_id: 'a' })).not.toBe(
      plannedItemKey({ ...base, meal_type_id: 'b' })
    );
  });
});
