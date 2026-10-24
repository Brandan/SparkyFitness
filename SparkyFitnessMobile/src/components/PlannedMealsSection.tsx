import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useCSSVariable } from 'uniwind';
import {
  sumPlannedNutrition,
  type PlannedMealItem,
  type PlannedNutrition,
} from '@workspace/shared';
import Button from './ui/Button';
import FoodThumbnail from './FoodThumbnail';
import { useFoodImageSourceContext } from './FoodImageSourceProvider';
import { useOpenLightbox } from './LightboxProvider';
import { formatLocalizedNumber } from '../localization';
import { usableFoodImages } from '../utils/foodImages';
import { usePlannedMealMutations } from '../hooks/usePlannedMeals';
import { DECIMAL_INPUT_REGEX, parseDecimalInput } from '../utils/numericInput';

interface PlannedMealsSectionProps {
  items: PlannedMealItem[];
  date: string;
}

const formatQuantity = (quantity: number, unit: string) =>
  `${Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(2))} ${unit}`;

/** Changes how much of a one-off planned food is planned. */
const OneOffAmountEditor: React.FC<{
  item: PlannedMealItem;
  disabled: boolean;
  onSave: (quantity: number) => void;
  onCancel: () => void;
}> = ({ item, disabled, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [text, setText] = useState(String(item.quantity));
  const parsed = parseDecimalInput(text);
  const valid = Number.isFinite(parsed) && parsed > 0;
  return (
    <View className="gap-2">
      <Text className="text-sm text-text-secondary">
        {t('plannedMeals.amount', {
          defaultValue: 'Amount ({{unit}})',
          unit: item.unit,
        })}
      </Text>
      <TextInput
        className="rounded-lg border border-border-subtle bg-raised px-3 py-3 text-base text-text-primary"
        value={text}
        onChangeText={(next) => {
          if (next === '' || DECIMAL_INPUT_REGEX.test(next)) setText(next);
        }}
        keyboardType="decimal-pad"
        autoFocus
        selectTextOnFocus
        accessibilityLabel={t('plannedMeals.changeNamed', {
          defaultValue: 'Change amount of {{name}}',
          name: item.name,
        })}
      />
      {!valid ? (
        <Text className="text-sm text-text-secondary">
          {t('plannedMeals.amountInvalid', {
            defaultValue: 'Enter an amount above 0.',
          })}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <Button
          variant="primary"
          className="flex-1 py-3"
          disabled={disabled || !valid}
          onPress={() => valid && onSave(parsed)}
        >
          {t('plannedMeals.save', { defaultValue: 'Save' })}
        </Button>
        <Button
          variant="ghost"
          className="min-h-11 py-3 px-4"
          onPress={onCancel}
        >
          {t('plannedMeals.cancel', { defaultValue: 'Cancel' })}
        </Button>
      </View>
    </View>
  );
};

const formatMacro = (value: number) =>
  (Number.isFinite(value) ? value : 0).toFixed(1);

/** Protein, carbs, and fat in the same colors as the meal plan's daily total. */
const PlannedMacroFigures = ({
  nutrition,
  colors,
}: {
  nutrition: PlannedNutrition;
  colors: { protein: string; carbs: string; fat: string };
}) => {
  const { t } = useTranslation();
  return (
    <Text className="text-sm">
      <Text style={{ color: colors.protein }}>
        {t('plannedMeals.protein', {
          defaultValue: 'P: {{amount}}g',
          amount: formatMacro(nutrition.protein),
        })}
      </Text>
      <Text className="text-text-secondary">{'  '}</Text>
      <Text style={{ color: colors.carbs }}>
        {t('plannedMeals.carbs', {
          defaultValue: 'C: {{amount}}g',
          amount: formatMacro(nutrition.carbs),
        })}
      </Text>
      <Text className="text-text-secondary">{'  '}</Text>
      <Text style={{ color: colors.fat }}>
        {t('plannedMeals.fat', {
          defaultValue: 'F: {{amount}}g',
          amount: formatMacro(nutrition.fat),
        })}
      </Text>
    </Text>
  );
};

const macrosOf = (items: PlannedMealItem[]): PlannedNutrition | null =>
  items.some((item) => item.nutrition != null)
    ? sumPlannedNutrition(items)
    : null;

interface PlannedMealGroup {
  id: string;
  name: string;
  items: PlannedMealItem[];
}

/** Keeps the server's meal order and gathers a meal's items under one heading. */
const groupPlannedByMeal = (items: PlannedMealItem[]): PlannedMealGroup[] => {
  const groups: PlannedMealGroup[] = [];
  const indexByMeal = new Map<string, number>();
  for (const item of items) {
    const at = indexByMeal.get(item.meal_type_id);
    if (at === undefined) {
      indexByMeal.set(item.meal_type_id, groups.length);
      groups.push({
        id: item.meal_type_id,
        name: item.meal_type_name ?? '',
        items: [item],
      });
    } else {
      groups[at].items.push(item);
    }
  }
  return groups;
};

/** Rounded kcal when any item has a figure on record; null when none do. */
const plannedKcal = (items: PlannedMealItem[]): number | null => {
  if (
    !items.some(
      (item) => item.nutrition != null || typeof item.calories === 'number'
    )
  ) {
    return null;
  }
  return Math.round(sumPlannedNutrition(items).calories);
};

/**
 * Items a "show as planned" meal plan has for this day. They are not diary
 * entries and are in none of the day's totals until the person adds them.
 */
const PlannedMealsList: React.FC<PlannedMealsSectionProps> = ({
  items,
  date,
}) => {
  const { t } = useTranslation();
  const {
    addPlannedMealAsync,
    skipPlannedMealAsync,
    restorePlannedMealAsync,
    updatePlannedFoodAsync,
    isPending,
  } = usePlannedMealMutations(date);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const getImageSource = useFoodImageSourceContext();
  const openLightbox = useOpenLightbox();
  const [proteinColor, carbsColor, fatColor] = useCSSVariable([
    '--color-cat-blue',
    '--color-cat-amber',
    '--color-cat-purple',
  ]) as [string, string, string];
  const macroColors = {
    protein: proteinColor,
    carbs: carbsColor,
    fat: fatColor,
  };

  const targetOf = (item: PlannedMealItem) => ({
    template_id: item.template_id,
    date,
    item_key: item.item_key,
  });

  const showUndo = (
    title: string,
    undo: () => Promise<void>,
    detail?: string
  ) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: detail,
      visibilityTime: 6000,
      props: {
        action: {
          label: t('plannedMeals.undo', { defaultValue: 'Undo' }),
          onPress: () => {
            Toast.hide();
            undo().catch(() => {
              Toast.show({
                type: 'error',
                text1: t('plannedMeals.undoError', {
                  defaultValue: 'Could not undo that.',
                }),
              });
            });
          },
        },
      },
    });
  };

  const handleAdd = async (item: PlannedMealItem) => {
    try {
      const added = await addPlannedMealAsync(targetOf(item));
      showUndo(
        t('plannedMeals.added', {
          defaultValue: 'Added {{name}} to {{meal}}',
          name: item.name,
          meal: item.meal_type_name ?? '',
        }),
        () =>
          restorePlannedMealAsync({
            ...targetOf(item),
            food_entry_ids: added.food_entry_ids,
            food_entry_meal_ids: added.food_entry_meal_ids,
          })
      );
    } catch {
      Toast.show({
        type: 'error',
        text1: t('plannedMeals.addError', {
          defaultValue: 'Could not add the planned meal to your diary.',
        }),
      });
    }
  };

  const handleAddAll = async () => {
    const added: {
      item: PlannedMealItem;
      ids: { food_entry_ids: string[]; food_entry_meal_ids: string[] };
    }[] = [];
    let failed: PlannedMealItem | null = null;
    for (const item of items) {
      try {
        added.push({ item, ids: await addPlannedMealAsync(targetOf(item)) });
      } catch {
        failed = item;
        break;
      }
    }
    if (added.length === 0) {
      Toast.show({
        type: 'error',
        text1: t('plannedMeals.addError', {
          defaultValue: 'Could not add the planned meal to your diary.',
        }),
      });
      return;
    }
    // One toast only (a new one replaces the last), so a partial failure is
    // said here instead of being hidden by the success message.
    showUndo(
      failed
        ? t('plannedMeals.addedSome', {
            defaultValue: 'Added {{added}} of {{total}} to your diary',
            added: added.length,
            total: items.length,
          })
        : t('plannedMeals.addedAll', {
            defaultValue: 'Added {{count}} items to your diary',
            count: added.length,
          }),
      async () => {
        for (const { item, ids } of added) {
          await restorePlannedMealAsync({ ...targetOf(item), ...ids });
        }
      },
      failed
        ? t('plannedMeals.couldNotAdd', {
            defaultValue: "Couldn't add {{name}}. Try again.",
            name: failed.name,
          })
        : undefined
    );
  };

  const groups = groupPlannedByMeal(items);
  const dayKcal = plannedKcal(items);
  const dayMacros = macrosOf(items);

  const handleSkip = async (item: PlannedMealItem) => {
    try {
      await skipPlannedMealAsync(targetOf(item));
      showUndo(
        t('plannedMeals.skipped', {
          defaultValue: 'Skipped {{name}} for this day',
          name: item.name,
        }),
        () => restorePlannedMealAsync(targetOf(item))
      );
    } catch {
      Toast.show({
        type: 'error',
        text1: t('plannedMeals.skipError', {
          defaultValue: 'Could not skip the planned meal.',
        }),
      });
    }
  };

  return (
    <View className="gap-2 mb-2">
      <View className="gap-1 px-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-text-secondary">
            {t('plannedMeals.title', { defaultValue: 'Planned' })}
          </Text>
          {items.length > 1 ? (
            <Button
              variant="secondary"
              className="min-h-11 py-2 px-4"
              disabled={isPending}
              onPress={() => void handleAddAll()}
            >
              {t('plannedMeals.addAll', {
                defaultValue: 'Add all {{count}} to diary',
                count: items.length,
              })}
            </Button>
          ) : null}
        </View>
        {dayKcal !== null && dayKcal > 0 ? (
          <Text className="text-sm font-semibold text-text-secondary">
            {t('plannedMeals.rollup', {
              defaultValue: '+{{calories}} kcal planned',
              calories: formatLocalizedNumber(dayKcal),
            })}
          </Text>
        ) : null}
        {dayMacros ? (
          <PlannedMacroFigures nutrition={dayMacros} colors={macroColors} />
        ) : null}
      </View>
      {groups.map((group) => {
        const mealKcal = plannedKcal(group.items);
        const mealMacros = macrosOf(group.items);
        return (
          <View key={group.id} className="gap-2">
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-base font-bold text-text-secondary">
                {group.name}
              </Text>
              {mealKcal !== null ? (
                <Text className="text-sm font-semibold text-text-secondary">
                  {t('plannedMeals.mealCalories', {
                    defaultValue: '+{{calories}} kcal',
                    calories: formatLocalizedNumber(mealKcal),
                  })}
                </Text>
              ) : null}
            </View>
            {group.items.map((item) => {
              const images = usableFoodImages(item.images);
              const image = images[0] ?? null;
              return (
                <View
                  key={`${item.template_id}-${item.item_key}`}
                  className="rounded-xl border-2 border-dashed border-border-strong p-4 gap-3"
                >
                  <View className="flex-row items-center gap-3">
                    {image ? (
                      <View style={{ opacity: 0.85 }}>
                        <FoodThumbnail
                          image={image}
                          getImageSource={getImageSource}
                          size={56}
                          showFallback={false}
                          onPress={() => openLightbox(images, 0, item.name)}
                        />
                      </View>
                    ) : null}
                    <View className="gap-1 flex-1">
                      <Text className="text-base font-semibold text-text-primary">
                        {item.name}
                        <Text className="text-sm font-normal text-text-secondary">
                          {`  ${formatQuantity(item.quantity, item.unit)}`}
                          {typeof item.calories === 'number'
                            ? ` · ${Math.round(item.calories)} ${t(
                                'nutrition.caloriesShort',
                                { defaultValue: 'kcal' }
                              )}`
                            : ''}
                        </Text>
                      </Text>
                      {item.nutrition ? (
                        <PlannedMacroFigures
                          nutrition={item.nutrition}
                          colors={macroColors}
                        />
                      ) : null}
                      {item.template_id === null ? (
                        <Text className="text-xs font-semibold uppercase text-text-muted">
                          {t('plannedMeals.oneOff', {
                            defaultValue: 'One-off',
                          })}
                        </Text>
                      ) : null}
                      {item.foods.length > 0 && (
                        <Text className="text-sm text-text-secondary">
                          {item.foods
                            .map(
                              (food) =>
                                `${food.name} ${formatQuantity(food.quantity, food.unit)}`
                            )
                            .join(' · ')}
                        </Text>
                      )}
                    </View>
                  </View>
                  {editingKey === item.item_key ? (
                    <OneOffAmountEditor
                      item={item}
                      disabled={isPending}
                      onCancel={() => setEditingKey(null)}
                      onSave={(quantity) => {
                        void updatePlannedFoodAsync({
                          id: item.item_key,
                          quantity,
                        })
                          .then(() => setEditingKey(null))
                          .catch(() =>
                            Toast.show({
                              type: 'error',
                              text1: t('plannedMeals.updateError', {
                                defaultValue:
                                  'Could not change the planned food.',
                              }),
                            })
                          );
                      }}
                    />
                  ) : (
                    <View className="flex-row gap-2">
                      {item.template_id === null ? (
                        <Button
                          variant="ghost"
                          className="min-h-11 py-3 px-4"
                          disabled={isPending}
                          onPress={() => setEditingKey(item.item_key)}
                          accessibilityLabel={t('plannedMeals.changeNamed', {
                            defaultValue: 'Change amount of {{name}}',
                            name: item.name,
                          })}
                        >
                          {t('plannedMeals.change', { defaultValue: 'Change' })}
                        </Button>
                      ) : null}
                      <Button
                        variant="primary"
                        className="flex-1 py-3"
                        disabled={isPending}
                        onPress={() => void handleAdd(item)}
                      >
                        {t('plannedMeals.addToDiary', {
                          defaultValue: 'Add to diary',
                        })}
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-11 py-3 px-4"
                        disabled={isPending}
                        onPress={() => void handleSkip(item)}
                        accessibilityLabel={t('plannedMeals.skipNamed', {
                          defaultValue: 'Skip {{name}} for this day',
                          name: item.name,
                        })}
                      >
                        {t('plannedMeals.skip', { defaultValue: 'Skip' })}
                      </Button>
                    </View>
                  )}
                </View>
              );
            })}
            {mealMacros ? (
              <View className="flex-row flex-wrap items-center gap-x-3 px-1">
                <Text className="text-sm text-text-secondary">
                  <Text className="font-semibold text-text-primary">
                    {t('plannedMeals.subtotal', { defaultValue: 'Planned:' })}
                  </Text>
                  {mealKcal !== null
                    ? ` ${formatLocalizedNumber(mealKcal)} ${t(
                        'nutrition.caloriesShort',
                        { defaultValue: 'kcal' }
                      )}`
                    : ''}
                </Text>
                <PlannedMacroFigures
                  nutrition={mealMacros}
                  colors={macroColors}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

/** Renders nothing, and sets up no mutations, on a day with nothing planned. */
const PlannedMealsSection: React.FC<PlannedMealsSectionProps> = (props) =>
  props.items.length === 0 ? null : <PlannedMealsList {...props} />;

export default PlannedMealsSection;
