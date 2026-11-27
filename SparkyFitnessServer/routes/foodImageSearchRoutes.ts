import express from 'express';
import {
  foodImageDownloadQuerySchema,
  foodImageSearchQuerySchema,
} from '@workspace/shared';
import { authenticate } from '../middleware/authMiddleware.js';
import checkPermissionMiddleware from '../middleware/checkPermissionMiddleware.js';
import {
  downloadSearchedImage,
  ImageSearchProviderError,
  searchFoodImages,
  UnknownImageResultError,
} from '../services/foodImageSearchService.js';
import { describeError } from '../utils/errors.js';
import { log } from '../config/logging.js';
import { createUserRateLimiter } from '../utils/userRateLimiter.js';

const router = express.Router();

// Each search spends the person's Brave quota, and each download opens an
// outbound connection, so one account cannot run either in a tight loop.
export const imageSearchLimiter = createUserRateLimiter(30, 60 * 1000);
export const imageDownloadLimiter = createUserRateLimiter(30, 60 * 1000);

// Names the file for clients that save it to disk (the mobile app), so the
// later upload is typed by its extension like any other photo.
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

function actorId(req: express.Request): string {
  return req.authenticatedUserId ?? req.userId;
}

/**
 * @swagger
 * /foods/image-search:
 *   get:
 *     summary: Search the web for a food photo
 *     tags: [Nutrition & Meals]
 *     description: Searches Brave Search images with the person's Brave Search provider (Settings > External Providers). Returns status not_configured when there is none.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: What to search for, usually the food's name and brand.
 *     responses:
 *       200:
 *         description: The results, or status not_configured.
 *       400:
 *         description: Missing or too long query.
 *       429:
 *         description: Too many searches; see Retry-After.
 *       502:
 *         description: Brave Search refused or failed the search.
 */
router.get(
  '/image-search',
  authenticate,
  checkPermissionMiddleware('diary'),
  async (req, res) => {
    const parsed = foodImageSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter something to search for.' });
    }
    const retryAfter = imageSearchLimiter.hit(actorId(req));
    if (retryAfter > 0) {
      res.set('Retry-After', String(retryAfter));
      return res
        .status(429)
        .json({ error: 'Too many searches. Try again in a minute.' });
    }
    try {
      return res.json(await searchFoodImages(req.userId, parsed.data.q));
    } catch (error) {
      // Literal text per kind, so no error text reaches the response.
      if (error instanceof ImageSearchProviderError) {
        if (error.kind === 'rejected_key') {
          return res.status(502).json({
            error:
              'Brave Search rejected the API key. Check it in Settings > External Providers.',
            kind: 'rejected_key',
          });
        }
        if (error.kind === 'rate_limited') {
          return res.status(502).json({
            error: 'Brave Search limit reached. Try again later.',
            kind: 'rate_limited',
          });
        }
        return res.status(502).json({
          error: 'Brave Search did not answer. Try again.',
          kind: 'unavailable',
        });
      }
      log('error', `Food image search failed: ${describeError(error)}`);
      return res.status(500).json({ error: 'Image search failed. Try again.' });
    }
  }
);

/**
 * @swagger
 * /foods/image-search/download:
 *   get:
 *     summary: Fetch a food photo found by image search
 *     tags: [Nutrition & Meals]
 *     description: Returns the image bytes of one result from the person's last searches (the original, else the search provider's copy), so the client can upload it as the food's photo. Any other URL is refused.
 *     parameters:
 *       - in: query
 *         name: url
 *         schema:
 *           type: string
 *         required: true
 *         description: The result's url.
 *     responses:
 *       200:
 *         description: The image (PNG, JPEG, GIF or WebP, at most 10 MB).
 *       400:
 *         description: Missing URL.
 *       404:
 *         description: The URL is not from a recent search.
 *       429:
 *         description: Too many downloads; see Retry-After.
 *       502:
 *         description: The image could not be fetched.
 */
router.get(
  '/image-search/download',
  authenticate,
  checkPermissionMiddleware('diary'),
  async (req, res) => {
    const parsed = foodImageDownloadQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Missing image URL.' });
    }
    const retryAfter = imageDownloadLimiter.hit(actorId(req));
    if (retryAfter > 0) {
      res.set('Retry-After', String(retryAfter));
      return res
        .status(429)
        .json({ error: 'Too many downloads. Try again in a minute.' });
    }
    try {
      const image = await downloadSearchedImage(req.userId, parsed.data.url);
      res.set('Content-Type', image.contentType);
      res.set('Content-Length', String(image.bytes.length));
      res.set(
        'Content-Disposition',
        `inline; filename="web-image.${IMAGE_EXTENSIONS[image.contentType] ?? 'jpg'}"`
      );
      res.set('Cache-Control', 'private, no-store');
      // Bytes from another site: never let the browser sniff them as HTML.
      res.set('X-Content-Type-Options', 'nosniff');
      return res.send(image.bytes);
    } catch (error) {
      if (error instanceof UnknownImageResultError) {
        return res.status(404).json({ error: error.message });
      }
      log('warn', `Food image download failed: ${describeError(error)}`);
      return res
        .status(502)
        .json({ error: "Couldn't get that image. Pick another one." });
    }
  }
);

export default router;
