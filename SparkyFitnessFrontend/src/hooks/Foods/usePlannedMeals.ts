import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PlannedMealActionBody } from '@workspace/shared';
import {
  addPlannedMeal,
  getPlannedMeals,
  restorePlannedMeal,
  skipPlannedMeal,
} from '@/api/Foods/plannedMeals';
import { plannedMealKeys } from '@/api/keys/meals';
import { useDiaryInvalidation } from '@/hooks/useInvalidateKeys';

export const usePlannedMeals = (date: string) => {
  const { t } = useTranslation();
  return useQuery({
    queryKey: plannedMealKeys.byDate(date),
    queryFn: () => getPlannedMeals(date),
    enabled: !!date,
    meta: {
      errorMessage: t(
        'plannedMeals.loadError',
        'Failed to load planned meals.'
      ),
    },
  });
};

export const useAddPlannedMealMutation = () => {
  const { t } = useTranslation();
  const invalidateDiary = useDiaryInvalidation();
  return useMutation({
    mutationFn: (target: PlannedMealActionBody) => addPlannedMeal(target),
    onSuccess: invalidateDiary,
    meta: {
      errorMessage: t(
        'plannedMeals.addError',
        'Could not add the planned meal to your diary.'
      ),
    },
  });
};

export const useSkipPlannedMealMutation = () => {
  const { t } = useTranslation();
  const invalidateDiary = useDiaryInvalidation();
  return useMutation({
    mutationFn: (target: PlannedMealActionBody) => skipPlannedMeal(target),
    onSuccess: invalidateDiary,
    meta: {
      errorMessage: t(
        'plannedMeals.skipError',
        'Could not remove the planned meal.'
      ),
    },
  });
};

export const useRestorePlannedMealMutation = () => {
  const { t } = useTranslation();
  const invalidateDiary = useDiaryInvalidation();
  return useMutation({
    mutationFn: restorePlannedMeal,
    onSuccess: invalidateDiary,
    meta: {
      errorMessage: t('plannedMeals.undoError', 'Could not undo that.'),
    },
  });
};
