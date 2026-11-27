import { useMutation, useQuery } from '@tanstack/react-query';
import {
  downloadFoodImage,
  searchFoodImages,
} from '@/api/Foods/foodImageSearch';

export const foodImageSearchKeys = {
  all: ['foodImageSearch'] as const,
  search: (query: string) => [...foodImageSearchKeys.all, query] as const,
};

/**
 * One web image search. Runs only for a submitted, non-empty query; a repeat
 * of the same words within a few minutes reuses the results instead of
 * spending another search.
 */
export function useFoodImageSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: foodImageSearchKeys.search(trimmed),
    queryFn: () => searchFoodImages(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useDownloadFoodImage() {
  return useMutation({ mutationFn: downloadFoodImage });
}
