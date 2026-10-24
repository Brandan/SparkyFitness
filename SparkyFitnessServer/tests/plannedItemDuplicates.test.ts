import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayOfWeek } from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import { createFoodEntriesFromTemplate } from '../models/foodTemplate.js';
import { plannedItemKey } from '../utils/plannedItemKey.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

const DAY = '2026-10-26';
const dow = dayOfWeek(DAY);

const cream = (quantity: number) => ({
  day_of_week: dow,
  meal_type_id: 'mt',
  item_type: 'food',
  meal_id: null,
  food_id: 'f-cream',
  variant_id: 'v-cream',
  quantity,
  unit: 'oz',
});

const keyFor = (occurrence: number) =>
  plannedItemKey(
    {
      item_type: 'food',
      meal_type_id: 'mt',
      meal_id: null,
      food_id: 'f-cream',
      variant_id: 'v-cream',
    },
    occurrence
  );

describe('createFoodEntriesFromTemplate repeated foods', () => {
  const query = vi.fn();
  const release = vi.fn();

  beforeEach(() => {
    query.mockReset();
    release.mockReset();
    vi.mocked(getClient).mockReset();
    vi.mocked(getClient).mockResolvedValue({ query, release } as never);
  });
  afterEach(() => vi.restoreAllMocks());

  const install = (
    assignments: ReturnType<typeof cream>[],
    existing: { food_id: string; variant_id: string }[] = []
  ) => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM meal_plan_templates t')) {
        return {
          rows: [{ start_date: DAY, end_date: DAY, assignments }],
        };
      }
      if (
        sql.includes('FROM food_entries') &&
        sql.includes('meal_plan_template_id')
      ) {
        return {
          rows: existing.map((entry) => ({
            ...entry,
            meal_id: null,
            meal_type_id: 'mt',
            entry_date: DAY,
          })),
        };
      }
      if (sql.startsWith('SELECT * FROM foods')) {
        return {
          rows: [
            { id: 'f-cream', name: 'Heavy Whipping Cream', brand: 'Lucerne' },
          ],
        };
      }
      if (sql.startsWith('SELECT * FROM food_variants')) {
        return {
          rows: [
            {
              id: 'v-cream',
              serving_size: 1,
              serving_unit: 'oz',
              calories: 99,
            },
          ],
        };
      }
      if (sql.startsWith('INSERT INTO food_entries')) {
        return { rows: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }] };
      }
      return { rows: [] };
    });
  };

  const insertedFoodIds = () => {
    const insert = query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.startsWith('INSERT INTO food_entries'));
    return insert ? (insert.match(/f-cream/g)?.length ?? 0) : 0;
  };

  it('writes every copy when the plan is applied in bulk', async () => {
    install([cream(1), cream(1), cream(1)]);

    await createFoodEntriesFromTemplate('plan-1', 'u', DAY);

    expect(insertedFoodIds()).toBe(3);
  });

  it('writes only the copies that are not already in the diary', async () => {
    install(
      [cream(1), cream(1), cream(1)],
      [{ food_id: 'f-cream', variant_id: 'v-cream' }]
    );

    await createFoodEntriesFromTemplate('plan-1', 'u', DAY);

    expect(insertedFoodIds()).toBe(2);
  });

  it('adds the second copy on its own when that planned item is chosen', async () => {
    install([cream(1), cream(2)]);

    await createFoodEntriesFromTemplate('plan-1', 'u', DAY, {
      onlyDay: DAY,
      itemKey: keyFor(1),
    });

    expect(insertedFoodIds()).toBe(1);
  });
});
