import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, LayoutAnimation } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import NutrientPill from './NutrientPill';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { getNetCarbsValue } from '../utils/nutrientUtils';
import { NUTRIENT_META, getNutrientLabel } from '../constants/nutrients';
import type { DailySummary } from '../types/dailySummary';
import type { PlannedNutrition } from '@workspace/shared';
import type { UserCustomNutrient } from '../hooks/useCustomNutrients';
import { formatLocalizedNumber } from '../localization';

const CORE_MACROS = ['protein', 'carbs', 'fat', 'dietary_fiber'] as const;

interface CalorieBarProps {
  eaten: number;
  goal: number;
  remaining: number;
  progressPercent: number;
  /** Calories the day's planned meals would add. */
  planned: number;
}

const CalorieBar: React.FC<CalorieBarProps> = ({
  eaten,
  goal,
  remaining,
  progressPercent,
  planned,
}) => {
  const { t } = useTranslation();
  const [barWidth, setBarWidth] = useState(0);
  const [trackColor, fillColor] = useCSSVariable([
    '--color-progress-track',
    '--color-calories',
  ]) as [string, string];
  const barHeight = 7;
  const borderRadius = 3.5;
  const hasGoal = goal > 0;

  const animatedProgress = useSharedValue(0);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;
    animatedProgress.value = 0;
    animatedProgress.value = withTiming(hasGoal ? progressPercent : 0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, hasGoal, progressPercent, animatedProgress]);

  const fillWidth = useDerivedValue(() => {
    const p = animatedProgress.value;
    if (p <= 0 || barWidth <= 0) return 0;
    return p > 1 ? barWidth / p : barWidth * p;
  }, [barWidth]);

  const overflowX = useDerivedValue(() => {
    const p = animatedProgress.value;
    if (p <= 1 || barWidth <= 0) return barWidth;
    return barWidth / p + 2;
  }, [barWidth]);

  const overflowWidth = useDerivedValue(() => {
    const p = animatedProgress.value;
    if (p <= 1 || barWidth <= 0) return 0;
    const gapStart = barWidth / p + 2;
    return Math.max(0, barWidth - gapStart);
  }, [barWidth]);

  // Planned calories continue the fill as a fainter segment, up to the goal.
  const roundedPlanned = Math.round(planned);
  const plannedFraction =
    hasGoal && roundedPlanned > 0 ? roundedPlanned / goal : 0;
  const plannedWidth = useDerivedValue(() => {
    const p = animatedProgress.value;
    if (plannedFraction <= 0 || barWidth <= 0 || p >= 1) return 0;
    // Share the fill's animation so the segment grows with it.
    const shown = progressPercent > 0 ? p / progressPercent : 1;
    const end = Math.min(1, (progressPercent + plannedFraction) * shown);
    return Math.max(0, (end - p) * barWidth);
  }, [barWidth, plannedFraction, progressPercent]);

  const fillStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));
  const plannedStyle = useAnimatedStyle(() => ({
    left: fillWidth.value,
    width: plannedWidth.value,
  }));
  const overflowStyle = useAnimatedStyle(() => ({
    left: overflowX.value,
    width: overflowWidth.value,
  }));

  return (
    <View>
      <View className="flex-row justify-between items-baseline mb-3">
        <Text className="text-lg font-bold text-text-primary">
          {formatLocalizedNumber(Math.round(eaten))}
          {hasGoal && (
            <Text className="text-lg font-semibold text-text-muted">
              {/* i18n-audit-ignore-next-line hardcoded-ui-text -- slash and spacing are numeric presentation punctuation. */}
              {t('nutrition.goalSeparator', {
                defaultValue: ' / {{value}}',
                value: formatLocalizedNumber(Math.round(goal)),
              })}
            </Text>
          )}
          <Text className="text-sm font-normal text-text-muted">
            {' '}
            {t('nutrition.caloriesShort', { defaultValue: 'kcal' })}
          </Text>
        </Text>
        {hasGoal && (
          <Text className="text-sm font-bold text-text-primary">
            {formatLocalizedNumber(Math.abs(Math.round(remaining)))}
            <Text className="text-sm font-normal text-text-muted">
              {' '}
              {remaining >= 0
                ? t('diarySummary.remaining', { defaultValue: 'remaining' })
                : t('diarySummary.over', { defaultValue: 'over' })}
            </Text>
          </Text>
        )}
      </View>
      {hasGoal && (
        <View
          className="h-[7px]"
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        >
          {barWidth > 0 && (
            <View
              style={{
                width: barWidth,
                height: barHeight,
                borderRadius,
                overflow: 'hidden',
                backgroundColor: trackColor,
              }}
            >
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: barHeight,
                    backgroundColor: fillColor,
                  },
                  fillStyle,
                ]}
              />
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    top: 0,
                    height: barHeight,
                    backgroundColor: fillColor,
                    opacity: 0.65,
                  },
                  overflowStyle,
                ]}
              />
              <Animated.View
                testID="planned-calorie-bar"
                style={[
                  {
                    position: 'absolute',
                    top: 0,
                    height: barHeight,
                    backgroundColor: fillColor,
                    opacity: 0.3,
                  },
                  plannedStyle,
                ]}
              />
            </View>
          )}
        </View>
      )}
      {roundedPlanned > 0 && (
        <Text className="text-sm text-text-muted mt-2">
          {t('diarySummary.plannedCalories', {
            defaultValue: '+{{planned}} kcal planned ({{total}} total)',
            planned: formatLocalizedNumber(roundedPlanned),
            total: formatLocalizedNumber(Math.round(eaten) + roundedPlanned),
          })}
        </Text>
      )}
    </View>
  );
};

