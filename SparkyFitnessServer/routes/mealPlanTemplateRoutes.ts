import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import checkPermissionMiddleware from '../middleware/checkPermissionMiddleware.js';
import mealPlanTemplateService from '../services/mealPlanTemplateService.js';
import plannedMealService, {
  PlannedMealNotFoundError,
} from '../services/plannedMealService.js';
import { ValidationError } from '../utils/errors.js';
import {
  plannedMealActionBodySchema,
  plannedMealRestoreBodySchema,
  plannedMealsQuerySchema,
} from '@workspace/shared';
const router = express.Router();
// --- Meal Plan Template Routes ---
/**
 * @swagger
 * /meal-plan-templates:
 *   post:
 *     summary: Create a new meal plan template
 *     tags: [Nutrition & Meals]
 *     description: Creates a new meal plan template for the authenticated user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MealPlanTemplate'
 *     responses:
 *       201:
 *         description: The meal plan template was created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealPlanTemplate'
 *       403:
 *         description: User does not have permission to create a meal plan template.
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const newPlan = await mealPlanTemplateService.createMealPlanTemplate(
      req.userId,
      req.body
    );
    res.status(201).json(newPlan);
  } catch (error) {
    next(error);
  }
});
/**
 * @swagger
 * /meal-plan-templates:
 *   get:
 *     summary: Get all meal plan templates for a user
 *     tags: [Nutrition & Meals]
 *     description: Retrieves all meal plan templates owned by the authenticated user.
 *     responses:
 *       200:
 *         description: A list of meal plan templates.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MealPlanTemplate'
 *       403:
 *         description: User does not have permission to access this resource.
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const plans = await mealPlanTemplateService.getMealPlanTemplates(
      req.userId
    );
    res.status(200).json(plans);
  } catch (error) {
    next(error);
  }
});
/**
 * @swagger
 * /meal-plan-templates/{id}:
 *   put:
 *     summary: Update a meal plan template
 *     tags: [Nutrition & Meals]
 *     description: Updates an existing meal plan template.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the meal plan template to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MealPlanTemplate'
 *     responses:
 *       200:
 *         description: The meal plan template was updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealPlanTemplate'
 *       403:
 *         description: User does not have permission to update this meal plan template.
 *       404:
 *         description: Meal plan template not found.
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const updatedPlan = await mealPlanTemplateService.updateMealPlanTemplate(
      req.params.id,

      req.userId,
      req.body
    );
    res.status(200).json(updatedPlan);
  } catch (error) {
    next(error);
  }
});
/**
 * @swagger
 * /meal-plan-templates/{id}:
 *   delete:
 *     summary: Delete a meal plan template
 *     tags: [Nutrition & Meals]
 *     description: Deletes a specific meal plan template.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the meal plan template to delete.
 *     responses:
 *       204:
 *         description: Meal plan template deleted successfully.
 *       403:
 *         description: User does not have permission to delete this meal plan template.
 *       404:
 *         description: Meal plan template not found.
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const currentClientDate =
      typeof req.query.currentClientDate === 'string'
        ? req.query.currentClientDate
        : undefined;
    const deleted = await mealPlanTemplateService.deleteMealPlanTemplate(
      req.params.id,

      req.userId,
      currentClientDate
    );
    // The repository DELETE is RLS-scoped and returns the deleted row (or
    // undefined). A missing or not-owned id deletes nothing — return 404
    // instead of a misleading 204 that implies success.
    if (!deleted) {
      return res.status(404).json({ error: 'Meal plan template not found.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /meal-plan-templates/{id}/duplicate:
 *   post:
 *     summary: Duplicate a meal plan template
 *     tags: [Nutrition & Meals]
 *     description: Clones an existing meal plan template and its assignments.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the meal plan template to duplicate.
 *     responses:
 *       201:
 *         description: The meal plan template was duplicated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealPlanTemplate'
 */
router.post('/:id/duplicate', authenticate, async (req, res, next) => {
  try {
    const { currentClientDate } = req.body || {};
    const newPlan = await mealPlanTemplateService.duplicateMealPlanTemplate(
      req.params.id,
      req.userId,
      currentClientDate
    );
    res.status(201).json(newPlan);
  } catch (error) {
    next(error);
  }
});

// --- Planned items ("show as planned" plans) ---

function sendPlannedMealError(
  error: unknown,
  res: express.Response,
  next: express.NextFunction
) {
  if (error instanceof PlannedMealNotFoundError) {
    res.status(404).json({ error: error.message });
  } else if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
  } else {
    next(error);
  }
}

/**
 * @swagger
 * /meal-plan-templates/planned:
 *   get:
 *     summary: Planned items for a day
 *     tags: [Nutrition & Meals]
 *     description: >
 *       Items of active meal plans set to "show as planned" that fall on the
 *       given day and have not been added to the diary or skipped. They are
 *       not diary entries and are in no totals.
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: The planned items for the day.
 *       400:
 *         description: Invalid date.
 */
router.get(
  '/planned',
  authenticate,
  checkPermissionMiddleware('diary'),
  async (req, res, next) => {
    const parsed = plannedMealsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    try {
      res
        .status(200)
        .json(
          await plannedMealService.getPlannedMeals(req.userId, parsed.data.date)
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /meal-plan-templates/planned/add:
 *   post:
 *     summary: Add a planned item to the diary
 *     tags: [Nutrition & Meals]
 *     description: Writes the diary entries for one planned item on one day and returns their ids (used to undo).
 *     responses:
 *       201:
 *         description: The entries that were created.
 *       404:
 *         description: The item is no longer planned for that day.
 */
router.post(
  '/planned/add',
  authenticate,
  checkPermissionMiddleware('diary'),
  async (req, res, next) => {
    const parsed = plannedMealActionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    try {
      res
        .status(201)
        .json(await plannedMealService.addPlannedMeal(req.userId, parsed.data));
    } catch (error) {
      sendPlannedMealError(error, res, next);
    }
  }
);

/**
 * @swagger
 * /meal-plan-templates/planned/skip:
 *   post:
 *     summary: Remove a planned item from one day
 *     tags: [Nutrition & Meals]
 *     description: The item does not come back for that day unless restored.
 *     responses:
 *       204:
 *         description: Skipped.
 *       404:
 *         description: The item is no longer planned for that day.
 */
router.post(
  '/planned/skip',
  authenticate,
  checkPermissionMiddleware('diary'),
  async (req, res, next) => {
    const parsed = plannedMealActionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    try {
      await plannedMealService.skipPlannedMeal(req.userId, parsed.data);
      res.status(204).send();
    } catch (error) {
      sendPlannedMealError(error, res, next);
    }
  }
);

/**
 * @swagger
 * /meal-plan-templates/planned/restore:
 *   post:
 *     summary: Undo adding or skipping a planned item
 *     tags: [Nutrition & Meals]
 *     description: >
 *       Removes the entries an add created (by id) and makes the item planned
 *       again for that day.
 *     responses:
 *       204:
 *         description: Restored.
 */
router.post(
  '/planned/restore',
  authenticate,
  checkPermissionMiddleware('diary'),
  async (req, res, next) => {
    const parsed = plannedMealRestoreBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    try {
      await plannedMealService.restorePlannedMeal(req.userId, parsed.data);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
