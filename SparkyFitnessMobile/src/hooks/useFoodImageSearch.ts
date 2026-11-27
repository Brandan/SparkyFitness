import { useMutation, useQuery } from '@tanstack/react-query';
import {
  downloadFoodImage,
  searchFoodImages,
} from '../services/api/foodImageSearchApi';
import { foodImageSearchQueryKey } from './queryKeys';

/**
 * One web image search. Runs only for a submitted, non-empty query; the same
 * words within a few minutes reuse the results instead of spending another
 * search of the account's Brave quota.
 */
export function useFoodImageSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: foodImageSearchQueryKey(trimmed),
    queryFn: () => searchFoodImages(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useDownloadFoodImage() {
  return useMutation({ mutationFn: downloadFoodImage });
}
