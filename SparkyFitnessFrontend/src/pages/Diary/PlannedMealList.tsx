import { useTranslation } from 'react-i18next';
import { CalendarClock, X } from 'lucide-react';
import type { PlannedMealItem } from '@workspace/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { usableFoodImages } from '@/utils/foodImages';
import {
  useAddPlannedMealMutation,
  useRestorePlannedMealMutation,
  useSkipPlannedMealMutation,
} from '@/hooks/Foods/usePlannedMeals';

interface PlannedMealListProps {
  items: PlannedMealItem[];
  selectedDate: string;
  mealName: string;
  /** Opens the card's picture viewer; the thumbnail is a button when given. */
  onOpenImages?: (images: string[], index: number, title?: string) => void;
}

const formatQuantity = (quantity: number, unit: string) =>
  `${Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(2))} ${unit}`;

/**
 * Items a "show as planned" meal plan has for this meal on this day. They are
 * not diary entries: nothing here counts toward the day's totals until the
 * person adds it.
 */
const PlannedMealList = ({
  items,
  selectedDate,
  mealName,
  onOpenImages,
}: PlannedMealListProps) => {
  const { t } = useTranslation();
  const addMutation = useAddPlannedMealMutation();
  const skipMutation = useSkipPlannedMealMutation();
  const restoreMutation = useRestorePlannedMealMutation();

  if (items.length === 0) return null;

  const targetOf = (item: PlannedMealItem) => ({
    template_id: item.template_id,
    date: selectedDate,
    item_key: item.item_key,
  });

  const handleAdd = (item: PlannedMealItem) => {
    addMutation.mutate(targetOf(item), {
      onSuccess: (added) => {
        toast({
          title: t('plannedMeals.added', 'Added {{name}} to {{mealName}}', {
            name: item.name,
            mealName,
          }),
          action: (
            <ToastAction
              altText={t('plannedMeals.undo', 'Undo')}
              onClick={() =>
                restoreMutation.mutate({
                  ...targetOf(item),
                  food_entry_ids: added.food_entry_ids,
                  food_entry_meal_ids: added.food_entry_meal_ids,
                })
              }
            >
              {t('plannedMeals.undo', 'Undo')}
            </ToastAction>
          ),
        });
      },
    });
  };

  const handleSkip = (item: PlannedMealItem) => {
    skipMutation.mutate(targetOf(item), {
      onSuccess: () => {
        toast({
          title: t('plannedMeals.skipped', 'Removed {{name}} from this day', {
            name: item.name,
          }),
          action: (
            <ToastAction
              altText={t('plannedMeals.undo', 'Undo')}
              onClick={() => restoreMutation.mutate(targetOf(item))}
            >
              {t('plannedMeals.undo', 'Undo')}
            </ToastAction>
          ),
        });
      },
    });
  };

  const busy = addMutation.isPending || skipMutation.isPending;

  const handleAddAll = async () => {
    const added: {
      item: PlannedMealItem;
      ids: { food_entry_ids: string[]; food_entry_meal_ids: string[] };
    }[] = [];
    try {
      for (const item of items) {
        added.push({
          item,
          ids: await addMutation.mutateAsync(targetOf(item)),
        });
      }
    } catch {
      // The failed item stays planned; the error toast comes from the mutation.
    }
    if (added.length === 0) return;
    toast({
      title: t(
        'plannedMeals.addedAll',
        'Added {{count}} items to {{mealName}}',
        {
          count: added.length,
          mealName,
        }
      ),
      action: (
        <ToastAction
          altText={t('plannedMeals.undo', 'Undo')}
          onClick={() => {
            added.forEach(({ item, ids }) =>
              restoreMutation.mutate({ ...targetOf(item), ...ids })
            );
          }}
        >
          {t('plannedMeals.undo', 'Undo')}
        </ToastAction>
      ),
    });
  };

  return (
    <div className="mt-3">
      {items.length > 1 && (
        <div className="mb-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => void handleAddAll()}
          >
            {t('plannedMeals.addAll', 'Add all {{count}} to diary', {
              count: items.length,
            })}
          </Button>
        </div>
      )}
      <ul
        className="space-y-2"
        aria-label={t('plannedMeals.listLabel', 'Planned for {{mealName}}', {
          mealName,
        })}
      >
        {items.map((item) => {
          const images = usableFoodImages(item.images);
          const image = images[0] ?? null;
          return (
            <li
              key={`${item.template_id}-${item.item_key}`}
              className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-muted-foreground/40 p-3 sm:flex-row sm:items-center"
            >
              {image && (
                <button
                  type="button"
                  className="flex-shrink-0 self-start rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 sm:self-center"
                  disabled={!onOpenImages}
                  onClick={() => onOpenImages?.(images, 0, item.name)}
                  aria-label={t('food.viewImages', 'View images')}
                >
                  <img
                    src={image}
                    alt={item.name}
                    className="h-16 w-16 rounded-md object-cover opacity-80"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </button>
              )}
              <div className="min-w-0 flex-1 opacity-80">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1 text-[11px]">
                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                    {t('plannedMeals.badge', 'Planned')}
                  </Badge>
                  <span className="font-semibold leading-tight">
                    {item.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatQuantity(item.quantity, item.unit)}
                  </span>
                </div>
                {item.foods.length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.foods
                      .map(
                        (food) =>
                          `${food.name} ${formatQuantity(food.quantity, food.unit)}`
                      )
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="min-h-11 flex-1 sm:flex-none"
                  disabled={busy}
                  onClick={() => handleAdd(item)}
                >
                  {t('plannedMeals.addToDiary', 'Add to diary')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  disabled={busy}
                  onClick={() => handleSkip(item)}
                  title={t(
                    'plannedMeals.removeFromDay',
                    'Remove from this day'
                  )}
                  aria-label={t(
                    'plannedMeals.removeFromDayNamed',
                    'Remove {{name}} from this day',
                    { name: item.name }
                  )}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PlannedMealList;
