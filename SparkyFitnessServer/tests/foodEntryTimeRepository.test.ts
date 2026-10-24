import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import { setFoodEntryTimes } from '../models/foodEntryTimeRepository.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

const FOOD_ID = '44444444-4444-4444-8444-444444444444';
const MEAL_ID = '55555555-5555-4555-8555-555555555555';

describe('setFoodEntryTimes', () => {
  const query = vi.fn();
  const release = vi.fn();

  beforeEach(() => {
    query.mockReset();
    release.mockReset();
    vi.mocked(getClient).mockReset();
    vi.mocked(getClient).mockResolvedValue({ query, release } as never);
  });

  it('updates foods and meals in one transaction and carries a meal time to its foods', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE')) return { rowCount: 1, rows: [] };
      return { rows: [] };
    });

    const updated = await setFoodEntryTimes('owner', 'actor', [
      { kind: 'foodEntry', id: FOOD_ID, entry_time: '08:20' },
      { kind: 'foodEntryMeal', id: MEAL_ID, entry_time: null },
    ]);

    expect(updated).toBe(2);
    expect(getClient).toHaveBeenCalledWith('owner', 'actor');
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toBe('BEGIN');
    expect(statements.at(-1)).toBe('COMMIT');

    const componentUpdate = query.mock.calls.find(([sql]) =>
      String(sql).includes('fe.food_entry_meal_id = c.id')
    );
    expect(componentUpdate?.[1]).toEqual(['owner', 'actor', [MEAL_ID], [null]]);

    // Only the time is written; no nutrition column appears in any update.
    for (const sql of statements.filter((s) => s.includes('UPDATE'))) {
      expect(sql).not.toMatch(/calories|quantity|serving/);
    }
    expect(release).toHaveBeenCalled();
  });

  it('rolls back and reports 404 when an entry is not found', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE')) return { rowCount: 0, rows: [] };
      return { rows: [] };
    });

    await expect(
      setFoodEntryTimes('owner', 'actor', [
        { kind: 'foodEntry', id: FOOD_ID, entry_time: '08:20' },
      ])
    ).rejects.toMatchObject({ statusCode: 404 });

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
    expect(release).toHaveBeenCalled();
  });

  it('rolls back on a database error', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE')) throw new Error('boom');
      return { rows: [] };
    });

    await expect(
      setFoodEntryTimes('owner', 'actor', [
        { kind: 'foodEntry', id: FOOD_ID, entry_time: '08:20' },
      ])
    ).rejects.toThrow('boom');
    expect(query.mock.calls.map(([sql]) => String(sql))).toContain('ROLLBACK');
  });
});
