import { z } from 'zod';
import { isDayString } from '../../utils/timezone.ts';

const dayString = z
  .string()
  .refine(isDayString, { message: 'Expected YYYY-MM-DD' });

export const plannedMealsQuerySchema = z.object({ date: dayString }).strict();

export const plannedMealComponentSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
});

/** One item of a "show as planned" meal plan on one day, not yet in the diary. */
export const plannedMealItemSchema = z.object({
  template_id: z.string().uuid(),
  template_name: z.string(),
  item_key: z.string().min(1).max(200),
  item_type: z.enum(['meal', 'food']),
  meal_type_id: z.string().uuid(),
  meal_type_name: z.string().nullable(),
  meal_id: z.string().uuid().nullable(),
  food_id: z.string().uuid().nullable(),
  variant_id: z.string().uuid().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  quantity: z.number(),
  unit: z.string(),
  /** The foods inside a planned meal; empty for a planned single food. */
  foods: z.array(plannedMealComponentSchema),
  /** Calories Add to diary will write, in kcal; null when the foods have none on record. */
  calories: z.number().nullable(),
  /** The item's own pictures (a meal falls back to its first food that has one); may be empty. */
  images: z.array(z.string()),
});

export const plannedMealsResponseSchema = z.array(plannedMealItemSchema);

const plannedMealTargetShape = {
  template_id: z.string().uuid(),
  date: dayString,
  item_key: z.string().min(1).max(200),
};

/** Add to the diary, or skip, one planned item on one day. */
export const plannedMealActionBodySchema = z
  .object(plannedMealTargetShape)
  .strict();

export const addedPlannedMealSchema = z.object({
  food_entry_ids: z.array(z.string().uuid()),
  food_entry_meal_ids: z.array(z.string().uuid()),
});

/** Put a planned item back: forget a skip, or undo an add by removing what it wrote. */
export const plannedMealRestoreBodySchema = z
  .object({
    ...plannedMealTargetShape,
    food_entry_ids: z.array(z.string().uuid()).max(500).default([]),
    food_entry_meal_ids: z.array(z.string().uuid()).max(500).default([]),
  })
  .strict();

export type PlannedMealComponent = z.infer<typeof plannedMealComponentSchema>;
export type PlannedMealItem = z.infer<typeof plannedMealItemSchema>;
export type PlannedMealActionBody = z.infer<typeof plannedMealActionBodySchema>;
export type AddedPlannedMeal = z.infer<typeof addedPlannedMealSchema>;
export type PlannedMealRestoreBody = z.infer<
  typeof plannedMealRestoreBodySchema
>;
