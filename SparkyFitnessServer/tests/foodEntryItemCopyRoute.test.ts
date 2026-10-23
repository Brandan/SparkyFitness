import express from 'express';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'supertest'
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import foodEntryRoutes from '../routes/foodEntryRoutes.js';
import foodEntryMealRoutes from '../routes/foodEntryMealRoutes.js';
import foodEntryService from '../services/foodEntryService.js';
import { clearUserTdeeCache } from '../services/AdaptiveTdeeService.js';
import errorHandler from '../middleware/errorHandler.js';

vi.mock('../services/foodEntryService.js');
vi.mock('../services/AdaptiveTdeeService.js', () => ({
  clearUserTdeeCache: vi.fn(),
}));
vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default: vi.fn(
    () => (_req: unknown, _res: unknown, next: () => void) => next()
  ),
}));
vi.mock('../middleware/authMiddleware.js', () => ({
  authenticate: vi.fn(
    (
      req: express.Request & {
        userId?: string;
        authenticatedUserId?: string;
        originalUserId?: string;
      },
      _res: express.Response,
      next: express.NextFunction
    ) => {
      req.userId = 'active-user';
      req.authenticatedUserId = 'actor-user';
      req.originalUserId = 'actor-user';
      next();
    }
  ),
}));

const app = express();
app.use(express.json());
app.use('/food-entries', foodEntryRoutes);
app.use('/food-entry-meals', foodEntryMealRoutes);
app.use(errorHandler);

const ID = '44444444-4444-4444-8444-444444444444';
const body = { targetDate: '2026-10-21', targetMealType: 'Dinner' };

describe.each([
  ['food entry', '/food-entries', 'foodEntry'],
  ['logged meal', '/food-entry-meals', 'foodEntryMeal'],
] as const)('POST %s /:id/copy', (_label, base, kind) => {
  beforeEach(() => vi.clearAllMocks());

  it('copies for the active user, acting as the original user', async () => {
    vi.mocked(foodEntryService.copyFoodEntryItem).mockResolvedValue([
      { id: 'new-1' },
    ]);

    const response = await request(app).post(`${base}/${ID}/copy`).send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual([{ id: 'new-1' }]);
    expect(foodEntryService.copyFoodEntryItem).toHaveBeenCalledWith(
      'active-user',
      'actor-user',
      kind,
      ID,
      '2026-10-21',
      'Dinner'
    );
    expect(clearUserTdeeCache).toHaveBeenCalledWith('active-user');
  });

  it.each([
    ['a bad day', { ...body, targetDate: '2026-02-30' }, ID],
    ['a missing meal type', { targetDate: '2026-10-21' }, ID],
    ['an unknown field', { ...body, extra: true }, ID],
    ['an id that is not a uuid', body, 'not-a-uuid'],
  ])('rejects %s with 400', async (_name, payload, id) => {
    const response = await request(app)
      .post(`${base}/${id}/copy`)
      .send(payload);

    expect(response.status).toBe(400);
    expect(foodEntryService.copyFoodEntryItem).not.toHaveBeenCalled();
  });

  it('passes a service status error through', async () => {
    vi.mocked(foodEntryService.copyFoodEntryItem).mockRejectedValue(
      Object.assign(new Error('not found'), { statusCode: 404 })
    );

    const response = await request(app).post(`${base}/${ID}/copy`).send(body);

    expect(response.status).toBe(404);
    expect(clearUserTdeeCache).not.toHaveBeenCalled();
  });
});
