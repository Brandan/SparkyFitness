import type {
  AddedPlannedMeal,
  CreatePlannedFoodBody,
  UpdatePlannedFoodBody,
  PlannedMealActionBody,
  PlannedMealItem,
  PlannedMealRestoreBody,
} from '@workspace/shared';
import { apiFetch } from './apiClient';

const SERVICE_NAME = 'Planned Meals API';
const BASE = '/api/meal-plan-templates/planned';

export async function fetchPlannedMeals(
  date: string
): Promise<PlannedMealItem[]> {
  const params = new URLSearchParams({ date });
  return apiFetch<PlannedMealItem[]>({
    endpoint: `${BASE}?${params.toString()}`,
    serviceName: SERVICE_NAME,
    operation: 'fetch planned meals',
  });
}

export async function addPlannedMeal(
  target: PlannedMealActionBody
): Promise<AddedPlannedMeal> {
  return apiFetch<AddedPlannedMeal>({
    endpoint: `${BASE}/add`,
    serviceName: SERVICE_NAME,
    operation: 'add planned meal',
    method: 'POST',
    body: target,
  });
}

export async function skipPlannedMeal(
  target: PlannedMealActionBody
): Promise<void> {
  return apiFetch<void>({
    endpoint: `${BASE}/skip`,
    serviceName: SERVICE_NAME,
    operation: 'remove planned meal',
    method: 'POST',
    body: target,
  });
}

export async function restorePlannedMeal(
  target: PlannedMealActionBody &
    Partial<
      Pick<PlannedMealRestoreBody, 'food_entry_ids' | 'food_entry_meal_ids'>
    >
): Promise<void> {
  return apiFetch<void>({
    endpoint: `${BASE}/restore`,
    serviceName: SERVICE_NAME,
    operation: 'restore planned meal',
    method: 'POST',
    body: { food_entry_ids: [], food_entry_meal_ids: [], ...target },
  });
}

export async function createPlannedFood(
  body: CreatePlannedFoodBody
): Promise<PlannedMealItem> {
  return apiFetch<PlannedMealItem>({
    endpoint: `${BASE}/items`,
    serviceName: SERVICE_NAME,
    operation: 'plan food',
    method: 'POST',
    body,
  });
}

export async function updatePlannedFood(
  id: string,
  body: UpdatePlannedFoodBody
): Promise<PlannedMealItem> {
  return apiFetch<PlannedMealItem>({
    endpoint: `${BASE}/items/${id}`,
    serviceName: SERVICE_NAME,
    operation: 'change planned food',
    method: 'PUT',
    body,
  });
}
