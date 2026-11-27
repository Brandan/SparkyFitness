import { vi, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'supertest'
import request from 'supertest';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import foodImageSearchRoutes, {
  imageDownloadLimiter,
  imageSearchLimiter,
} from '../routes/foodImageSearchRoutes.js';
import {
  downloadSearchedImage,
  ImageSearchProviderError,
  searchFoodImages,
  UnknownImageResultError,
} from '../services/foodImageSearchService.js';

vi.mock('../services/foodImageSearchService.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../services/foodImageSearchService.js')
    >();
  return {
    ...actual,
    searchFoodImages: vi.fn(),
    downloadSearchedImage: vi.fn(),
  };
});
vi.mock('../middleware/authMiddleware.js', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = 'user-1';
    req.authenticatedUserId = 'user-1';
    next();
  },
}));
vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

const app = express();
app.use('/api/foods', foodImageSearchRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  imageSearchLimiter.reset();
  imageDownloadLimiter.reset();
});

describe('GET /api/foods/image-search', () => {
  it('refuses an empty query', async () => {
    const res = await request(app).get('/api/foods/image-search?q=%20');
    expect(res.statusCode).toBe(400);
    expect(searchFoodImages).not.toHaveBeenCalled();
  });

  it('returns the search response', async () => {
    vi.mocked(searchFoodImages).mockResolvedValue({ status: 'not_configured' });
    const res = await request(app).get('/api/foods/image-search?q=apple');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'not_configured' });
    expect(searchFoodImages).toHaveBeenCalledWith('user-1', 'apple');
  });

  it('reports a provider error as 502 with its kind', async () => {
    vi.mocked(searchFoodImages).mockRejectedValue(
      new ImageSearchProviderError('bad key', 'rejected_key')
    );
    const res = await request(app).get('/api/foods/image-search?q=apple');
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      error:
        'Brave Search rejected the API key. Check it in Settings > External Providers.',
      kind: 'rejected_key',
    });
  });

  it('limits searches per person', async () => {
    vi.mocked(searchFoodImages).mockResolvedValue({
      status: 'ok',
      results: [],
    });
    for (let i = 0; i < 30; i++) {
      await request(app).get('/api/foods/image-search?q=apple');
    }
    const res = await request(app).get('/api/foods/image-search?q=apple');
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('GET /api/foods/image-search/download', () => {
  it('sends the image bytes without sniffing', async () => {
    vi.mocked(downloadSearchedImage).mockResolvedValue({
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: 'image/jpeg',
    });
    const res = await request(app).get(
      '/api/foods/image-search/download?url=' +
        encodeURIComponent('https://cdn.example.com/a.jpg')
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toBe(
      'inline; filename="web-image.jpg"'
    );
    expect(Buffer.from(res.body).length).toBe(3);
  });

  it('answers 404 for a URL that was not a result', async () => {
    vi.mocked(downloadSearchedImage).mockRejectedValue(
      new UnknownImageResultError()
    );
    const res = await request(app).get(
      '/api/foods/image-search/download?url=https%3A%2F%2Fevil.test%2F'
    );
    expect(res.statusCode).toBe(404);
  });

  it('answers 502 when the image cannot be fetched', async () => {
    vi.mocked(downloadSearchedImage).mockRejectedValue(new Error('boom'));
    const res = await request(app).get(
      '/api/foods/image-search/download?url=https%3A%2F%2Fcdn.example.com%2Fa.jpg'
    );
    expect(res.statusCode).toBe(502);
  });

  it('refuses a missing URL', async () => {
    const res = await request(app).get('/api/foods/image-search/download');
    expect(res.statusCode).toBe(400);
  });
});
