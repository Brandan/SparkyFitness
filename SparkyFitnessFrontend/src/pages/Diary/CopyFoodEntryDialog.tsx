import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, parse } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { usePreferences } from '@/contexts/PreferencesContext';
import { debug, info, warn } from '@/utils/logging';
import { useMealTypes } from '@/hooks/Diary/useMealTypes';

interface CopyFoodEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCopy: (targetDate: string, targetMealType: string) => void;
  sourceMealType: string;
  // Set when copying one logged food or meal rather than a whole meal or day.
  // The dialog then opens on the item's own day (`initialDate`, yyyy-MM-dd) and
  // meal, so a single click copies it again in place.
  itemName?: string;
  initialDate?: string;
}

const dayToDate = (day: string) => parse(day, 'yyyy-MM-dd', new Date());

const CopyFoodEntryDialog = ({
  isOpen,
  onClose,
  onCopy,
  sourceMealType,
  itemName,
  initialDate,
}: CopyFoodEntryDialogProps) => {
  const { t } = useTranslation();
  const { formatDateInUserTimezone, loggingLevel } = usePreferences();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialDate ? dayToDate(initialDate) : new Date()
  );
  const [selectedMealType, setSelectedMealType] =
    useState<string>(sourceMealType);

  const { data: availableMealTypes } = useMealTypes();

  const isAllDayCopy = sourceMealType === 'all';
  const isItemCopy = itemName !== undefined;

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSelectedMealType(sourceMealType);
      if (initialDate) setSelectedDate(dayToDate(initialDate));
    }
  }

  const handleCopyClick = () => {
    if (selectedDate) {
      const formattedDate = formatDateInUserTimezone(
        selectedDate,
        'yyyy-MM-dd'
      );
      info(
        loggingLevel,
        `Attempting to copy to date: ${formattedDate}, meal type: ${selectedMealType}`
      );
      onCopy(formattedDate, selectedMealType);
      onClose();
    } else {
      warn(loggingLevel, 'No date selected for copying.');
    }
  };

  const getDisplayName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower === 'breakfast') return t('common.breakfast', 'Breakfast');
    if (lower === 'lunch') return t('common.lunch', 'Lunch');
    if (lower === 'dinner') return t('common.dinner', 'Dinner');
    if (lower === 'snacks') return t('common.snacks', 'Snacks');
    return name;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isItemCopy
              ? t('copyFoodEntryDialog.titleItem', 'Copy {{name}}', {
                  name: itemName,
                })
              : isAllDayCopy
                ? t('copyFoodEntryDialog.titleAll', 'Copy Entire Day')
                : t('copyFoodEntryDialog.title', 'Copy Food Entries')}
          </DialogTitle>
          <DialogDescription>
            {isItemCopy
              ? t(
                  'copyFoodEntryDialog.descriptionItem',
                  'Pick the day and meal for the copy.'
                )
              : isAllDayCopy
                ? t(
                    'copyFoodEntryDialog.descriptionAll',
                    'Select the target date to copy all food entries from this day.'
                  )
                : t(
                    'copyFoodEntryDialog.description',
                    'Select the target date and meal type to copy the food entries.'
                  )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="targetDate" className="text-right">
              {t('copyFoodEntryDialog.targetDate', 'Target Date')}
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'flex-1 justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      <span>{format(selectedDate, 'PPP')}</span>
                    ) : (
                      <span>{t('common.pickADate', 'Pick a date')}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      debug(loggingLevel, 'Selected date in dialog:', date);
                    }}
                  />
                </PopoverContent>
              </Popover>
              {isItemCopy && !(selectedDate && isToday(selectedDate)) && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedDate(new Date())}
                >
                  {t('common.today', 'Today')}
                </Button>
              )}
            </div>
          </div>
          {!isAllDayCopy && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mealType" className="text-right">
                {t('copyFoodEntryDialog.mealType', 'Meal Type')}
              </Label>
              <Select
                onValueChange={(value) => {
                  setSelectedMealType(value);
                  debug(loggingLevel, 'Selected meal type in dialog:', value);
                }}
                value={selectedMealType}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue
                    placeholder={t(
                      'copyFoodEntryDialog.selectMealTypePlaceholder',
                      'Select meal type'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableMealTypes?.length === 0 && (
                    <SelectItem value="loading" disabled>
                      {t('common.loading', 'Loading...')}
                    </SelectItem>
                  )}
                  {availableMealTypes?.map((meal) => (
                    <SelectItem key={meal.id} value={meal.name}>
                      {getDisplayName(meal.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleCopyClick}
            disabled={!selectedDate}
            autoFocus={isItemCopy}
          >
            {t('copyFoodEntryDialog.copyButton', 'Copy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CopyFoodEntryDialog;
