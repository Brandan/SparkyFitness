import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  clockInZone,
  sumPlannedNutrition,
  type PlannedMealItem,
} from '@workspace/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { usableFoodImages } from '@/utils/foodImages';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  formatNutrientValue,
  getNutrientMetadata,
} from '@/utils/nutrientUtils';
import type { UserCustomNutrient } from '@/types/customNutrient';
import {
  MOBILE_ENTRY_NUTRIENT_LIMIT,
  MOBILE_NUTRIENT_LABEL_OVERRIDES,
} from './mobileEntryNutrients';
import PlannedFoodEditDialog from './PlannedFoodEditDialog';
import {
  useAddPlannedMealMutation,
  useRestorePlannedMealMutation,
  useSkipPlannedMealMutation,
} from '@/hooks/Foods/usePlannedMeals';

interface PlannedMealListProps {
  items: PlannedMealItem[];
  selectedDate: string;
  mealName: string;
  energyUnit: 'kcal' | 'kJ';
  convertEnergy: (
    value: number,
    fromUnit: 'kcal' | 'kJ',
    toUnit: 'kcal' | 'kJ'
  ) => number;
  /** Opens the card's picture viewer; the thumbnail is a button when given. */
  onOpenImages?: (images: string[], index: number, title?: string) => void;
  /** Nutrients shown on each row, the same ones the meal's entries show. */
  nutrients?: string[];
  customNutrients?: UserCustomNutrient[];
  /** Phone-width layout, matching the entry rows' cards. */
  isMobile?: boolean;
  className?: string;
}

const DEFAULT_PLANNED_NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'];

/** What Add to diary will write for `nutrient`, or null when it isn't known. */
const plannedNutrientValue = (
  item: PlannedMealItem,
  nutrient: string
): number | null => {
  if (item.nutrition) {
    const value =
      (item.nutrition as Record<string, unknown>)[nutrient] ??
      item.nutrition.custom_nutrients[nutrient];
    return typeof value === 'number' ? value : null;
  }
  return nutrient === 'calories' ? item.calories : null;
};

const formatQuantity = (quantity: number, unit: string) =>
  `${Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(2))} ${unit}`;

const formatMacro = (value: number) =>
  (Number.isFinite(value) ? value : 0).toFixed(1);

