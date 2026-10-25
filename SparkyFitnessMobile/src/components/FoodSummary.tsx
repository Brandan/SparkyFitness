import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { PlannedMealItem } from '@workspace/shared';
import type { FoodEntry } from '../types/foodEntries';
import type { DailyGoals } from '../types/goals';
import type { MealType } from '../types/mealTypes';
import Icon from './Icon';
import { MEAL_CONFIG } from '../constants/meals';
import SwipeableFoodRow from './SwipeableFoodRow';
import PlannedMealRows, { plannedKcal } from './PlannedMealRows';
import {
  addPlannedOnlyGroups,
  calculateEntryNutrition,
  calculateMealNutrition,
  getMealGroupLabel,
  groupFoodEntriesByMealType,
  getMealTargetCalories,
  type MealGroup,
} from '../utils/mealNutrition';

interface FoodSummaryProps {
  foodEntries: FoodEntry[];
  /** Planned items for the day; each shows inside its own meal's card. */
  planned?: { items: PlannedMealItem[]; date: string };
  mealTypes: MealType[];
  goals?: DailyGoals;
  calorieGoal?: number;
  onAddFood?: () => void;
  onAdjustServing?: (entry: FoodEntry) => void;
  onCopyEntry?: (entry: FoodEntry) => void;
  onPressMealType?: (
    mealTypeId: string | null,
    mealTypeName: string,
    entries: FoodEntry[]
  ) => void;
}

interface MealSectionProps {
  group: MealGroup;
  plannedItems: PlannedMealItem[];
  plannedDate?: string;
  goals?: DailyGoals;
  calorieGoal?: number;
  onAdjustServing?: (entry: FoodEntry) => void;
  onCopyEntry?: (entry: FoodEntry) => void;
  onPressMealType?: (
    mealTypeId: string | null,
    mealTypeName: string,
    entries: FoodEntry[]
  ) => void;
}

const EmptyState: React.FC<{ onAddFood?: () => void }> = ({ onAddFood }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onAddFood}
      accessibilityRole="button"
      accessibilityLabel={t('foodSummary.tapToAddFood', {
        defaultValue: 'Tap to add food',
      })}
      className="bg-surface rounded-xl p-4 mb-2 shadow-sm items-center py-6"
    >
      <Text className="text-text-muted text-base">
        {t('foodSummary.tapToAddFood', { defaultValue: 'Tap to add food' })}
      </Text>
    </Pressable>
  );
};

const MealSection: React.FC<MealSectionProps> = ({
  group,
  plannedItems,
  plannedDate,
  goals,
  calorieGoal,
  onAdjustServing,
  onCopyEntry,
  onPressMealType,
}) => {
  const { t } = useTranslation();
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;

  const label = getMealGroupLabel(group, t);
  // Single canonical MEAL_CONFIG lookup (read once, reuse both fields). A
  // custom category named "breakfast" still gets the neutral icon, never the
  // system one — ownership is decided by isSystem, not by the name.
  const systemConfig = group.isSystem
    ? MEAL_CONFIG[group.name.toLowerCase()]
    : undefined;
  const icon = systemConfig?.icon ?? 'meal-snack';

  const totalCalories = calculateMealNutrition(group.entries).values.calories;
  const targetCalories = React.useMemo(
    () => getMealTargetCalories(group.name, group.isSystem, goals, calorieGoal),
    [group.isSystem, group.name, goals, calorieGoal]
  );

  const plannedCalories = plannedKcal(plannedItems);
  const canOpenDetail = !!onPressMealType && group.entries.length > 0;

  const headerContent = (
    <>
      <Icon name={icon} size={18} color={accentPrimary} />
      <Text className="text-base font-bold text-text-secondary flex-1">
        {label}
      </Text>
      {plannedCalories !== null && plannedCalories > 0 && (
        <Text className="text-xs text-text-muted font-semibold">
          {t('foodSummary.plannedCalories', {
            defaultValue: '+{{calories}} planned',
            calories: plannedCalories,
          })}
        </Text>
      )}
      {(totalCalories > 0 || targetCalories > 0) && (
        <View className="bg-accent-primary/5 rounded-full px-2.5 py-0.5">
          <Text className="text-xs text-accent-primary font-semibold">
            {totalCalories}
            {targetCalories > 0 ? ` / ${targetCalories}` : ''}{' '}
            {t('foodSummary.caloriesUnit', { defaultValue: 'Cal' })}
          </Text>
        </View>
      )}
      {canOpenDetail && (
        <Icon name="chevron-forward" size={14} color={accentPrimary} />
      )}
    </>
  );

  return (
    <View className="bg-surface rounded-xl p-4 overflow-hidden shadow-sm">
      {canOpenDetail ? (
        <Pressable
          onPress={() =>
            onPressMealType?.(group.mealTypeId, group.name, group.entries)
          }
          className="flex-row gap-2 mb-3 items-center"
          accessibilityRole="button"
          accessibilityLabel={t('foodSummary.nutritionBreakdown', {
            defaultValue: '{{label}} nutrition breakdown',
            label,
          })}
        >
          {headerContent}
        </Pressable>
      ) : (
        <View className="flex-row gap-2 mb-3 items-center">
          {headerContent}
        </View>
      )}
      {group.entries.map((entry, index) => {
        const nutrition = calculateEntryNutrition(entry);
        return (
          <SwipeableFoodRow
            key={entry.id || index}
            entry={entry}
            nutrition={nutrition}
            onAdjustServing={onAdjustServing}
            onCopy={onCopyEntry}
          />
        );
      })}
      {plannedDate ? (
        <PlannedMealRows items={plannedItems} date={plannedDate} />
      ) : null}
    </View>
  );
};

const FoodSummary: React.FC<FoodSummaryProps> = ({
  foodEntries,
  planned,
  mealTypes,
  goals,
  calorieGoal,
  onAddFood,
  onAdjustServing,
  onCopyEntry,
  onPressMealType,
}) => {
  const plannedItems = planned?.items ?? [];
  if (foodEntries.length === 0 && plannedItems.length === 0) {
    return <EmptyState onAddFood={onAddFood} />;
  }

  // groupFoodEntriesByMealType only creates groups that have entries; a meal
  // with only planned items gets an empty group so its items have a card.
  const groups = addPlannedOnlyGroups(
    groupFoodEntriesByMealType(foodEntries, mealTypes),
    mealTypes,
    plannedItems
  );

  if (groups.length === 0) {
    return <EmptyState onAddFood={onAddFood} />;
  }

  return (
    <View className="gap-2 mb-2">
      {groups.map((group) => (
        <MealSection
          key={
            group.mealTypeId
              ? `meal:${group.mealTypeId}`
              : `historical:${group.name.toLowerCase()}`
          }
          group={group}
          plannedItems={plannedItems.filter(
            (item) => item.meal_type_id === group.mealTypeId
          )}
          plannedDate={planned?.date}
          goals={goals}
          calorieGoal={calorieGoal}
          onAdjustServing={onAdjustServing}
          onCopyEntry={onCopyEntry}
          onPressMealType={onPressMealType}
        />
      ))}
    </View>
  );
};

export default FoodSummary;
