import type { CalorieBalance } from '@workspace/shared';
import type { EnergyUnit } from '@/contexts/PreferencesContext';

/** The slice of a nutrient goal preference the calorie headline reads. */
interface CalorieGoalPreference {
  goalType: string;
  targetMin?: number | null;
  targetMax?: number | null;
}

type ConvertEnergy = (
  value: number,
  fromUnit: EnergyUnit,
  toUnit: EnergyUnit
) => number;

export interface EnergyHeadline {
  /** Budget the ring is a fraction of: the target band's ceiling when one is set. */
  goal: number;
  eaten: number;
  remaining: number;
  progress: number;
  /** Planned calories, kept beside eaten and never inside it. */
  planned: number;
  /** Set only when the calorie goal is a min/max band. */
  targetBand?: { min: number; max: number; eaten: number };
}

/**
 * The calorie numbers the Diary shows as its headline (the Daily Energy Goal
 * ring and the sticky toolbar), in the user's energy unit. Both read this one
 * function so they cannot disagree.
 */
export const computeEnergyHeadline = ({
  calorieBalance,
  calorieGoalPref,
  plannedKcal,
  energyUnit,
  convertEnergy,
}: {
  calorieBalance: CalorieBalance;
  calorieGoalPref: CalorieGoalPreference | undefined;
  plannedKcal: number;
  energyUnit: EnergyUnit;
  convertEnergy: ConvertEnergy;
}): EnergyHeadline => {
  const toDisplay = (kcal: number) =>
    Math.round(convertEnergy(kcal, 'kcal', energyUnit));

  const goal = toDisplay(calorieBalance.goal);
  const eaten = toDisplay(calorieBalance.eaten);
  const remaining = toDisplay(calorieBalance.remaining);

  const band =
    calorieGoalPref?.goalType === 'target' &&
    calorieGoalPref.targetMin != null &&
    calorieGoalPref.targetMax != null
      ? {
          min: toDisplay(calorieGoalPref.targetMin),
          max: toDisplay(calorieGoalPref.targetMax),
        }
      : undefined;

  // When a calorie target range is set, the upper bound serves as the budget ceiling.
  const effectiveGoal = band ? band.max : goal;
  const exerciseBonus = Math.max(0, remaining - (goal - eaten));
  const effectiveRemaining = band
    ? Math.round(effectiveGoal - eaten + exerciseBonus)
    : remaining;
  const effectiveProgress =
    band && effectiveGoal > 0
      ? Math.max(
          0,
          ((effectiveGoal - effectiveRemaining) / effectiveGoal) * 100
        )
      : calorieBalance.progress;

  return {
    goal: effectiveGoal,
    eaten,
    remaining: effectiveRemaining,
    progress: effectiveProgress,
    planned: toDisplay(plannedKcal),
    targetBand: band ? { ...band, eaten } : undefined,
  };
};

type TargetBand = { min: number; max: number; eaten: number };

/** Ring color: green on target or with no band, amber under it, red over it. */
export const getEnergyRingState = (targetBand?: TargetBand) => {
  const inRange =
    targetBand !== undefined &&
    targetBand.eaten >= targetBand.min &&
    targetBand.eaten <= targetBand.max;
  const isOverLimit =
    targetBand !== undefined && targetBand.eaten > targetBand.max;
  const colorClass =
    targetBand === undefined
      ? 'text-green-500'
      : inRange
        ? 'text-green-500'
        : isOverLimit
          ? 'text-red-500'
          : 'text-amber-500';
  return { inRange, colorClass };
};
