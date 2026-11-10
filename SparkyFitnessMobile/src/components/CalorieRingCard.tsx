import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { useCSSVariable } from 'uniwind';
import ProgressRing from './ProgressRing';
import { formatLocalizedNumber } from '../localization';
import { energyFromKcal } from '@workspace/shared';
import { useEnergyUnit } from '../hooks/useEnergyUnit';
import { energyUnitLabel, formatEnergyNumber } from '../utils/energyUnit';

interface SideStatProps {
  label: string;
  value: number;
}

const SideStat: React.FC<SideStatProps> = ({ label, value }) => (
  <View className="items-center justify-center flex-1">
    <Text className="text-xl font-bold text-text-primary">
      {formatLocalizedNumber(Math.round(value))}
    </Text>
    <Text className="text-text-secondary text-xs mt-1">{label}</Text>
  </View>
);

interface CalorieRingCardProps {
  caloriesConsumed: number;
  caloriesBurned: number;
  calorieGoal: number;
  remainingCalories: number;
  progressPercent: number;
  /** Calories the day's planned meals would add. Not part of remaining. */
  plannedCalories?: number;
}

const CalorieRingCard: React.FC<CalorieRingCardProps> = ({
  caloriesConsumed,
  caloriesBurned,
  calorieGoal,
  remainingCalories,
  progressPercent,
  plannedCalories = 0,
}) => {
  const { t } = useTranslation();
  const energyUnit = useEnergyUnit();
  const [progressTrackColor, progressFillColor] = useCSSVariable([
    '--color-progress-track',
    '--color-calories',
  ]) as [string, string];

  const displayRemaining =
    Math.round(energyFromKcal(remainingCalories, energyUnit)) || 0;
  const roundedPlanned = Math.round(plannedCalories);
  const plannedFraction =
    calorieGoal > 0 && roundedPlanned > 0 ? roundedPlanned / calorieGoal : 0;

  return (
    <View className="bg-surface rounded-xl p-4 mb-3 shadow-sm">
      <View className="flex-row items-center justify-center">
        <SideStat
          label={t('dashboard.consumed', { defaultValue: 'Consumed' })}
          value={energyFromKcal(caloriesConsumed, energyUnit)}
        />

        <View className="relative items-center justify-center mx-2">
          <View>
            <ProgressRing
              progress={progressPercent}
              extra={plannedFraction}
              size={160}
              strokeWidth={12}
              color={progressFillColor}
              backgroundColor={progressTrackColor}
            />
          </View>
          <View className="absolute items-center justify-center">
            <Text className="text-2xl font-bold text-text-primary">
              {formatLocalizedNumber(displayRemaining)}
            </Text>
            <Text className="text-text-secondary text-xs">
              {t('dashboard.remaining', { defaultValue: 'remaining' })}
            </Text>
            <Text className="text-text-muted text-xs mt-0.5">
              {t('dashboard.ofCaloriesWithUnit', {
                defaultValue: 'of {{value}} {{unit}}',
                value: formatEnergyNumber(calorieGoal, energyUnit),
                unit: energyUnitLabel(energyUnit, t),
              })}
            </Text>
          </View>
        </View>

        <SideStat
          label={t('dashboard.burned', { defaultValue: 'Burned' })}
          value={energyFromKcal(caloriesBurned, energyUnit)}
        />
      </View>
      {roundedPlanned > 0 ? (
        <Text className="text-sm text-text-muted text-center mt-2">
          {t('dashboard.plannedCalories', {
            defaultValue: '+{{planned}} {{unit}} planned',
            planned: formatEnergyNumber(roundedPlanned, energyUnit),
            unit: energyUnitLabel(energyUnit, t),
          })}
        </Text>
      ) : null}
    </View>
  );
};

export default CalorieRingCard;
