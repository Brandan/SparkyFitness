import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import {
  copyFoodEntryItem,
  type CopyFoodEntryItemPayload,
} from '../services/api/foodEntriesApi';
import { invalidateFoodCache } from './invalidateFoodCache';

interface UseCopyFoodEntryItemOptions {
  onSuccess?: (payload: CopyFoodEntryItemPayload) => void;
}

export function useCopyFoodEntryItem(options?: UseCopyFoodEntryItemOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: CopyFoodEntryItemPayload) =>
      copyFoodEntryItem(payload),
    onSuccess: (_data, payload) => {
      // Only the target day changes; the original item is left untouched.
      invalidateFoodCache(queryClient, payload.targetDate);
      Toast.show({
        type: 'success',
        text1: t('copyItem.success', { defaultValue: 'Copied' }),
      });
      options?.onSuccess?.(payload);
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: t('copyItem.failed', { defaultValue: 'Failed to copy' }),
        text2: t('common.tryAgain', { defaultValue: 'Please try again.' }),
      });
    },
  });

  return {
    copyItem: mutation.mutate,
    isPending: mutation.isPending,
  };
}
