import { describe, it, expect } from 'vitest';
import { scalePlannedNutrition, sumPlannedNutrition } from '@workspace/shared';

describe('sumPlannedNutrition', () => {
  it('adds every nutrient across items, custom ones by name', () => {
    const total = sumPlannedNutrition([
      {
        calories: 100,
        nutrition: scalePlannedNutrition(
          { calories: 100, protein: 5, custom_nutrients: { Choline: 10 } },
          1
        ),
      },
      {
        calories: 50,
        nutrition: scalePlannedNutrition(
          { calories: 50, protein: 2, custom_nutrients: { Choline: 4 } },
          1
        ),
      },
    ]);

    expect(total.calories).toBe(150);
    expect(total.protein).toBe(7);
    expect(total.custom_nutrients.Choline).toBe(14);
  });

  it('counts only calories for an item from an older server', () => {
    const total = sumPlannedNutrition([{ calories: 300 }, { calories: null }]);

    expect(total.calories).toBe(300);
    expect(total.protein).toBe(0);
  });

  it('ignores custom values that are not numbers', () => {
    const scaled = scalePlannedNutrition(
      { custom_nutrients: { Choline: 'n/a', Zinc: '2' } },
      2
    );

    expect(scaled.custom_nutrients).toEqual({ Zinc: 4 });
  });
});
