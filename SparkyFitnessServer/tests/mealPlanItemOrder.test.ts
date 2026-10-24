import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayOfWeek } from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import foodEntryMealRepository from '../models/foodEntryMealRepository.js';
import { createFoodEntriesFromTemplate } from '../models/foodTemplate.js';
import {
  createMealPlanTemplate,
  updateMealPlanTemplate,
} from '../models/mealPlanTemplateRepository.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));
vi.mock('../models/foodEntryMealRepository.js', () => ({
  default: { createFoodEntryMeal: vi.fn() },
}));

const DAY = '2026-10-26';
const BASE = Date.UTC(2026, 9, 26, 12, 0, 0, 0);

describe('meal plan item order', () => {
  const query = vi.fn();
  const release = vi.fn();

  beforeEach(() => {
    query.mockReset();
    release.mockReset();
    vi.mocked(getClient).mockReset();
    vi.mocked(getClient).mockResolvedValue({ query, release } as never);
    vi.spyOn(Date, 'now').mockReturnValue(BASE);
  });
  afterEach(() => vi.restoreAllMocks());

  it('saves each item with its place in the list', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT id, name FROM meal_types'))
        return { rows: [] };
      if (sql.includes('INSERT INTO meal_plan_templates'))
        return { rows: [{ id: 'plan-1' }] };
      return { rows: [{ id: 'plan-1' }] };
    });
    const assignments = [
      {
        day_of_week: 1,
        meal_type_id: 'mt',
        item_type: 'food',
        food_id: 'f2',
        variant_id: 'v2',
        quantity: 1,
        unit: 'g',
      },
      { day_of_week: 1, meal_type_id: 'mt', item_type: 'meal', meal_id: 'm1' },
      {
        day_of_week: 1,
        meal_type_id: 'mt',
        item_type: 'food',
        food_id: 'f1',
        variant_id: 'v1',
        quantity: 2,
        unit: 'g',
      },
    ];

    await createMealPlanTemplate({ user_id: 'u', assignments });
    await updateMealPlanTemplate('plan-1', { user_id: 'u', assignments });

    const inserts = query.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) =>
        sql.startsWith('INSERT INTO meal_plan_template_assignments')
      );
    expect(inserts).toHaveLength(2);
    for (const sql of inserts) {
      expect(sql).toContain('quantity, unit, sort_order) VALUES');
      // Each row ends with its index: 0, 1, 2 in the order sent.
      expect(sql).toMatch(/'f2', 'v2', '1', 'g', '0'\)/);
      expect(sql).toMatch(/'1', 'serving', '1'\)/);
      expect(sql).toMatch(/'f1', 'v1', '2', 'g', '2'\)/);
    }
  });

  it('logs a day in plan order, a millisecond apart', async () => {
    const dow = dayOfWeek(DAY);
    const assignments = [
      {
        day_of_week: dow,
        meal_type_id: 'mt',
        item_type: 'meal',
        meal_id: 'm1',
        quantity: 1,
        unit: 'serving',
        sort_order: 0,
      },
      {
        day_of_week: dow,
        meal_type_id: 'mt',
        item_type: 'food',
        food_id: 'f1',
        variant_id: 'v1',
        quantity: 100,
        unit: 'g',
        sort_order: 1,
      },
    ];
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM meal_plan_templates t'))
        return { rows: [{ start_date: DAY, end_date: DAY, assignments }] };
      if (sql.includes('FROM meal_foods mf'))
        return {
          rows: [
            {
              meal_id: 'm1',
              food_id: 'f9',
              variant_id: 'v9',
              quantity: 1,
              unit: 'g',
              food_name: 'Egg',
              serving_size: 1,
            },
          ],
        };
      if (sql.startsWith('SELECT * FROM foods'))
        return {
          rows: [
            { id: 'f1', name: 'Oats' },
            { id: 'f9', name: 'Egg' },
          ],
        };
      if (sql.startsWith('SELECT * FROM meals'))
        return {
          rows: [
            {
              id: 'm1',
              name: 'Breakfast bowl',
              serving_size: 1,
              total_servings: 1,
            },
          ],
        };
      if (sql.startsWith('SELECT * FROM food_variants'))
        return {
          rows: [
            { id: 'v1', serving_size: 100 },
            { id: 'v9', serving_size: 1 },
          ],
        };
      if (sql.startsWith('INSERT INTO food_entries'))
        return { rows: [{ id: 'e1' }, { id: 'e2' }] };
      return { rows: [] };
    });
    vi.mocked(foodEntryMealRepository.createFoodEntryMeal).mockResolvedValue({
      id: 'fem-1',
    } as never);

    await createFoodEntriesFromTemplate('plan-1', 'u', DAY, { onlyDay: DAY });

    const templateSql = String(query.mock.calls[1]?.[0]);
    expect(templateSql).toContain('ORDER BY a.sort_order, a.id');

    expect(foodEntryMealRepository.createFoodEntryMeal).toHaveBeenCalledWith(
      expect.objectContaining({ created_at: new Date(BASE) }),
      'u'
    );
    const insert = String(
      query.mock.calls.find(([sql]) =>
        String(sql).startsWith('INSERT INTO food_entries')
      )?.[0]
    );
    expect(insert).toContain('alcohol_g, created_at');
    // The meal's component shares the meal's moment; the next item is 1 ms later.
    const meal = new Date(BASE)
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '+00');
    const next = new Date(BASE + 1)
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '+00');
    expect(insert.indexOf(`'${meal}'`)).toBeGreaterThan(-1);
    expect(insert.indexOf(`'${next}'`)).toBeGreaterThan(
      insert.indexOf(`'${meal}'`)
    );
  });
});
