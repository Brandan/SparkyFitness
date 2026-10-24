import { getEnergyUnitString } from '@/utils/nutritionCalculations';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';

interface EnergyCircleProps {
  remaining: number;
  progress: number;
  unit: 'kcal' | 'kJ';
  /** Planned calories in the same unit as `goal`. Drawn beside eaten, not inside it. */
  planned?: number;
  /** Goal the ring is a fraction of, in the same unit as `planned`. */
  goal?: number;
  // Only set when the user's calorie goal direction is 'target' with a
  // configured min/max band (see NutrientGoalDirectionSettings). Leaves the
  // ring's core remaining/progress math untouched; only adds a color +
  // checkmark indicator for whether today's intake falls within the band.
  targetBand?: { min: number; max: number; eaten: number };
}

export const EnergyCircle = ({
  remaining,
  progress,
  unit,
  planned = 0,
  goal = 0,
  targetBand,
}: EnergyCircleProps) => {
  const { t } = useTranslation();
  const eatenPct = Math.min(Math.max(progress, 0), 100);
  const plannedPct =
    goal > 0 && planned > 0
      ? Math.min((planned / goal) * 100, Math.max(0, 100 - eatenPct))
      : 0;
  const inRange =
    targetBand !== undefined &&
    targetBand.eaten >= targetBand.min &&
    targetBand.eaten <= targetBand.max;
  const isOverLimit =
    targetBand !== undefined && targetBand.eaten > targetBand.max;
  const ringColorClass =
    targetBand === undefined
      ? 'text-green-500'
      : inRange
        ? 'text-green-500'
        : isOverLimit
          ? 'text-red-500'
          : 'text-amber-500';

  const ringPath =
    'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-gray-200 dark:text-slate-400"
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            d={ringPath}
          />
          <path
            className={ringColorClass}
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={`${eatenPct}, 100`}
            d={ringPath}
          />
          {plannedPct > 0 && (
            <path
              data-testid="planned-energy-arc"
              className={`${ringColorClass} opacity-40`}
              stroke="currentColor"
              strokeWidth="3"
              fill="transparent"
              strokeDasharray={`${plannedPct} ${100 - plannedPct}`}
              strokeDashoffset={-eatenPct}
              d={ringPath}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-1">
            {remaining}
            {targetBand !== undefined && inRange && (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t(
              'exercise.dailyProgress.remaining2',
              'remaining {{energyUnitString}}',
              { energyUnitString: getEnergyUnitString(unit) }
            )}
          </div>
          {targetBand !== undefined && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              {t(
                'exercise.dailyProgress.targetBand',
                'target {{min}}–{{max}}',
                {
                  min: targetBand.min,
                  max: targetBand.max,
                }
              )}
            </div>
          )}
        </div>
      </div>
      {planned > 0 && (
        <div
          data-testid="planned-energy"
          className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center"
        >
          {t(
            'exercise.dailyProgress.plannedCalories',
            '+{{planned}} {{unit}} planned',
            {
              planned,
              unit: getEnergyUnitString(unit),
            }
          )}
        </div>
      )}
    </div>
  );
};
