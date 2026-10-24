import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toHourMinute, type FoodEntryTimeChange } from '@workspace/shared';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { useSetFoodEntryTimesMutation } from '@/hooks/Diary/useFoodEntries';
import { useMealTypes } from '@/hooks/Diary/useMealTypes';
import type { FoodEntry } from '@/types/food';
import type { FoodEntryMeal } from '@/types/meal';
import { formatTimeOfDayString } from '@/utils/timeFormatters';
import {
  lastTimedIndex,
  planMove,
  proposeTimes,
  reorderKey,
  sortDiaryEntries,
  undoChanges,
  type MealRetimeRequest,
  type ReorderItem,
} from '@/utils/diaryReorder';

type MealEntry = FoodEntry | FoodEntryMeal;

// Same test MealCard uses to tell a logged meal from a logged food.
const isLoggedMeal = (entry: MealEntry): entry is FoodEntryMeal =>
  'foods' in entry && 'entry_date' in entry;

export const mealEntryKey = (entry: MealEntry) =>
  reorderKey(isLoggedMeal(entry) ? 'foodEntryMeal' : 'foodEntry', entry.id);

const toReorderItem = (entry: MealEntry): ReorderItem => ({
  key: mealEntryKey(entry),
  kind: isLoggedMeal(entry) ? 'foodEntryMeal' : 'foodEntry',
  id: entry.id,
  name: (isLoggedMeal(entry) ? entry.name : entry.food_name) ?? '',
  time: toHourMinute(entry.entry_time),
});

interface UseMealReorderOptions {
  /** The meal's entries in diary order. */
  entries: MealEntry[];
  /** Meal type name, used to find its default time. */
  mealType: string;
  timeFormat: string;
}

/**
 * Drag-to-reorder for one diary meal. The meal is sorted by time, so a drop
 * becomes a time change: one row gets a time between its new neighbours, or,
 * when no single time fits, the re-time dialog opens with the new order.
 * Changes show at once (local overrides until the server data catches up)
 * and every change offers Undo.
 */
