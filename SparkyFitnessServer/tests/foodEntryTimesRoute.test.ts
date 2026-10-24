import express from 'express';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'supertest'
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import foodEntryRoutes from '../routes/foodEntryRoutes.js';
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
app.use(errorHandler);

const FOOD_ID = '44444444-4444-4444-8444-444444444444';
const MEAL_ID = '55555555-5555-4555-8555-555555555555';

describe('PUT /food-entries/times', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets times for the active user, acting as the original user', async () => {
    vi.mocked(foodEntryService.setFoodEntryTimes).mockResolvedValue(2);

    const response = await request(app)
      .put('/food-entries/times')
      .send({
        entries: [
          { kind: 'foodEntry', id: FOOD_ID, entry_time: '08:20:00' },
          { kind: 'foodEntryMeal', id: MEAL_ID, entry_time: null },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: 2 });
    expect(foodEntryService.setFoodEntryTimes).toHaveBeenCalledWith(
      'active-user',
      'actor-user',
      [
        { kind: 'foodEntry', id: FOOD_ID, entry_time: '08:20' },
        { kind: 'foodEntryMeal', id: MEAL_ID, entry_time: null },
      ]
    );
    expect(foodEntryService.updateFoodEntry).not.toHaveBeenCalled();
    expect(clearUserTdeeCache).toHaveBeenCalledWith('active-user');
  });

  it.each([
    ['no entries', { entries: [] }],
    [
      'a bad time',
      { entries: [{ kind: 'foodEntry', id: FOOD_ID, entry_time: '25:00' }] },
    ],
    [
      'an unknown kind',
      { entries: [{ kind: 'exercise', id: FOOD_ID, entry_time: '08:00' }] },
    ],
    [
      'an id that is not a uuid',
      { entries: [{ kind: 'foodEntry', id: 'x', entry_time: '08:00' }] },
    ],
    [
      'the same entry twice',
      {
        entries: [
          { kind: 'foodEntry', id: FOOD_ID, entry_time: '08:00' },
          { kind: 'foodEntry', id: FOOD_ID, entry_time: '09:00' },
        ],
      },
    ],
    [
      'an unknown field',
      {
        entries: [
          { kind: 'foodEntry', id: FOOD_ID, entry_time: '08:00', calories: 1 },
        ],
      },
    ],
  ])('rejects %s with 400', async (_name, payload) => {
    const response = await request(app)
      .put('/food-entries/times')
      .send(payload);

    expect(response.status).toBe(400);
    expect(foodEntryService.setFoodEntryTimes).not.toHaveBeenCalled();
  });

  it('passes a not-found error through as 404', async () => {
    vi.mocked(foodEntryService.setFoodEntryTimes).mockRejectedValue(
      Object.assign(new Error('not found'), { statusCode: 404 })
    );

    const response = await request(app)
      .put('/food-entries/times')
      .send({
        entries: [{ kind: 'foodEntry', id: FOOD_ID, entry_time: '08:00' }],
      });

    expect(response.status).toBe(404);
  });
});
