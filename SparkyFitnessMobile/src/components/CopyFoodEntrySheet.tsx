import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CopyMealSheet, { type CopyMealSheetRef } from './CopyMealSheet';
import { useCopyFoodEntryItem } from '../hooks/useCopyFoodEntryItem';
import type { FoodEntry } from '../types/foodEntries';
import { normalizeDate } from '../utils/dateUtils';

export interface CopyFoodEntrySheetRef {
  present: (entry: FoodEntry) => void;
}

/**
 * The copy sheet for one diary row, opened from the row's Copy swipe action
 * or long-press menu. A food inside a logged meal is copied on its own, which
 * is what the row shows.
 */
const CopyFoodEntrySheet = forwardRef<CopyFoodEntrySheetRef>((_props, ref) => {
  const { t } = useTranslation();
  const sheetRef = useRef<CopyMealSheetRef>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const { copyItem, isPending } = useCopyFoodEntryItem({
    onSuccess: () => sheetRef.current?.dismiss(),
  });

  useImperativeHandle(ref, () => ({
    present: (entry: FoodEntry) => {
      setEntryId(entry.id);
      sheetRef.current?.present(
        normalizeDate(entry.entry_date),
        entry.meal_type_id ?? null,
        entry.meal_type ?? '',
        entry.food_name ||
          t('foodRow.unknownFood', { defaultValue: 'Unknown food' })
      );
    },
  }));

  return (
    <CopyMealSheet
      ref={sheetRef}
      isPending={isPending}
      onCopyItem={({ targetDate, targetMealTypeId }) => {
        if (!entryId) return;
        copyItem({
          kind: 'foodEntry',
          id: entryId,
          targetDate,
          targetMealType: targetMealTypeId,
        });
      }}
    />
  );
});

CopyFoodEntrySheet.displayName = 'CopyFoodEntrySheet';

export default CopyFoodEntrySheet;
