import { z } from 'zod';
import { isDayString } from '../../utils/timezone.ts';
import { isEntryTimeString } from '../../utils/entryTime.ts';
import {
  FOOD_VARIANT_NUTRIENT_FIELDS,
  type FoodVariantNutrientField,
} from '../../constants/foodVariantNutrients.ts';

const dayString = z
  .string()
  .refine(isDayString, { message: 'Expected YYYY-MM-DD' });

export const plannedMealsQuerySchema = z.object({ date: dayString }).strict();

const plannedNutritionSchema = z.object({
  ...(Object.fromEntries(
    FOOD_VARIANT_NUTRIENT_FIELDS.map((field) => [field, z.number()])
  ) as Record<FoodVariantNutrientField, z.ZodNumber>),
  custom_nutrients: z.record(z.string(), z.number()),
});

export const plannedMealComponentSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
});

/** One item of a "show as planned" meal plan on one day, not yet in the diary. */
export const plannedMealItemSchema = z.object({
  /** The meal plan the item comes from; null for a one-off food planned on its own. */
  template_id: z.string().uuid().nullable(),
  /** Empty for a one-off food. */
  template_name: z.string(),
  /** For a one-off food, the id of the planned food item. */
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
  /**
   * Every nutrient Add to diary will write (calories in kcal, custom nutrients
   * by name); null when a variant is missing. Absent from older servers.
   */
  nutrition: plannedNutritionSchema.nullable().optional(),
  /** The item's own pictures (a meal falls back to its first food that has one); may be empty. */
  images: z.array(z.string()),
});

export const plannedMealsResponseSchema = z.array(plannedMealItemSchema);

const plannedMealTargetShape = {
  template_id: z.string().uuid().nullable(),
  date: dayString,
  item_key: z.string().min(1).max(200),
};

/** Add to the diary, or skip, one planned item on one day. */
export const plannedMealActionBodySchema = z
  .object({
    ...plannedMealTargetShape,
    /**
     * Wall-clock 'HH:MM' the item was added (the client's local time). Add
     * stamps it on the entries it writes, so a meal sorts by when each item
     * was really eaten; ignored by skip.
     */
    entry_time: z
      .string()
      .refine(isEntryTimeString, { message: 'Expected HH:MM (24h)' })
      .transform((value) => value.slice(0, 5))
      .optional(),
  })
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

/** Plan one food on one day and meal, outside any meal plan. */
export const createPlannedFoodBodySchema = z
  .object({
    date: dayString,
    meal_type_id: z.string().uuid(),
    food_id: z.string().uuid(),
    variant_id: z.string().uuid(),
    quantity: z.number().positive().max(1_000_000),
    unit: z.string().min(1).max(50),
  })
  .strict();

/** Change a one-off planned food; send only what changed. */
export const updatePlannedFoodBodySchema = z
  .object({
    meal_type_id: z.string().uuid().optional(),
    variant_id: z.string().uuid().optional(),
    quantity: z.number().positive().max(1_000_000).optional(),
    unit: z.string().min(1).max(50).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Nothing to update',
  });

export type CreatePlannedFoodBody = z.infer<typeof createPlannedFoodBodySchema>;
export type UpdatePlannedFoodBody = z.infer<typeof updatePlannedFoodBodySchema>;
export type PlannedMealComponent = z.infer<typeof plannedMealComponentSchema>;
export type PlannedMealItem = z.infer<typeof plannedMealItemSchema>;
export type PlannedMealActionBody = z.infer<typeof plannedMealActionBodySchema>;
export type AddedPlannedMeal = z.infer<typeof addedPlannedMealSchema>;
export type PlannedMealRestoreBody = z.infer<
  typeof plannedMealRestoreBodySchema
>;
