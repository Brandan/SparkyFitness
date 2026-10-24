import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface CopyDayDialogProps {
  /** Day being copied (0 = Sunday), or null while the dialog is closed. */
  fromDay: number | null;
  dayNames: string[];
  /** How many items each weekday holds now, so replacing is never a surprise. */
  itemCounts: number[];
  onCopy: (toDays: number[]) => void;
  onClose: () => void;
}

const otherDays = (fromDay: number) =>
  [0, 1, 2, 3, 4, 5, 6].filter((day) => day !== fromDay);

interface CopyDayFormProps extends Omit<CopyDayDialogProps, 'fromDay'> {
  fromDay: number;
}

const CopyDayForm = ({
  fromDay,
  dayNames,
  itemCounts,
  onCopy,
  onClose,
}: CopyDayFormProps) => {
  const { t } = useTranslation();
  const days = otherDays(fromDay);
  // Empty days are the safe default; a day with items is only replaced if asked.
  const [selected, setSelected] = useState<number[]>(
    days.filter((day) => (itemCounts[day] ?? 0) === 0)
  );
  const allSelected = selected.length === days.length;

  const toggle = (day: number, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, day] : current.filter((d) => d !== day)
    );

  return (
    <DialogContent className="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>
          {t('mealPlanTemplateForm.copyDayTitle', 'Copy {{day}} to', {
            day: dayNames[fromDay],
          })}
        </DialogTitle>
        <DialogDescription>
          {t(
            'mealPlanTemplateForm.copyDayDescription',
            'Everything planned for {{day}} is copied to the days you pick.',
            { day: dayNames[fromDay] }
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSelected(allSelected ? [] : days)}
        >
          {allSelected
            ? t('mealPlanTemplateForm.copyDayClear', 'Clear')
            : t('mealPlanTemplateForm.copyDaySelectAll', 'Select all')}
        </Button>
        {days.map((day) => {
          const count = itemCounts[day] ?? 0;
          const id = `copyDay-${day}`;
          return (
            <Label
              key={day}
              htmlFor={id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted"
            >
              <Checkbox
                id={id}
                checked={selected.includes(day)}
                onCheckedChange={(checked) => toggle(day, checked === true)}
              />
              <span className="flex-1">{dayNames[day]}</span>
              {count > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {t(
                    'mealPlanTemplateForm.copyDayReplaces',
                    'Replaces {{count}} items',
                    { count }
                  )}
                </span>
              )}
            </Label>
          );
        })}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onCopy(selected)}
        >
          {t('mealPlanTemplateForm.copyDayConfirm', 'Copy to {{count}} days', {
            count: selected.length,
          })}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

/** Pick the days a single day of a meal plan should be copied onto. */
const CopyDayDialog = (props: CopyDayDialogProps) => {
  const { fromDay, onClose } = props;
  return (
    <Dialog open={fromDay !== null} onOpenChange={(open) => !open && onClose()}>
      {fromDay !== null && <CopyDayForm {...props} fromDay={fromDay} />}
    </Dialog>
  );
};

export default CopyDayDialog;
