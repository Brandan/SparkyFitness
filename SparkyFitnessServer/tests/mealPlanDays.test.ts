import { describe, it, expect } from 'vitest';
import { copyDayAssignments, countAssignmentsByDay } from '@workspace/shared';

type Row = { id?: string; day_of_week: number; name: string };

const sunday: Row[] = [
  { id: 'a', day_of_week: 0, name: 'Eggs' },
  { id: 'b', day_of_week: 0, name: 'Salad' },
];

describe('copyDayAssignments', () => {
  it('copies one day onto the chosen days, as new rows', () => {
    const result = copyDayAssignments(sunday, 0, [1, 3]);

    expect(
      result.filter((r) => r.day_of_week === 1).map((r) => r.name)
    ).toEqual(['Eggs', 'Salad']);
    expect(result.filter((r) => r.day_of_week === 3)).toHaveLength(2);
    expect(result.filter((r) => r.day_of_week === 2)).toHaveLength(0);
    expect(
      result.filter((r) => r.day_of_week !== 0).every((r) => r.id === undefined)
    ).toBe(true);
    // The source day is unchanged.
    expect(result.filter((r) => r.day_of_week === 0)).toEqual(sunday);
  });

  it('replaces what a target day already held, and leaves other days alone', () => {
    const items: Row[] = [
      ...sunday,
      { id: 'c', day_of_week: 1, name: 'Old Monday' },
      { id: 'd', day_of_week: 2, name: 'Tuesday keeps this' },
    ];

    const result = copyDayAssignments(items, 0, [1]);

    expect(result.map((r) => r.name)).not.toContain('Old Monday');
    expect(
      result.filter((r) => r.day_of_week === 1).map((r) => r.name)
    ).toEqual(['Eggs', 'Salad']);
    expect(result.find((r) => r.day_of_week === 2)?.id).toBe('d');
  });

  it('ignores the source day among the targets and repeated days', () => {
    const result = copyDayAssignments(sunday, 0, [0, 4, 4]);

    expect(result.filter((r) => r.day_of_week === 0)).toHaveLength(2);
    expect(result.filter((r) => r.day_of_week === 4)).toHaveLength(2);
  });

  it('copies an empty day to clear the targets', () => {
    const items: Row[] = [{ id: 'c', day_of_week: 1, name: 'Monday' }];

    expect(copyDayAssignments(items, 0, [1])).toEqual([]);
  });

  it('keeps parallel lists index-aligned', () => {
    const a: Row[] = [
      { id: '1', day_of_week: 0, name: 'x' },
      { id: '2', day_of_week: 5, name: 'y' },
      { id: '3', day_of_week: 0, name: 'z' },
    ];
    const b = a.map((row) => ({ ...row, extra: row.name.toUpperCase() }));

    const resultA = copyDayAssignments(a, 0, [2, 5]);
    const resultB = copyDayAssignments(b, 0, [2, 5]);

    expect(resultB.map((r) => [r.day_of_week, r.name])).toEqual(
      resultA.map((r) => [r.day_of_week, r.name])
    );
  });
});

describe('countAssignmentsByDay', () => {
  it('counts items for each weekday, Sunday first', () => {
    expect(
      countAssignmentsByDay([
        { day_of_week: 0 },
        { day_of_week: 0 },
        { day_of_week: 6 },
      ])
    ).toEqual([2, 0, 0, 0, 0, 0, 1]);
  });
});
