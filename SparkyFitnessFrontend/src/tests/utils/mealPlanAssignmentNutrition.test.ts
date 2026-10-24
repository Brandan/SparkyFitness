import {
  nutritionMultiplier,
  scaleAssignmentNutrition,
  selectVariantForQuantity,
  type PlanFoodVariant,
} from '@/utils/mealPlanAssignmentNutrition';

const heavyCream: PlanFoodVariant[] = [
  {
    id: 'ml',
    is_default: true,
    serving_size: 15,
    serving_unit: 'ml',
    calories: 50,
    protein: 0,
    carbs: 1,
    fat: 5,
  },
  {
    id: 'oz',
    is_default: false,
    serving_size: 1,
    serving_unit: 'oz',
    calories: 98.56666666666666,
    protein: 0,
    carbs: 1.9713333333333334,
    fat: 9.856666666666667,
  },
];

const peanutButter: PlanFoodVariant[] = [
  {
    id: 'grams',
    is_default: true,
    serving_size: 53.9,
    serving_unit: 'g',
    calories: 178,
    protein: 31,
    carbs: 7,
    fat: 4,
  },
  {
    id: 'oz',
    is_default: false,
    serving_size: 1,
    serving_unit: 'oz',
    calories: 93.6217254174397,
    protein: 16.30490723562152,
    carbs: 3.6817532467532468,
    fat: 2.1038589981447124,
  },
];

describe('selectVariantForQuantity', () => {
  it('keeps the saved ounce serving instead of the millilitre default', () => {
    expect(selectVariantForQuantity(heavyCream, 'oz', 'oz')?.id).toBe('oz');
  });

  it('uses an ounce serving when the row is in ounces even if the saved id is the default', () => {
    expect(selectVariantForQuantity(heavyCream, 'ml', 'oz')?.id).toBe('oz');
  });

  it('keeps a gram serving for a gram quantity', () => {
    const variants: PlanFoodVariant[] = [
      {
        id: 'grams',
        is_default: true,
        serving_size: 7.8,
        serving_unit: 'g',
        calories: 5,
      },
      {
        id: 'scoop',
        is_default: false,
        serving_size: 1,
        serving_unit: 'level scoop',
        calories: 6.41025641025641,
      },
    ];
    expect(selectVariantForQuantity(variants, 'scoop', 'g')?.id).toBe('grams');
  });
});

describe('scaleAssignmentNutrition', () => {
  it('shows 99 kcal for 1 oz of heavy whipping cream', () => {
    const variant = selectVariantForQuantity(heavyCream, 'oz', 'oz')!;
    const scaled = scaleAssignmentNutrition({
      quantity: 1,
      unit: 'oz',
      ...variant,
    });
    expect(scaled.calories.toFixed(0)).toBe('99');
    expect(scaled.fat.toFixed(1)).toBe('9.9');
    expect(scaled.carbs.toFixed(1)).toBe('2.0');
    expect(scaled.protein.toFixed(1)).toBe('0.0');
  });

  it('shows the ounce serving of chocolate peanut butter, not 1 gram of the default', () => {
    const variant = selectVariantForQuantity(peanutButter, 'oz', 'oz')!;
    const scaled = scaleAssignmentNutrition({
      quantity: 1,
      unit: 'oz',
      ...variant,
    });
    expect(scaled.calories.toFixed(0)).toBe('94');
    expect(scaled.protein.toFixed(1)).toBe('16.3');
  });

  it('still scales a gram quantity against the gram serving', () => {
    const scaled = scaleAssignmentNutrition({
      quantity: 14,
      unit: 'g',
      serving_size: 100,
      serving_unit: 'g',
      calories: 615,
      protein: 7.7,
      carbs: 30.8,
      fat: 53.8,
    });
    expect(scaled.calories.toFixed(0)).toBe('86');
    expect(scaled.protein.toFixed(1)).toBe('1.1');
    expect(scaled.carbs.toFixed(1)).toBe('4.3');
    expect(scaled.fat.toFixed(1)).toBe('7.5');
  });

  it('converts ounces into a gram serving when that is the saved variant', () => {
    const scaled = scaleAssignmentNutrition({
      quantity: 1,
      unit: 'oz',
      serving_size: 53.9,
      serving_unit: 'g',
      calories: 178,
    });
    expect(scaled.calories).toBeCloseTo(93.62, 1);
  });

  it('scales a meal by quantity over serving size times total servings', () => {
    expect(nutritionMultiplier(2, 'serving', 1, 'serving', 4)).toBeCloseTo(0.5);
    expect(
      scaleAssignmentNutrition({
        quantity: 2,
        unit: 'serving',
        serving_size: 1,
        serving_unit: 'serving',
        total_servings: 4,
        calories: 520,
      }).calories
    ).toBeCloseTo(260);
  });
});