export function useMealReorder({
  entries,
  mealType,
  timeFormat,
}: UseMealReorderOptions) {
  const { t } = useTranslation();
  const { data: mealTypes } = useMealTypes();
  const { mutate, isPending } = useSetFoodEntryTimesMutation();
  const [retimeRequest, setRetimeRequest] = useState<MealRetimeRequest | null>(
    null
  );
  // Times shown before the server confirms them. Tied to the entries they
  // were made against: once fresh data arrives they are dropped.
  const signature = entries
    .map((entry) => `${mealEntryKey(entry)}=${entry.entry_time ?? ''}`)
    .join(',');
  const [overrides, setOverrides] = useState<{
    signature: string;
    times: Record<string, string | null>;
  } | null>(null);
  const activeOverrides =
    overrides && overrides.signature === signature ? overrides.times : null;

  const displayEntries = useMemo(() => {
    if (!activeOverrides) return entries;
    return sortDiaryEntries(
      entries.map((entry) => {
        const key = mealEntryKey(entry);
        return key in activeOverrides
          ? { ...entry, entry_time: activeOverrides[key] }
          : entry;
      })
    );
  }, [entries, activeOverrides]);

  const items = useMemo(
    () => displayEntries.map(toReorderItem),
    [displayEntries]
  );

  const defaultStart =
    toHourMinute(
      mealTypes?.find(
        (definition) => definition.name.toLowerCase() === mealType.toLowerCase()
      )?.default_time
    ) ?? null;

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the grip
    // does not count as a move.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const format = (time: string) => formatTimeOfDayString(time, timeFormat);

  const applyChanges = (
    changes: FoodEntryTimeChange[],
    onDone: (before: ReorderItem[]) => void
  ) => {
    if (changes.length === 0) return;
    const before = items;
    setOverrides({
      signature,
      times: {
        ...(activeOverrides ?? {}),
        ...Object.fromEntries(
          changes.map((change) => [
            reorderKey(change.kind, change.id),
            change.entry_time,
          ])
        ),
      },
    });
    mutate(changes, {
      onSuccess: () => onDone(before),
      // The mutation's own error toast explains; put the list back.
      onError: () => setOverrides(null),
    });
  };

  const undo = (before: ReorderItem[], changes: FoodEntryTimeChange[]) =>
    applyChanges(undoChanges(before, changes), () =>
      toast({ title: t('diary.reorder.undone', 'Order restored') })
    );

  const undoAction = (
    before: ReorderItem[],
    changes: FoodEntryTimeChange[]
  ) => (
    <ToastAction
      altText={t('plannedMeals.undo', 'Undo')}
      onClick={() => undo(before, changes)}
    >
      {t('plannedMeals.undo', 'Undo')}
    </ToastAction>
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.key === active.id);
    const to = items.findIndex((item) => item.key === over.id);
    const plan = planMove(items, from, to);

    if (plan.type === 'retime') {
      const fillThrough = Math.max(to, lastTimedIndex(plan.order));
      setRetimeRequest({
        order: plan.order,
        times: proposeTimes(plan.order, defaultStart, fillThrough),
        movedKey: plan.moved.key,
      });
      return;
    }
    if (plan.type !== 'set' || plan.newTime === plan.moved.time) return;

    const { moved, newTime, above, below } = plan;
    const changes: FoodEntryTimeChange[] = [
      { kind: moved.kind, id: moved.id, entry_time: newTime },
    ];
    // The order as saved, for "Adjust": the moved row now holds its new time.
    const savedOrder = plan.order.map((item) =>
      item.key === moved.key ? { ...item, time: newTime } : item
    );
    const neighbours =
      above?.time && below?.time
        ? t(
            'diary.reorder.between',
            'Between {{above}} ({{aboveTime}}) and {{below}} ({{belowTime}})',
            {
              above: above.name,
              aboveTime: format(above.time),
              below: below.name,
              belowTime: format(below.time),
            }
          )
        : above?.time
          ? t('diary.reorder.after', 'After {{name}} ({{time}})', {
              name: above.name,
              time: format(above.time),
            })
          : below?.time
            ? t('diary.reorder.before', 'Before {{name}} ({{time}})', {
                name: below.name,
                time: format(below.time),
              })
            : undefined;

    applyChanges(changes, (before) =>
      toast({
        title: t('diary.reorder.movedTo', 'Moved {{name}} to {{time}}', {
          name: moved.name,
          time: format(newTime),
        }),
        description: neighbours,
        action: (
          <div className="flex shrink-0 gap-2">
            <ToastAction
              altText={t('diary.reorder.adjust', 'Adjust times')}
              onClick={() =>
                setRetimeRequest({
                  order: savedOrder,
                  times: savedOrder.map((item) => item.time ?? ''),
                  movedKey: moved.key,
                })
              }
            >
              {t('diary.reorder.adjust', 'Adjust times')}
            </ToastAction>
            {undoAction(before, changes)}
          </div>
        ),
      })
    );
  };

  /** Opens the re-time dialog on the meal as it stands. */
  const openRetime = () =>
    setRetimeRequest({
      order: items,
      times: items.map((item) => item.time ?? ''),
    });

  const saveRetime = (changes: FoodEntryTimeChange[]) => {
    setRetimeRequest(null);
    applyChanges(changes, (before) =>
      toast({
        title: t('diary.reorder.updated', 'Updated {{count}} times', {
          count: changes.length,
        }),
        action: undoAction(before, changes),
      })
    );
  };

  return {
    entries: displayEntries,
    itemKeys: items.map((item) => item.key),
    sensors,
    handleDragEnd,
    isSaving: isPending,
    openRetime,
    retimeDialog: {
      request: retimeRequest,
      saving: isPending,
      onCancel: () => setRetimeRequest(null),
      onSave: saveRetime,
    },
  };
}
