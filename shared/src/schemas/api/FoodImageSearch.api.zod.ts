import { z } from 'zod';

/** `GET /api/foods/image-search?q=` */
export const foodImageSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});
export type FoodImageSearchQuery = z.infer<typeof foodImageSearchQuerySchema>;

export const foodImageSearchResultSchema = z.object({
  /** The original image on the site that published it. */
  url: z.string().url(),
  /** A small copy served by the search provider, for the results grid. */
  thumbnailUrl: z.string().url(),
  title: z.string(),
  /** The publishing site's host name, shown under the thumbnail. */
  source: z.string(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});
export type FoodImageSearchResult = z.infer<typeof foodImageSearchResultSchema>;

/**
 * `not_configured`: the person has no image search provider (a Brave Search
 * API key in Settings > External Providers), so nothing was searched.
 */
export const foodImageSearchResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    results: z.array(foodImageSearchResultSchema),
  }),
  z.object({ status: z.literal('not_configured') }),
]);
export type FoodImageSearchResponse = z.infer<
  typeof foodImageSearchResponseSchema
>;

/**
 * `GET /api/foods/image-search/download?url=` returns the image bytes. Only a
 * `url` this person got from a search in the last half hour is fetched.
 */
export const foodImageDownloadQuerySchema = z.object({
  url: z.string().url().max(2048),
});
export type FoodImageDownloadQuery = z.infer<
  typeof foodImageDownloadQuerySchema
>;
