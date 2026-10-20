import { z } from 'zod';
import { isDayString } from '../../utils/timezone.ts';

const dayString = z
  .string()
  .refine(isDayString, { message: 'Expected YYYY-MM-DD' });

const selectedFoodEntrySchema = z
  .object({
    entryId: z.string().uuid(),
    quantity: z.number().finite().positive(),
    sourceFingerprint: z.string().min(1).max(20_000),
  })
  .strict();

const reviewedFoodEntrySchema = z
  .object({
    entryId: z.string().uuid(),
    sourceFingerprint: z.string().min(1).max(20_000),
  })
  .strict();

function rejectDuplicateEntryIds(
  entries: Array<{ entryId: string }>,
  context: z.RefinementCtx,
  message: string
) {
  const seen = new Set<string>();
  entries.forEach(({ entryId }, index) => {
    if (seen.has(entryId)) {
      context.addIssue({
        code: 'custom',
        path: ['entries', index, 'entryId'],
        message,
      });
    }
    seen.add(entryId);
  });
}

// Copy one logged food or one logged meal to a day and meal slot of the same
// diary. The meal slot is a meal type id or name, as for the meal-level copy.
export const CopyFoodEntryItemBodySchema = z
  .object({
    targetDate: dayString,
    targetMealType: z.string().trim().min(1),
  })
  .strict();

export type CopyFoodEntryItemBody = z.infer<typeof CopyFoodEntryItemBodySchema>;

export const CopySelectedFoodEntriesFromUserBodySchema = z
  .object({
    familyUserId: z.string().uuid(),
    sourceDate: dayString,
    targetDate: dayString,
    targetMealType: z.string().uuid(),
    entries: z.array(selectedFoodEntrySchema).min(1).max(100),
  })
  .strict()
  .superRefine(({ entries }, context) => {
    rejectDuplicateEntryIds(
      entries,
      context,
      'Source entry IDs must be unique'
    );
  });

export type CopySelectedFoodEntriesFromUserPayload = z.infer<
  typeof CopySelectedFoodEntriesFromUserBodySchema
>;
export type CopySelectedFoodEntriesFromUserBody =
  CopySelectedFoodEntriesFromUserPayload;

export const CopyReviewedFoodEntriesFromUserBodySchema = z
  .object({
    familyUserId: z.string().uuid(),
    sourceDate: dayString,
    sourceMealType: z.string().trim().min(1),
    targetDate: dayString,
    targetMealType: z.string().uuid(),
    entries: z.array(reviewedFoodEntrySchema).min(1).max(100),
  })
  .strict()
  .superRefine(({ entries }, context) => {
    rejectDuplicateEntryIds(
      entries,
      context,
      'Reviewed source entry IDs must be unique'
    );
  });

export type CopyReviewedFoodEntriesFromUserPayload = z.infer<
  typeof CopyReviewedFoodEntriesFromUserBodySchema
>;
export type CopyReviewedFoodEntriesFromUserBody =
  CopyReviewedFoodEntriesFromUserPayload;
