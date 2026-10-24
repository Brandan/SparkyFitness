import { z } from 'zod';
import { isEntryTimeString } from '../../utils/entryTime.ts';

// Set the time of several logged foods and meals in one go. The web diary
// uses this to reorder a meal: the list is sorted by time, so moving a row
// means giving it (and sometimes its neighbours) a new time. Only the time
// changes; nothing else about the entry is touched.
const entryTimeSchema = z
  .string()
  .refine(isEntryTimeString, { message: 'Expected HH:MM (24h)' })
  .transform((value) => value.slice(0, 5));

const foodEntryTimeChangeSchema = z
  .object({
    kind: z.enum(['foodEntry', 'foodEntryMeal']),
    id: z.string().uuid(),
    entry_time: entryTimeSchema.nullable(),
  })
  .strict();

export const SetFoodEntryTimesBodySchema = z
  .object({
    entries: z.array(foodEntryTimeChangeSchema).min(1).max(200),
  })
  .strict()
  .superRefine((body, context) => {
    const seen = new Set<string>();
    body.entries.forEach(({ kind, id }, index) => {
      const key = `${kind}:${id}`;
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'id'],
          message: 'Each entry may appear only once.',
        });
      }
      seen.add(key);
    });
  });

export type SetFoodEntryTimesBody = z.infer<typeof SetFoodEntryTimesBodySchema>;
export type FoodEntryTimeChange = SetFoodEntryTimesBody['entries'][number];

export const SetFoodEntryTimesResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
});

export type SetFoodEntryTimesResponse = z.infer<
  typeof SetFoodEntryTimesResponseSchema
>;
