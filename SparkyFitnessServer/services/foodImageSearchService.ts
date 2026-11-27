import { z } from 'zod';
import {
  IMAGE_SEARCH_PROVIDER_TYPE,
  type FoodImageSearchResponse,
  type FoodImageSearchResult,
} from '@workspace/shared';
import { log } from '../config/logging.js';
import externalProviderRepository from '../models/externalProviderRepository.js';
import { describeError } from '../utils/errors.js';
import {
  fetchImageBytes,
  type FetchedImage,
} from '../utils/imageDownloader.js';
import { TtlCache } from '../utils/ttlCache.js';

const BRAVE_IMAGE_SEARCH_URL =
  'https://api.search.brave.com/res/v1/images/search';
const RESULT_COUNT = 24;
const SEARCH_TIMEOUT_MS = 10_000;

// Only the fields used here; Brave sends more, and any of these may be absent.
const braveImageResultSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  source: z.string().optional(),
  thumbnail: z.object({ src: z.string().optional() }).optional(),
  properties: z
    .object({
      url: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
});
const braveImageResponseSchema = z.object({
  results: z.array(z.unknown()).optional(),
});

/** The error a client sees when Brave refuses or fails the search. */
export class ImageSearchProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'rejected_key' | 'rate_limited' | 'unavailable'
  ) {
    super(message);
    this.name = 'ImageSearchProviderError';
  }
}

/** A download was asked for a URL that was not in this person's results. */
export class UnknownImageResultError extends Error {
  constructor() {
    super('That image is not from a recent search. Search again.');
    this.name = 'UnknownImageResultError';
  }
}

function httpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function positiveInt(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function hostOf(value: string | null): string {
  if (!value) return '';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Turns Brave's result list into ours, dropping results without both images. */
export function mapBraveResults(payload: unknown): FoodImageSearchResult[] {
  const parsed = braveImageResponseSchema.safeParse(payload);
  if (!parsed.success) return [];
  const results: FoodImageSearchResult[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.data.results ?? []) {
    const item = braveImageResultSchema.safeParse(raw);
    if (!item.success) continue;
    const url = httpUrl(item.data.properties?.url);
    const thumbnailUrl = httpUrl(item.data.thumbnail?.src);
    if (!url || !thumbnailUrl || seen.has(url)) continue;
    seen.add(url);
    const pageUrl = httpUrl(item.data.url);
    results.push({
      url,
      thumbnailUrl,
      title: item.data.title?.trim() ?? '',
      source: item.data.source?.trim() || hostOf(pageUrl) || hostOf(url),
      width: positiveInt(item.data.properties?.width),
      height: positiveInt(item.data.properties?.height),
    });
  }
  return results;
}

// What each person was shown, so a download only fetches one of those images
// (with Brave's own copy to fall back on) and never an arbitrary URL. In
// memory, per instance, like the user rate limiters: after a restart, or on
// another instance, the person searches again.
const RESULT_TTL_MS = 30 * 60 * 1000;
const recentResults = new TtlCache<Map<string, string>>(RESULT_TTL_MS, 500);

function rememberResults(userId: string, results: FoodImageSearchResult[]) {
  const known = new Map(recentResults.get(userId) ?? []);
  for (const result of results) known.set(result.url, result.thumbnailUrl);
  // Keep the newest few searches' worth; Map keeps insertion order.
  while (known.size > RESULT_COUNT * 8) {
    const oldest = known.keys().next().value;
    if (oldest === undefined) break;
    known.delete(oldest);
  }
  recentResults.set(userId, known);
}

async function resolveApiKey(userId: string): Promise<string | null> {
  const row = await externalProviderRepository.getActiveProviderWithKeyByType(
    userId,
    IMAGE_SEARCH_PROVIDER_TYPE,
    { requireBaseUrl: false }
  );
  return row?.app_key?.trim() || null;
}

/**
 * Searches the web for food photos with the person's Brave Search provider
 * (their own, an admin's public one, or one a family member shared).
 */
export async function searchFoodImages(
  userId: string,
  query: string,
  fetchImpl: typeof fetch = fetch
): Promise<FoodImageSearchResponse> {
  const apiKey = await resolveApiKey(userId);
  if (!apiKey) return { status: 'not_configured' };

  const url = new URL(BRAVE_IMAGE_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(RESULT_COUNT));
  url.searchParams.set('safesearch', 'strict');

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      redirect: 'error',
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
  } catch (error) {
    log('warn', `Brave image search failed: ${describeError(error)}`);
    throw new ImageSearchProviderError(
      'Brave Search did not answer. Try again.',
      'unavailable'
    );
  }

  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel();
    throw new ImageSearchProviderError(
      'Brave Search rejected the API key. Check it in Settings > External Providers.',
      'rejected_key'
    );
  }
  if (response.status === 429) {
    await response.body?.cancel();
    throw new ImageSearchProviderError(
      'Brave Search limit reached. Try again later.',
      'rate_limited'
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    log('warn', `Brave image search returned ${response.status}`);
    throw new ImageSearchProviderError(
      'Brave Search did not answer. Try again.',
      'unavailable'
    );
  }

  const results = mapBraveResults(await response.json());
  rememberResults(userId, results);
  return { status: 'ok', results };
}

/**
 * Fetches one image the person was shown. The original is tried first; when
 * the site refuses (hotlink protection, an expired link, a non-image answer),
 * Brave's own copy is used instead, so picking a result nearly always works.
 */
export async function downloadSearchedImage(
  userId: string,
  imageUrl: string,
  fetchBytes: (url: string) => Promise<FetchedImage> = fetchImageBytes
): Promise<FetchedImage> {
  const thumbnailUrl = recentResults.get(userId)?.get(imageUrl);
  if (!thumbnailUrl) throw new UnknownImageResultError();
  try {
    return await fetchBytes(imageUrl);
  } catch (error) {
    log(
      'info',
      `Original search image unavailable, using the search copy: ${describeError(error)}`
    );
    return fetchBytes(thumbnailUrl);
  }
}
