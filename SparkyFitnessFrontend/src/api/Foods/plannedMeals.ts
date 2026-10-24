import type {
  AddedPlannedMeal,
  PlannedMealActionBody,
  PlannedMealItem,
  PlannedMealRestoreBody,
} from '@workspace/shared';
import { api } from '@/api/api';

export const getPlannedMeals = async (
  date: string
): Promise<PlannedMealItem[]> => {
  return await api.get('/meal-plan-templates/planned', { params: { date } });
};

export const addPlannedMeal = async (
  target: PlannedMealActionBody
): Promise<AddedPlannedMeal> => {
  return await api.post('/meal-plan-templates/planned/add', { body: target });
};

export const skipPlannedMeal = async (
  target: PlannedMealActionBody
): Promise<void> => {
  await api.post('/meal-plan-templates/planned/skip', { body: target });
};

export const restorePlannedMeal = async (
  target: Omit<
    PlannedMealRestoreBody,
    'food_entry_ids' | 'food_entry_meal_ids'
  > &
    Partial<
      Pick<PlannedMealRestoreBody, 'food_entry_ids' | 'food_entry_meal_ids'>
    >
): Promise<void> => {
  await api.post('/meal-plan-templates/planned/restore', {
    body: { food_entry_ids: [], food_entry_meal_ids: [], ...target },
  });
};
