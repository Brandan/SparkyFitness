// Mirrors public.planned_food_items (migration 20261025120000_add_planned_food_items.sql)
import { z } from 'zod';

const userIdSchema = z.any();
const mealTypesIdSchema = z.any();
const foodsIdSchema = z.any();
const foodVariantsIdSchema = z.any();
const foodEntriesIdSchema = z.any();

export const plannedFoodItemsIdSchema = z.string().and(
  z.object({
    __brand: z.literal('public.planned_food_items'),
  })
);

export const plannedFoodItemStatusSchema = z.enum([
  'planned',
  'added',
  'skipped',
]);

export const plannedFoodItemsSchema = z.object({
  id: plannedFoodItemsIdSchema,
  user_id: userIdSchema,
  plan_date: z.date(),
  meal_type_id: mealTypesIdSchema,
  food_id: foodsIdSchema,
  variant_id: foodVariantsIdSchema,
  quantity: z.number(),
  unit: z.string(),
  status: plannedFoodItemStatusSchema,
  food_entry_id: foodEntriesIdSchema.nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const plannedFoodItemsInitializerSchema = z.object({
  id: plannedFoodItemsIdSchema.optional(),
  user_id: userIdSchema,
  plan_date: z.date(),
  meal_type_id: mealTypesIdSchema,
  food_id: foodsIdSchema,
  variant_id: foodVariantsIdSchema,
  quantity: z.number(),
  unit: z.string(),
  status: plannedFoodItemStatusSchema.optional(),
  food_entry_id: foodEntriesIdSchema.optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const plannedFoodItemsMutatorSchema = z.object({
  id: plannedFoodItemsIdSchema.optional(),
  user_id: userIdSchema.optional(),
  plan_date: z.date().optional(),
  meal_type_id: mealTypesIdSchema.optional(),
  food_id: foodsIdSchema.optional(),
  variant_id: foodVariantsIdSchema.optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  status: plannedFoodItemStatusSchema.optional(),
  food_entry_id: foodEntriesIdSchema.optional().nullable(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export type PlannedFoodItems = z.infer<typeof plannedFoodItemsSchema>;
export type PlannedFoodItemsInitializer = z.infer<
  typeof plannedFoodItemsInitializerSchema
>;
export type PlannedFoodItemsMutator = z.infer<
  typeof plannedFoodItemsMutatorSchema
>;
