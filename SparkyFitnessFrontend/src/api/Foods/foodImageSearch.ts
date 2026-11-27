import {
  foodImageSearchResponseSchema,
  type FoodImageSearchResponse,
  type FoodImageSearchResult,
} from '@workspace/shared';
import { apiCall } from '../api';

/** Searches the web for food photos with the person's Brave Search provider. */
export async function searchFoodImages(
  query: string
): Promise<FoodImageSearchResponse> {
  const response = await apiCall('/foods/image-search', {
    method: 'GET',
    params: { q: query },
    // The dialog shows the error itself, next to the search box.
    suppressErrorToast: true,
  });
  return foodImageSearchResponseSchema.parse(response);
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Fetches a search result through the server (the browser cannot read another
 * site's image) and wraps it as a File, so it is uploaded on save like a photo
 * the person picked from disk.
 */
export async function downloadFoodImage(
  result: FoodImageSearchResult
): Promise<File> {
  const blob = await apiCall('/foods/image-search/download', {
    method: 'GET',
    params: { url: result.url },
    responseType: 'blob',
    suppressErrorToast: true,
  });
  const type = blob.type || 'image/jpeg';
  const extension = EXTENSIONS[type] ?? 'jpg';
  return new File([blob], `web-image.${extension}`, { type });
}
