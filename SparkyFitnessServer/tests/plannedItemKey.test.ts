import { describe, it, expect } from 'vitest';
import {
  assignPlannedItemKeys,
  plannedItemBaseKey,
  plannedItemKey,
} from '../utils/plannedItemKey.js';

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

  it('keeps the first copy of a repeated food on the original key', () => {
    const food = {
      item_type: 'food',
      meal_type_id: 'breakfast',
      meal_id: null,
      food_id: 'f1',
      variant_id: 'v1',
    };
    expect(plannedItemKey(food, 0)).toBe('food:breakfast:f1:v1');
    expect(plannedItemKey(food, 1)).toBe('food:breakfast:f1:v1:1');
    expect(plannedItemKey(food, 2)).toBe('food:breakfast:f1:v1:2');
  });

  it('numbers only copies that share a template and a weekday', () => {
    const food = {
      item_type: 'food' as const,
      meal_type_id: 'breakfast',
      meal_id: null,
      food_id: 'f1',
      variant_id: 'v1',
    };
    const keyed = assignPlannedItemKeys(
      [
        { ...food, day: 1, template_id: 'plan-a' },
        { ...food, day: 1, template_id: 'plan-a' },
        { ...food, day: 1, template_id: 'plan-b' },
        { ...food, day: 2, template_id: 'plan-a' },
      ],
      (item) => `${item.template_id}|${item.day}`
    );
    expect(keyed.map((entry) => entry.itemKey)).toEqual([
      'food:breakfast:f1:v1',
      'food:breakfast:f1:v1:1',
      'food:breakfast:f1:v1',
      'food:breakfast:f1:v1',
    ]);
  });

  it('strips a copy suffix without touching an empty variant', () => {
    expect(plannedItemBaseKey('food:breakfast:f1:v1:2')).toBe(
      'food:breakfast:f1:v1'
    );
    expect(plannedItemBaseKey('food:breakfast:f1:')).toBe('food:breakfast:f1:');
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
