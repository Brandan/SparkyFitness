import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { PlannedMealItem } from '@workspace/shared';
import Button from './ui/Button';
import FoodThumbnail from './FoodThumbnail';
import { useFoodImageSourceContext } from './FoodImageSourceProvider';
import { useOpenLightbox } from './LightboxProvider';
import { usableFoodImages } from '../utils/foodImages';
import { usePlannedMealMutations } from '../hooks/usePlannedMeals';

interface PlannedMealsSectionProps {
  items: PlannedMealItem[];
  date: string;
}

const formatQuantity = (quantity: number, unit: string) =>
  `${Number.isInteger(quantity) ? quantity : Number(quantity.toFixed(2))} ${unit}`;

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
    isPending,
  } = usePlannedMealMutations(date);
  const getImageSource = useFoodImageSourceContext();
  const openLightbox = useOpenLightbox();

  const targetOf = (item: PlannedMealItem) => ({
    template_id: item.template_id,
    date,
    item_key: item.item_key,
  });

  const showUndo = (title: string, undo: () => Promise<void>) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: t('plannedMeals.tapToUndo', { defaultValue: 'Tap to undo' }),
      visibilityTime: 6000,
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
    try {
      for (const item of items) {
        added.push({ item, ids: await addPlannedMealAsync(targetOf(item)) });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: t('plannedMeals.addError', {
          defaultValue: 'Could not add the planned meal to your diary.',
        }),
      });
    }
    if (added.length === 0) return;
    showUndo(
      t('plannedMeals.addedAll', {
        defaultValue: 'Added {{count}} items to your diary',
        count: added.length,
      }),
      async () => {
        for (const { item, ids } of added) {
          await restorePlannedMealAsync({ ...targetOf(item), ...ids });
        }
      }
    );
  };

  const handleRemove = async (item: PlannedMealItem) => {
    try {
      await skipPlannedMealAsync(targetOf(item));
      showUndo(
        t('plannedMeals.removed', {
          defaultValue: 'Removed {{name}} from this day',
          name: item.name,
        }),
        () => restorePlannedMealAsync(targetOf(item))
      );
    } catch {
      Toast.show({
        type: 'error',
        text1: t('plannedMeals.removeError', {
          defaultValue: 'Could not remove the planned meal.',
        }),
      });
    }
  };

  return (
    <View className="gap-2 mb-2">
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-base font-bold text-text-secondary">
          {t('plannedMeals.title', { defaultValue: 'Planned' })}
        </Text>
        {items.length > 1 ? (
          <Button
            variant="secondary"
            className="py-2 px-4"
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
      {items.map((item) => {
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
                <Text className="text-xs font-semibold text-text-muted uppercase">
                  {item.meal_type_name ?? ''}
                </Text>
                <Text className="text-base font-semibold text-text-primary">
                  {item.name}
                  <Text className="text-sm font-normal text-text-secondary">
                    {`  ${formatQuantity(item.quantity, item.unit)}`}
                  </Text>
                </Text>
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
            <View className="flex-row gap-2">
              <Button
                variant="primary"
                className="flex-1 py-3"
                disabled={isPending}
                onPress={() => void handleAdd(item)}
              >
                {t('plannedMeals.addToDiary', { defaultValue: 'Add to diary' })}
              </Button>
              <Button
                variant="ghost"
                className="py-3 px-4"
                disabled={isPending}
                onPress={() => void handleRemove(item)}
                accessibilityLabel={t('plannedMeals.removeNamed', {
                  defaultValue: 'Remove {{name}} from this day',
                  name: item.name,
                })}
              >
                {t('plannedMeals.remove', { defaultValue: 'Remove' })}
              </Button>
            </View>
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
