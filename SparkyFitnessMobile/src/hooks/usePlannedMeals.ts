import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PlannedMealActionBody,
  UpdatePlannedFoodBody,
} from '@workspace/shared';
import {
  addPlannedMeal,
  createPlannedFood,
  updatePlannedFood,
  fetchPlannedMeals,
  restorePlannedMeal,
  skipPlannedMeal,
} from '../services/api/plannedMealsApi';
import { invalidateFoodCache } from './invalidateFoodCache';
import { plannedMealsQueryKey, plannedMealsRootQueryKey } from './queryKeys';

const EMPTY_PLANNED: Awaited<ReturnType<typeof fetchPlannedMeals>> = [];

export function usePlannedMeals(date: string, options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: plannedMealsQueryKey(date),
    queryFn: () => fetchPlannedMeals(date),
    enabled: options?.enabled ?? true,
  });

  return {
    plannedMeals: query.data ?? EMPTY_PLANNED,
    isLoading: query.isLoading,
  };
}

/** Adding, removing and undoing all change both the planned list and the day's diary. */
function usePlannedMealMutations(date: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: plannedMealsRootQueryKey });
    invalidateFoodCache(queryClient, date);
  };

  const add = useMutation({
    mutationFn: (target: PlannedMealActionBody) => addPlannedMeal(target),
    onSuccess: refresh,
  });
  const skip = useMutation({
    mutationFn: (target: PlannedMealActionBody) => skipPlannedMeal(target),
    onSuccess: refresh,
  });
  const restore = useMutation({
    mutationFn: restorePlannedMeal,
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: UpdatePlannedFoodBody & { id: string }) =>
      updatePlannedFood(id, body),
    onSuccess: refresh,
  });

  return {
    updatePlannedFoodAsync: update.mutateAsync,
    addPlannedMealAsync: add.mutateAsync,
    skipPlannedMealAsync: skip.mutateAsync,
    restorePlannedMealAsync: restore.mutateAsync,
    isPending:
      add.isPending || skip.isPending || restore.isPending || update.isPending,
  };
}

/** Plans one food on a day and meal outside any meal plan. */
function useCreatePlannedFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPlannedFood,
    onSuccess: (_planned, body) => {
      void queryClient.invalidateQueries({
        queryKey: plannedMealsRootQueryKey,
      });
      invalidateFoodCache(queryClient, body.date);
    },
  });
}

export { usePlannedMealMutations, useCreatePlannedFood };
