import { fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MealPlanTemplateForm from '@/pages/Foods/MealPlanTemplateForm';
import type { MealPlanTemplate } from '@/types/meal';
import { renderWithClient } from '@/tests/test-utils';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ loggingLevel: 'SILENT' }),
}));
jest.mock('@/hooks/Diary/useMealTypes', () => ({
  useMealTypes: () => ({
    data: [{ id: 'breakfast', name: 'Breakfast' }],
  }),
}));
jest.mock('@/components/FoodSearch/FoodSearchDialog', () => () => null);
jest.mock('@/pages/Foods/CopyDayDialog', () => () => null);

const getFoodById = jest.fn();
const getMealById = jest.fn();

jest.mock('@/api/Foods/foodService', () => ({
  getFoodById: (...args: unknown[]) => getFoodById(...args),
}));
jest.mock('@/api/Foods/meals', () => ({
  getMealById: (...args: unknown[]) => getMealById(...args),
}));

const template: MealPlanTemplate = {
  id: 'plan-1',
  plan_name: 'Weekday',
  start_date: '2026-10-24',
  end_date: '2026-10-31',
  is_active: true,
  auto_log: false,
  assignments: [
    {
      item_type: 'food',
      day_of_week: 0,
      meal_type: 'Breakfast',
      food_id: 'eggs',
      food_name: 'Eggs',
      quantity: 2,
      unit: 'large',
    },
    {
      item_type: 'food',
      day_of_week: 0,
      meal_type: 'Breakfast',
      food_id: 'water',
      food_name: 'Water',
      quantity: 1,
      unit: 'cup',
    },
    {
      item_type: 'meal',
      day_of_week: 0,
      meal_type: 'Breakfast',
      meal_id: 'omelette',
      meal_name: 'Omelette',
      quantity: 1,
      unit: 'serving',
    },
  ],
};

const variant = {
  calories: 70,
  protein: 6,
  carbs: 1,
  fat: 5,
  serving_size: 1,
  serving_unit: 'serving',
};

describe('MealPlanTemplateForm pictures', () => {
  beforeEach(() => {
    getFoodById.mockImplementation(async (foodId: string) => {
      if (foodId === 'eggs') {
        return {
          id: 'eggs',
          name: 'Eggs',
          brand: 'Lucerne',
          images: ['/uploads/foods/eggs.png', '/uploads/foods/eggs-2.png'],
          default_variant: variant,
        };
      }
      return {
        id: 'water',
        name: 'Water',
        brand: '   ',
        images: [],
        default_variant: variant,
      };
    });
    getMealById.mockResolvedValue({
      id: 'omelette',
      name: 'Omelette',
      images: [],
      serving_size: 1,
      serving_unit: 'serving',
      total_servings: 1,
      foods: [
        { quantity: 1, serving_size: 1, calories: 0, food_images: [] },
        {
          quantity: 1,
          serving_size: 1,
          calories: 90,
          protein: 6,
          carbs: 1,
          fat: 7,
          food_images: ['/uploads/foods/omelette.png'],
        },
      ],
    });
  });

  it('shows a food picture and a meal’s ingredient picture, and opens the viewer', async () => {
    renderWithClient(
      <MealPlanTemplateForm
        template={template}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(await screen.findByRole('img', { name: 'Eggs' })).toHaveAttribute(
      'src',
      '/uploads/foods/eggs.png'
    );
    expect(screen.getByRole('img', { name: 'Omelette' })).toHaveAttribute(
      'src',
      '/uploads/foods/omelette.png'
    );
    expect(screen.getByText('Lucerne')).toBeInTheDocument();
    expect(screen.getAllByText('Lucerne')).toHaveLength(1);
    expect(
      screen.queryByRole('img', { name: 'Water' })
    ).not.toBeInTheDocument();

    const eggs = screen.getByRole('img', { name: 'Eggs' });
    fireEvent.click(eggs.closest('button')!);

    expect(
      await screen.findByRole('dialog', { name: 'Eggs' })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Food image 1' })).toHaveAttribute(
      'src',
      '/uploads/foods/eggs.png'
    );
  });
});