/** Protein, carbs, and fat in the same colors as a meal plan. */
export const PlannedMacroFigures = ({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) => {
  const { t } = useTranslation();
  return (
    <>
      <span className="text-blue-500">
        {t('plannedMeals.protein', 'P: {{amount}}g', {
          amount: formatMacro(protein),
        })}
      </span>
      <span className="text-green-500">
        {t('plannedMeals.carbs', 'C: {{amount}}g', {
          amount: formatMacro(carbs),
        })}
      </span>
      <span className="text-yellow-500">
        {t('plannedMeals.fat', 'F: {{amount}}g', {
          amount: formatMacro(fat),
        })}
      </span>
    </>
  );
};

interface PlannedAddAllButtonProps {
  items: PlannedMealItem[];
  selectedDate: string;
  mealName: string;
}

/** Adds every planned item of a meal to the diary, with one Undo. */
export const PlannedAddAllButton = ({
  items,
  selectedDate,
  mealName,
}: PlannedAddAllButtonProps) => {
  const { t } = useTranslation();
  const { timezone } = usePreferences();
  const addMutation = useAddPlannedMealMutation();
  const restoreMutation = useRestorePlannedMealMutation();

  if (items.length < 2) return null;

  const targetOf = (item: PlannedMealItem) => ({
    template_id: item.template_id,
    date: selectedDate,
    item_key: item.item_key,
  });

  // Adding stamps the time it happens, so the meal sorts by when it was eaten.
  const addTargetOf = (item: PlannedMealItem) => ({
    ...targetOf(item),
    entry_time: clockInZone(timezone),
  });

  const handleAddAll = async () => {
    const added: {
      item: PlannedMealItem;
      ids: { food_entry_ids: string[]; food_entry_meal_ids: string[] };
    }[] = [];
    let failed: PlannedMealItem | null = null;
    for (const item of items) {
      try {
        added.push({
          item,
          ids: await addMutation.mutateAsync(addTargetOf(item)),
        });
      } catch {
        failed = item;
        break;
      }
    }
    // Nothing was added: the mutation's own error toast already says so.
    if (added.length === 0) return;
    // One toast only (they replace each other), so a partial failure is
    // said here instead of being hidden by the success message.
    toast({
      title: failed
        ? t(
            'plannedMeals.addedSome',
            'Added {{count}} of {{total}} to {{mealName}}',
            {
              count: added.length,
              total: items.length,
              mealName,
            }
          )
        : t('plannedMeals.addedAll', 'Added {{count}} items to {{mealName}}', {
            count: added.length,
            mealName,
          }),
      description: failed
        ? t('plannedMeals.couldNotAdd', "Couldn't add {{name}}. Try again.", {
            name: failed.name,
          })
        : undefined,
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
    <Button
      type="button"
      variant="outline"
      disabled={addMutation.isPending}
      onClick={() => void handleAddAll()}
    >
      {t('plannedMeals.addAll', 'Add all {{count}} to diary', {
        count: items.length,
      })}
    </Button>
  );
};

/**
 * Items a "show as planned" meal plan has for this meal on this day. They are
 * not diary entries: nothing here counts toward the day's totals until the
 * person adds it.
 */
const PlannedMealList = ({
  items,
  selectedDate,
  mealName,
  energyUnit,
  convertEnergy,
  onOpenImages,
  nutrients = DEFAULT_PLANNED_NUTRIENTS,
  customNutrients = [],
  isMobile = false,
  className,
}: PlannedMealListProps) => {
  const { t } = useTranslation();
  const { timezone } = usePreferences();
  const addMutation = useAddPlannedMealMutation();
  const skipMutation = useSkipPlannedMealMutation();
  const restoreMutation = useRestorePlannedMealMutation();
  const [editing, setEditing] = useState<PlannedMealItem | null>(null);

  if (items.length === 0) return null;

  const targetOf = (item: PlannedMealItem) => ({
    template_id: item.template_id,
    date: selectedDate,
    item_key: item.item_key,
  });

  // Adding stamps the time it happens, so the meal sorts by when it was eaten.
  const addTargetOf = (item: PlannedMealItem) => ({
    ...targetOf(item),
    entry_time: clockInZone(timezone),
  });

  const handleAdd = (item: PlannedMealItem) => {
    addMutation.mutate(addTargetOf(item), {
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
          title: t('plannedMeals.skipped', 'Skipped {{name}} for this day', {
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
  const subtotal = sumPlannedNutrition(items);
  const showSubtotal = items.some((item) => item.nutrition != null);
  const energyLabel =
    energyUnit === 'kcal'
      ? t('common.kcalUnit', 'kcal')
      : t('common.kJUnit', 'kJ');

  return (
    <div className={cn('space-y-3', className)}>
      <ul
        className="space-y-3"
        aria-label={t('plannedMeals.listLabel', 'Planned for {{mealName}}', {
          mealName,
        })}
      >
        {items.map((item) => {
          const images = usableFoodImages(item.images);
          const image = images[0] ?? null;
          const cells = nutrients.flatMap((nutrient) => {
            const value = plannedNutrientValue(item, nutrient);
            return value === null ? [] : [{ nutrient, value }];
          });
          const actions = (
            <>
              {item.template_id === null && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => setEditing(item)}
                  aria-label={t(
                    'plannedMeals.changeNamed',
                    'Change amount of {{name}}',
                    { name: item.name }
                  )}
                >
                  {t('plannedMeals.change', 'Change')}
                </Button>
              )}
              <Button
                className="min-h-11 flex-1 sm:flex-none"
                disabled={busy}
                onClick={() => handleAdd(item)}
              >
                {t('plannedMeals.addToDiary', 'Add to diary')}
              </Button>
              <Button
                variant="ghost"
                className="min-h-11"
                disabled={busy}
                onClick={() => handleSkip(item)}
                aria-label={t(
                  'plannedMeals.skipNamed',
                  'Skip {{name}} for this day',
                  { name: item.name }
                )}
              >
                {t('plannedMeals.skip', 'Skip')}
              </Button>
            </>
          );
          const badge = (
            <Badge variant="outline" className="w-fit gap-1 text-xs">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              {item.template_id === null
                ? t('plannedMeals.oneOffBadge', 'Planned · one-off')
                : t('plannedMeals.badge', 'Planned')}
            </Badge>
          );
          const nutrientLabel = (nutrient: string) => {
            const metadata = getNutrientMetadata(nutrient, customNutrients);
            const override = isMobile
              ? MOBILE_NUTRIENT_LABEL_OVERRIDES[nutrient]
              : undefined;
            return override
              ? t(override.label, override.defaultLabel)
              : t(metadata.label, metadata.defaultLabel);
          };
          const nutrientText = (nutrient: string, value: number) => {
            const metadata = getNutrientMetadata(nutrient, customNutrients);
            return nutrient === 'calories'
              ? `${Math.round(convertEnergy(value, 'kcal', energyUnit))} ${energyLabel}`
              : `${formatNutrientValue(nutrient, value, customNutrients)} ${metadata.unit}`;
          };
          if (isMobile) {
            const calories = cells.find((c) => c.nutrient === 'calories');
            const others = cells
              .filter((c) => c.nutrient !== 'calories')
              .slice(0, MOBILE_ENTRY_NUTRIENT_LIMIT);
            return (
              <li
                key={`${item.template_id}-${item.item_key}`}
                className="rounded-xl border-2 border-dashed border-muted-foreground/40 bg-card p-4 shadow-sm dark:bg-secondary/50"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      {image && (
                        <button
                          type="button"
                          className="flex-shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={!onOpenImages}
                          onClick={() => onOpenImages?.(images, 0, item.name)}
                          aria-label={t('food.viewImages', 'View images')}
                        >
                          <img
                            src={image}
                            alt={item.name}
                            className="h-12 w-12 rounded-md object-cover"
                            loading="lazy"
                            onError={(e) => {
                              const button = e.currentTarget.parentElement;
                              if (button) button.style.display = 'none';
                            }}
                          />
                        </button>
                      )}
                      <div className="min-w-0">
                        <div className="text-base font-semibold leading-tight text-card-foreground">
                          {item.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {item.brand && <span>{item.brand}</span>}
                          {item.brand && <span aria-hidden="true">&bull;</span>}
                          <span>
                            {formatQuantity(item.quantity, item.unit)}
                          </span>
                          {badge}
                        </div>
                      </div>
                    </div>
                    {item.foods.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.foods
                          .map(
                            (food) =>
                              `${food.name} ${formatQuantity(food.quantity, food.unit)}`
                          )
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  {calories && (
                    <div className="text-right">
                      <div
                        className={cn(
                          'text-xl font-semibold leading-none',
                          getNutrientMetadata('calories', customNutrients).color
                        )}
                      >
                        {Math.round(
                          convertEnergy(calories.value, 'kcal', energyUnit)
                        )}
                      </div>
                      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {energyLabel}
                      </div>
                    </div>
                  )}
                </div>
                {others.length > 0 && (
                  <div
                    className="mt-3 grid gap-2 border-t pt-3"
                    style={{
                      gridTemplateColumns: `repeat(${others.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {others.map(({ nutrient, value }) => (
                      <div key={nutrient} className="min-w-0">
                        <div
                          className={cn(
                            'text-sm font-medium leading-tight',
                            getNutrientMetadata(nutrient, customNutrients).color
                          )}
                        >
                          {nutrientText(nutrient, value).replace(' ', '')}
                        </div>
                        <div className="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {nutrientLabel(nutrient)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  {actions}
                </div>
              </li>
            );
          }
          return (
            <li
              key={`${item.template_id}-${item.item_key}`}
              className="flex flex-col justify-between gap-4 rounded-lg border-2 border-dashed border-muted-foreground/40 bg-gray-50 p-3 dark:bg-gray-800 sm:flex-row sm:items-center"
            >
              {image && (
                <button
                  type="button"
                  className="flex-shrink-0 self-start rounded-md focus:outline-none focus:ring-2 focus:ring-ring sm:self-center"
                  disabled={!onOpenImages}
                  onClick={() => onOpenImages?.(images, 0, item.name)}
                  aria-label={t('food.viewImages', 'View images')}
                >
                  <img
                    src={image}
                    alt={item.name}
                    className="h-16 w-16 rounded-md object-cover"
                    loading="lazy"
                    onError={(e) => {
                      // Hide the button too, so no empty target is left behind.
                      const button = e.currentTarget.parentElement;
                      if (button) button.style.display = 'none';
                    }}
                  />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="font-medium">{item.name}</span>
                  {item.brand && (
                    <Badge variant="secondary" className="w-fit text-xs">
                      {item.brand}
                    </Badge>
                  )}
                  <span className="text-sm text-gray-500">
                    {formatQuantity(item.quantity, item.unit)}
                  </span>
                  {badge}
                </div>
                {cells.length > 0 && (
                  <div
                    className="mt-2 grid w-full gap-x-4 gap-y-2 text-xs sm:text-sm"
                    style={{
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(60px, 1fr))',
                    }}
                  >
                    {cells.map(({ nutrient, value }) => {
                      const metadata = getNutrientMetadata(
                        nutrient,
                        customNutrients
                      );
                      const isEnergy = nutrient === 'calories';
                      const display = isEnergy
                        ? Math.round(
                            convertEnergy(value, 'kcal', energyUnit)
                          ).toString()
                        : formatNutrientValue(nutrient, value, customNutrients);
                      return (
                        <div
                          key={nutrient}
                          className="min-w-[60px] text-center"
                        >
                          <div className={`font-medium ${metadata.color}`}>
                            {display} {isEnergy ? energyLabel : metadata.unit}
                          </div>
                          <div className="text-[10px] text-gray-500 sm:text-xs">
                            {t(metadata.label, metadata.defaultLabel)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {item.foods.length > 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.foods
                      .map(
                        (food) =>
                          `${food.name} ${formatQuantity(food.quantity, food.unit)}`
                      )
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">{actions}</div>
            </li>
          );
        })}
      </ul>
      <PlannedFoodEditDialog item={editing} onClose={() => setEditing(null)} />
      {showSubtotal && items.length > 1 && (
        <div className="rounded bg-muted p-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {t('plannedMeals.subtotal', 'Planned:')}
          </span>{' '}
          {Math.round(convertEnergy(subtotal.calories, 'kcal', energyUnit))}{' '}
          {energyLabel}
          <span className="mx-1">|</span>
          <span className="inline-flex gap-x-3">
            <PlannedMacroFigures
              protein={subtotal.protein}
              carbs={subtotal.carbs}
              fat={subtotal.fat}
            />
          </span>
        </div>
      )}
    </div>
  );
};

export default PlannedMealList;
