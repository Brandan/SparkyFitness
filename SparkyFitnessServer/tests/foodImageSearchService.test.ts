import { vi, beforeEach, describe, expect, it } from 'vitest';
import externalProviderRepository from '../models/externalProviderRepository.js';
import {
  downloadSearchedImage,
  ImageSearchProviderError,
  mapBraveResults,
  searchFoodImages,
  UnknownImageResultError,
} from '../services/foodImageSearchService.js';

vi.mock('../config/logging', () => ({ log: vi.fn() }));
vi.mock('../models/externalProviderRepository', () => ({
  default: { getActiveProviderWithKeyByType: vi.fn() },
}));

const getProvider = vi.mocked(
  externalProviderRepository.getActiveProviderWithKeyByType
);

const providerRow = (app_key: string | null) => ({
  id: 'p1',
  user_id: 'owner-1',
  provider_name: 'Brave',
  base_url: '',
  app_key,
});

const braveResult = (n: number) => ({
  type: 'image_result',
  title: ` Apple ${n} `,
  url: `https://www.example.com/page-${n}`,
  source: n === 1 ? '' : 'example.com',
  thumbnail: { src: `https://imgs.search.brave.com/thumb-${n}.jpg` },
  properties: {
    url: `https://cdn.example.com/apple-${n}.jpg`,
    width: 800,
    height: 600,
  },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mapBraveResults', () => {
  it('maps results and falls back to the page host for the source', () => {
    const results = mapBraveResults({ results: [braveResult(1)] });
    expect(results).toEqual([
      {
        url: 'https://cdn.example.com/apple-1.jpg',
        thumbnailUrl: 'https://imgs.search.brave.com/thumb-1.jpg',
        title: 'Apple 1',
        source: 'example.com',
        width: 800,
        height: 600,
      },
    ]);
  });

  it('drops results without both images, non-http URLs and repeats', () => {
    const noThumb = { ...braveResult(2), thumbnail: {} };
    const ftp = {
      ...braveResult(3),
      properties: { url: 'ftp://example.com/a.jpg' },
    };
    const results = mapBraveResults({
      results: [braveResult(4), braveResult(4), noThumb, ftp, 'junk'],
    });
    expect(results.map((r) => r.url)).toEqual([
      'https://cdn.example.com/apple-4.jpg',
    ]);
  });

  it('keeps unknown dimensions as null and ignores a malformed payload', () => {
    const [result] = mapBraveResults({
      results: [
        {
          ...braveResult(5),
          properties: { url: braveResult(5).properties.url, width: 0 },
        },
      ],
    });
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(mapBraveResults({ results: 'nope' })).toEqual([]);
  });
});

describe('searchFoodImages', () => {
  it('sends nothing when the person has no Brave Search key', async () => {
    getProvider.mockResolvedValue(providerRow('  '));
    const fetchImpl = vi.fn();
    await expect(
      searchFoodImages('user-a', 'apple', fetchImpl)
    ).resolves.toEqual({ status: 'not_configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(getProvider).toHaveBeenCalledWith('user-a', 'brave_search', {
      requireBaseUrl: false,
    });
  });

  it('asks Brave with the key and a strict safe search', async () => {
    getProvider.mockResolvedValue(providerRow('secret'));
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ results: [braveResult(1)] })
    );
    const response = await searchFoodImages(
      'user-b',
      'greek yogurt',
      fetchImpl as unknown as typeof fetch
    );
    expect(response.status).toBe('ok');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.origin + url.pathname).toBe(
      'https://api.search.brave.com/res/v1/images/search'
    );
    expect(url.searchParams.get('q')).toBe('greek yogurt');
    expect(url.searchParams.get('safesearch')).toBe('strict');
    expect(
      (init.headers as Record<string, string>)['X-Subscription-Token']
    ).toBe('secret');
  });

  it.each([
    [401, 'rejected_key'],
    [429, 'rate_limited'],
    [500, 'unavailable'],
  ])('turns HTTP %i into a %s error', async (status, kind) => {
    getProvider.mockResolvedValue(providerRow('secret'));
    const fetchImpl = vi.fn(async () => jsonResponse({}, status));
    const error = await searchFoodImages(
      'user-c',
      'apple',
      fetchImpl as unknown as typeof fetch
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImageSearchProviderError);
    expect((error as ImageSearchProviderError).kind).toBe(kind);
  });
});

describe('downloadSearchedImage', () => {
  const image = { bytes: Buffer.from([1, 2, 3]), contentType: 'image/jpeg' };

  async function searchAs(userId: string) {
    getProvider.mockResolvedValue(providerRow('secret'));
    await searchFoodImages(userId, 'apple', (async () =>
      jsonResponse({ results: [braveResult(7)] })) as unknown as typeof fetch);
  }

  it('refuses a URL the person was not shown', async () => {
    await searchAs('user-d');
    const fetchBytes = vi.fn();
    await expect(
      downloadSearchedImage('user-d', 'http://169.254.169.254/', fetchBytes)
    ).rejects.toBeInstanceOf(UnknownImageResultError);
    // Another person's results do not count either.
    await expect(
      downloadSearchedImage(
        'user-e',
        'https://cdn.example.com/apple-7.jpg',
        fetchBytes
      )
    ).rejects.toBeInstanceOf(UnknownImageResultError);
    expect(fetchBytes).not.toHaveBeenCalled();
  });

  it('fetches the original image', async () => {
    await searchAs('user-f');
    const fetchBytes = vi.fn(async () => image);
    await expect(
      downloadSearchedImage(
        'user-f',
        'https://cdn.example.com/apple-7.jpg',
        fetchBytes
      )
    ).resolves.toBe(image);
    expect(fetchBytes).toHaveBeenCalledWith(
      'https://cdn.example.com/apple-7.jpg'
    );
  });

  it("falls back to Brave's copy when the original fails", async () => {
    await searchAs('user-g');
    const fetchBytes = vi
      .fn()
      .mockRejectedValueOnce(new Error('403'))
      .mockResolvedValueOnce(image);
    await expect(
      downloadSearchedImage(
        'user-g',
        'https://cdn.example.com/apple-7.jpg',
        fetchBytes
      )
    ).resolves.toBe(image);
    expect(fetchBytes).toHaveBeenLastCalledWith(
      'https://imgs.search.brave.com/thumb-7.jpg'
    );
  });
});