interface DiaryCalorieMacroSummaryProps {
  summary: DailySummary;
  showNetCarbs: boolean;
  /** Diary-specific custom nutrient keys (view_group='diary'), already capped to 4. */
  customNutrientKeys: string[];
  customNutrients: UserCustomNutrient[];
  /** What the day's planned meals would add; not part of any total. */
  planned?: PlannedNutrition;
}

const DiaryCalorieMacroSummary: React.FC<DiaryCalorieMacroSummaryProps> = ({
  summary,
  showNetCarbs,
  customNutrientKeys,
  customNutrients,
  planned,
}) => {
  const { t } = useTranslation();
  const diarySummaryVisible = useAppPreferencesStore(
    (s) => s.diarySummaryVisible
  );
  const diarySummaryExpanded = useAppPreferencesStore(
    (s) => s.diarySummaryExpanded
  );
  const setDiarySummaryExpanded = useAppPreferencesStore(
    (s) => s.setDiarySummaryExpanded
  );
  const textSecondary = useCSSVariable('--color-text-secondary') as string;

  const rotation = useSharedValue(diarySummaryExpanded ? 0 : -90);
  useEffect(() => {
    rotation.value = withTiming(diarySummaryExpanded ? 0 : -90, {
      duration: 200,
    });
  }, [diarySummaryExpanded, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!diarySummaryVisible) {
    return null;
  }

  const { eaten, goal, remaining, progress } = summary.calorieBalance;
  const projection = summary.calorieBalance.tdeeProjection;

  const plannedOf = (key: string): number =>
    planned
      ? ((planned[key as keyof PlannedNutrition] as number | undefined) ??
        planned.custom_nutrients[key] ??
        0)
      : 0;

  const handleToggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDiarySummaryExpanded(!diarySummaryExpanded);
  };

  const resolveCoreMacro = (key: (typeof CORE_MACROS)[number]) => {
    if (key === 'protein') {
      return {
        label: t('nutrients.protein', { defaultValue: 'Protein' }),
        consumed: summary.protein.consumed,
        planned: plannedOf('protein'),
        goal: summary.protein.goal || undefined,
      };
    }
    if (key === 'carbs') {
      const consumed = showNetCarbs
        ? getNetCarbsValue(summary.carbs.consumed, summary.fiber.consumed)
        : summary.carbs.consumed;
      return {
        label: showNetCarbs
          ? t('nutrients.netCarbs', { defaultValue: 'Net Carbs' })
          : t('nutrients.carbs', { defaultValue: 'Carbs' }),
        consumed,
        planned: showNetCarbs
          ? getNetCarbsValue(plannedOf('carbs'), plannedOf('dietary_fiber'))
          : plannedOf('carbs'),
        goal: summary.carbs.goal || undefined,
      };
    }
    if (key === 'fat') {
      return {
        label: t('nutrients.fat', { defaultValue: 'Fat' }),
        consumed: summary.fat.consumed,
        planned: plannedOf('fat'),
        goal: summary.fat.goal || undefined,
      };
    }
    return {
      label: t('nutrients.fiber', { defaultValue: 'Fiber' }),
      consumed: summary.fiber.consumed,
      planned: plannedOf('dietary_fiber'),
      goal: summary.fiber.goal || undefined,
    };
  };

  return (
    <View className="mb-4">
      <TouchableOpacity
        onPress={handleToggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: diarySummaryExpanded }}
        accessibilityHint={
          diarySummaryExpanded
            ? t('diarySummary.collapse', {
                defaultValue: 'Collapse this section',
              })
            : t('diarySummary.expand', { defaultValue: 'Expand this section' })
        }
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-md font-bold text-text-secondary">
            {t('diarySummary.title', { defaultValue: 'Summary' })}
          </Text>
          <Animated.View style={chevronStyle}>
            <Icon name="chevron-down" size={20} color={textSecondary} />
          </Animated.View>
        </View>
        <CalorieBar
          eaten={eaten}
          goal={goal}
          remaining={remaining}
          progressPercent={progress / 100}
          planned={plannedOf('calories')}
        />
      </TouchableOpacity>
      {projection && (
        <View className="mt-2 rounded-lg bg-surface px-3 py-2">
          <Text className="text-xs font-semibold text-text-primary">
            {t('diarySummary.projectedTdee', {
              defaultValue: 'Projected TDEE: {{value}} kcal',
              value: formatLocalizedNumber(
                Math.round(projection.projectedBurn)
              ),
            })}
          </Text>
          <Text className="text-xs text-text-secondary mt-0.5">
            {t('diarySummary.goalModeTarget', {
              defaultValue: 'Goal Mode target: {{value}} kcal',
              value: formatLocalizedNumber(
                Math.round(projection.targetCalories ?? goal)
              ),
            })}
          </Text>
          <Text className="text-xs text-text-muted mt-0.5">
            {projection.source === 'health_connect_total'
              ? t('diarySummary.healthConnectProjectionSource', {
                  defaultValue: 'Health Connect total calories',
                })
              : projection.source === 'active_plus_bmr'
                ? t('diarySummary.fallbackProjectionSource', {
                    defaultValue: 'BMR + active calories fallback',
                  })
                : t('diarySummary.legacyProjectionSource', {
                    defaultValue: 'Device projection',
                  })}
          </Text>
        </View>
      )}
      {diarySummaryExpanded && (
        <View className="flex-row flex-wrap justify-between gap-y-2 mt-3">
          {CORE_MACROS.map((key) => {
            const {
              label,
              consumed,
              planned: macroPlanned,
              goal: macroGoal,
            } = resolveCoreMacro(key);
            return (
              <NutrientPill
                key={key}
                label={label}
                consumed={consumed}
                planned={macroPlanned}
                goal={macroGoal}
              />
            );
          })}
          {customNutrientKeys.map((name) => {
            const customDef = customNutrients.find((cn) => cn.name === name);
            const meta = NUTRIENT_META[name];
            const label = meta
              ? getNutrientLabel(t, name)
              : (customDef?.name ?? name);
            const unit = meta?.unit ?? customDef?.unit ?? 'g';
            const consumed = summary.customNutrientTotals[name] ?? 0;
            const nutrientGoal = summary.customNutrientGoals[name] || undefined;
            return (
              <NutrientPill
                key={name}
                label={label}
                consumed={consumed}
                goal={nutrientGoal}
                unit={unit}
                planned={plannedOf(name)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

export default DiaryCalorieMacroSummary;
