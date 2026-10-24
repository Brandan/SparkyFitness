// Mirrors public.meal_plan_occurrences (migration 20261023120000_add_planned_meals.sql)
import { z } from 'zod';

const userIdSchema = z.any();
const mealPlanTemplatesIdSchema = z.any();

export const mealPlanOccurrencesIdSchema = z.string().and(
  z.object({
    __brand: z.literal('public.meal_plan_occurrences'),
  })
);

export const mealPlanOccurrenceStatusSchema = z.enum(['added', 'skipped']);

export const mealPlanOccurrencesSchema = z.object({
  id: mealPlanOccurrencesIdSchema,
  user_id: userIdSchema,
  template_id: mealPlanTemplatesIdSchema,
  plan_date: z.date(),
  item_key: z.string(),
  status: mealPlanOccurrenceStatusSchema,
  created_at: z.date(),
});

export const mealPlanOccurrencesInitializerSchema = z.object({
  id: mealPlanOccurrencesIdSchema.optional(),
  user_id: userIdSchema,
  template_id: mealPlanTemplatesIdSchema,
  plan_date: z.date(),
  item_key: z.string(),
  status: mealPlanOccurrenceStatusSchema,
  created_at: z.date().optional(),
});

export const mealPlanOccurrencesMutatorSchema = z.object({
  id: mealPlanOccurrencesIdSchema.optional(),
  user_id: userIdSchema.optional(),
  template_id: mealPlanTemplatesIdSchema.optional(),
  plan_date: z.date().optional(),
  item_key: z.string().optional(),
  status: mealPlanOccurrenceStatusSchema.optional(),
  created_at: z.date().optional(),
});

export type MealPlanOccurrences = z.infer<typeof mealPlanOccurrencesSchema>;
export type MealPlanOccurrencesInitializer = z.infer<
  typeof mealPlanOccurrencesInitializerSchema
>;
export type MealPlanOccurrencesMutator = z.infer<
  typeof mealPlanOccurrencesMutatorSchema
>;
