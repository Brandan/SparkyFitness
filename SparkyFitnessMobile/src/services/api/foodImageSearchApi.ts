import { Directory, File, Paths } from 'expo-file-system';
import {
  foodImageSearchResponseSchema,
  type FoodImageSearchResponse,
  type FoodImageSearchResult,
} from '@workspace/shared';
import { apiFetch, normalizeUrl } from './apiClient';
import { getAuthHeaders } from './authService';
import { getActiveServerConfig, proxyHeadersToRecord } from '../storage';

/** Searches the web for food photos with the account's Brave Search provider. */
export const searchFoodImages = async (
  query: string
): Promise<FoodImageSearchResponse> => {
  const response = await apiFetch<unknown>({
    endpoint: `/api/foods/image-search?q=${encodeURIComponent(query)}`,
    serviceName: 'Food Image Search API',
    operation: 'search food images',
  });
  return foodImageSearchResponseSchema.parse(response);
};

/**
 * Saves one search result to the cache through the server (which fetches it
 * from the web) and returns its file URI, ready to stage in the image picker
 * like a photo from the library. Each download gets its own folder because
 * the server names every file `web-image.<ext>`.
 */
export const downloadFoodImage = async (
  result: FoodImageSearchResult
): Promise<string> => {
  const config = await getActiveServerConfig();
  if (!config) throw new Error('Server configuration not found.');
  const baseUrl = normalizeUrl(config.url);
  if (!__DEV__ && baseUrl.toLowerCase().startsWith('http://')) {
    throw new Error(
      'HTTPS is required for server connections. Please update your server URL in Settings.'
    );
  }
  const folder = new Directory(
    Paths.cache,
    'food-web-images',
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  folder.create({ intermediates: true, idempotent: true });
  const file = await File.downloadFileAsync(
    `${baseUrl}/api/foods/image-search/download?url=${encodeURIComponent(result.url)}`,
    folder,
    {
      headers: {
        ...proxyHeadersToRecord(config.proxyHeaders),
        ...getAuthHeaders(config),
      },
    }
  );
  return file.uri;
};
