import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodEntryTimeChange } from '@workspace/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TimeInput } from '@/components/ui/TimeInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatTimeOfDayString } from '@/utils/timeFormatters';
import {
  DEFAULT_SPACING_MINUTES,
  firstOutOfOrder,
  spaceTimes,
  timeChanges,
  type MealRetimeRequest,
} from '@/utils/diaryReorder';

const SPACING_OPTIONS = [1, 5, 10, 15, 30, 60];

interface MealRetimeDialogProps {
  mealName: string;
  request: MealRetimeRequest | null;
  timeFormat: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (changes: FoodEntryTimeChange[]) => void;
}

/**
 * Times for every row of one meal, in order. The diary sorts a meal by time,
 * so this is where a reorder that one new time cannot express gets settled,
 * and where all of a meal's times can be changed at once. Each row shows the
 * time it had, so it is clear what saving will change.
 */
const MealRetimeDialog = ({
  mealName,
  request,
  timeFormat,
  saving,
  onCancel,
  onSave,
}: MealRetimeDialogProps) => (
  <Dialog
    open={request !== null}
    onOpenChange={(open) => {
      if (!open && !saving) onCancel();
    }}
  >
    <DialogContent className="max-w-lg">
      {request && (
        <RetimeForm
          // A new request starts from its own times.
          key={request.order.map((item) => item.key).join('|')}
          mealName={mealName}
          request={request}
          timeFormat={timeFormat}
          saving={saving}
          onCancel={onCancel}
          onSave={onSave}
        />
      )}
    </DialogContent>
  </Dialog>
);

const RetimeForm = ({
  mealName,
  request,
  timeFormat,
  saving,
  onCancel,
  onSave,
}: Omit<MealRetimeDialogProps, 'request'> & {
  request: MealRetimeRequest;
}) => {
  const { t } = useTranslation();
  const baseId = useId();
  const [times, setTimes] = useState<string[]>(request.times);
  const [spacing, setSpacing] = useState(String(DEFAULT_SPACING_MINUTES));
  const { order } = request;

  const format = (time: string) => formatTimeOfDayString(time, timeFormat);
  const invalidIndex = firstOutOfOrder(times);
  const changes = timeChanges(order, times);

  const setTimeAt = (index: number, value: string) =>
    setTimes((current) =>
      current.map((time, i) => (i === index ? value : time))
    );

  const applySpacing = () => {
    const first = times[0];
    if (!first) return;
    setTimes(spaceTimes(first, order.length, Number(spacing)));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (invalidIndex === -1 && changes.length > 0) onSave(changes);
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {t('diary.reorder.title', 'Times for {{mealName}}', { mealName })}
        </DialogTitle>
        <DialogDescription>
          {t(
            'diary.reorder.description',
            'This meal is ordered by time. Each time must be later than the one above it. Items with no time stay at the bottom.'
          )}
        </DialogDescription>
      </DialogHeader>

      <ol className="my-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {order.map((item, index) => {
          const labelId = `${baseId}-row-${index}`;
          const time = times[index] ?? '';
          const changed = time !== (item.time ?? '');
          const previous = index > 0 ? times[index - 1] : undefined;
          const isInvalid = index === invalidIndex;
          return (
            <li
              key={item.key}
              className={cn(
                'flex items-center gap-3 rounded-md border p-2',
                item.key === request.movedKey && 'border-primary bg-primary/5'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span id={labelId} className="truncate font-medium">
                    {item.name}
                  </span>
                  {item.key === request.movedKey && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {t('diary.reorder.moved', 'Moved')}
                    </Badge>
                  )}
                </div>
                {isInvalid ? (
                  <p className="text-xs font-medium text-destructive">
                    {time && previous
                      ? t(
                          'diary.reorder.mustBeAfter',
                          'Must be after {{time}}',
                          {
                            time: format(previous),
                          }
                        )
                      : t('diary.reorder.needsTime', 'Needs a time')}
                  </p>
                ) : (
                  changed && (
                    <p className="text-xs text-muted-foreground">
                      {item.time
                        ? t('diary.reorder.was', 'Was {{time}}', {
                            time: format(item.time),
                          })
                        : t('diary.reorder.hadNoTime', 'Had no time')}
                    </p>
                  )
                )}
              </div>
              <div className="w-36 shrink-0">
                <TimeInput
                  value={time}
                  onChange={(value) => setTimeAt(index, value)}
                  aria-labelledby={labelId}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {order.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span id={`${baseId}-spacing`} className="text-muted-foreground">
            {t('diary.reorder.spaceFromFirst', 'Space out from the first time')}
          </span>
          <Select value={spacing} onValueChange={setSpacing}>
            <SelectTrigger
              className="h-9 w-28"
              aria-labelledby={`${baseId}-spacing`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPACING_OPTIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {t('diary.reorder.everyMinutes', 'Every {{count}} min', {
                    count: minutes,
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applySpacing}
            disabled={!times[0]}
          >
            {t('diary.reorder.applySpacing', 'Apply')}
          </Button>
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          type="submit"
          disabled={saving || invalidIndex !== -1 || changes.length === 0}
        >
          {changes.length > 0
            ? t('diary.reorder.saveCount', 'Save {{count}} times', {
                count: changes.length,
              })
            : t('diary.reorder.saveNone', 'No changes')}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default MealRetimeDialog;
